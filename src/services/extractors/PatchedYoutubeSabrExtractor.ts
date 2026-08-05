import { PassThrough, Readable } from 'node:stream';
import {
  BaseExtractor,
  type ExtractorInfo,
  type ExtractorSearchContext,
  type ExtractorStreamable,
  Playlist,
  type SearchQueryType,
  Track,
} from 'discord-player';
import { SabrStream } from 'googlevideo/sabr-stream';
import { buildSabrFormat, EnabledTrackTypes } from 'googlevideo/utils';
import { Constants, Innertube, Platform, type Types, UniversalCache, YTNodes } from 'youtubei.js';
import { PoTokenProvider } from '../PoTokenProvider';

// Fork of discord-player-googlevideo's YoutubeSabrExtractor (source:
// https://github.com/xxczaki/discord-bot/blob/main/packages/discord-player-googlevideo/src/YoutubeSabrExtractor.ts).
//
// The upstream activate() creates its Innertube session with NO po_token:
//   this.#innertube = await Innertube.create({ cache: ... });
// That one session is shared by both search (#handleSearch) and the watch
// request that determines playability (#makePlayerRequest) — without a
// po_token, YouTube now returns playabilityStatus: UNPLAYABLE for most
// videos, which is why streaming_data.server_abr_streaming_url comes back
// missing ("No valid URL to decipher") AND search comes back empty, for
// the same underlying reason.
//
// #innertube is a true private (#) field with no way to inject a token
// from outside, and activate() takes no parameters — there's no
// configuration-only fix, hence forking just this one file. Everything
// else here is unchanged from upstream.
const MAX_SEARCH_RESULTS = 10;
const MAX_RELATED_TRACKS = 5;
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const YOUTUBE_PLAYLIST_REGEX = /youtube\.com\/(?:watch|playlist).*[&?]list=([a-zA-Z0-9_-]{34})/;
const YOUTUBE_DOMAIN_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//;

type VideoData = {
  id: string;
  title?: { text?: string };
  author?: { name?: string };
  duration?: { seconds?: number };
  thumbnails?: Array<{ url?: string }>;
  view_count?: { text?: string };
};

type AdaptiveFormat = {
  itag?: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  initRange?: { start: string; end: string };
  indexRange?: { start: string; end: string };
  lastModified?: string;
  contentLength?: string;
  quality?: string;
  fps?: number;
  qualityLabel?: string;
  projectionType?: string;
  averageBitrate?: number;
  approxDurationMs?: string;
};

type PlayerResponse = {
  streaming_data?: {
    server_abr_streaming_url?: string;
    adaptive_formats: AdaptiveFormat[];
  };
  player_config?: {
    media_common_config: {
      media_ustreamer_request_config?: {
        video_playback_ustreamer_config?: string;
      };
    };
  };
};

/* v8 ignore start */
function setupYoutubeJsEvaluator() {
  Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
    const properties = [];

    if (env.n) {
      properties.push(`n: exportedVars.nFunction("${env.n}")`);
    }

    if (env.sig) {
      properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    }

    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;

    return new Function(code)();
  };
}
/* v8 ignore stop */

export interface PatchedYoutubeSabrExtractorOptions {
  poTokenProvider: PoTokenProvider;
}

export class PatchedYoutubeSabrExtractor extends BaseExtractor<PatchedYoutubeSabrExtractorOptions> {
  static identifier = 'com.kasumi.patched-youtube-sabr' as const;

  #innertube: Innertube | null = null;

  // No po_token here — confirmed by direct testing that a cookie from a
  // logged-in session is sufficient on its own for both search/watch
  // requests and full SABR streaming. Puppeteer-minted po_tokens turned out
  // actively harmful in production: on a small VM the mint can time out
  // outright, and even when it succeeds the resulting po_token+visitor_data
  // combination has caused server_abr_streaming_url to come back missing
  // ("No valid URL to decipher") despite the session otherwise being valid.
  async activate(): Promise<void> {
    setupYoutubeJsEvaluator();

    const cookie = this.options.poTokenProvider.getCookie();
    this.#innertube = await Innertube.create({
      cache: new UniversalCache(true, '/tmp/.cache'),
      ...(cookie ? { cookie } : {}),
    });

    this.protocols = ['ytsearch', 'youtube'];
  }

  async deactivate(): Promise<void> {
    this.#innertube = null;
  }

  async validate(query: string, type?: SearchQueryType | null): Promise<boolean> {
    if (type === 'arbitrary') {
      return false;
    }

    return YOUTUBE_DOMAIN_REGEX.test(query) || query.startsWith('youtube:') || query.startsWith('ytsearch:');
  }

  async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }

    const cleanQuery = query.replace(/^(youtube:|ytsearch:)/, '').trim();
    const playlistId = this.#extractPlaylistId(cleanQuery);

    if (playlistId) {
      return this.#handleDirectPlaylist(playlistId, context);
    }

    const videoId = this.#extractVideoId(cleanQuery);

    if (videoId) {
      return this.#handleDirectVideo(videoId, context);
    }

    return this.#handleSearch(cleanQuery, context);
  }

  async stream(track: Track): Promise<ExtractorStreamable> {
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }

    const videoId = this.#extractVideoId(track.url);

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const outputStream = new PassThrough();
    /* v8 ignore start */
    this.#startStream(videoId, outputStream).catch((error) => {
      console.error('[PatchedYoutubeSabrExtractor] Stream error:', error);
      if (track.metadata && typeof track.metadata === 'object') {
        (track.metadata as Record<string, unknown>).streamError = error;
      }

      if (!outputStream.destroyed) {
        outputStream.end();
      }
    });
    /* v8 ignore stop */

    return outputStream;
  }

  /* v8 ignore start */
  async #startStream(videoId: string, outputStream: PassThrough): Promise<void> {
    const playerResponse = await this.#makePlayerRequest(videoId);

    console.error(
      '[DEBUG]',
      'videoId=', videoId,
      'hasServerAbrUrl=', !!playerResponse.streaming_data?.server_abr_streaming_url,
      'hasPlayer=', !!this.#innertube?.session.player,
      'signatureTimestamp=', this.#innertube?.session.player?.signature_timestamp,
      'playabilityStatus=', JSON.stringify((playerResponse as unknown as { playability_status?: unknown }).playability_status)
    );

    const serverAbrStreamingUrl = await this.#innertube?.session.player?.decipher(
      playerResponse.streaming_data?.server_abr_streaming_url
    );

    const videoPlaybackUstreamerConfig =
      playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

    if (!videoPlaybackUstreamerConfig) {
      throw new Error('Streaming configuration not available');
    }

    if (!serverAbrStreamingUrl) {
      throw new Error('Streaming URL not available');
    }

    const sabrFormats = playerResponse.streaming_data?.adaptive_formats.map((format) => buildSabrFormat(format as never)) || [];

    // No per-video po_token — confirmed by direct testing (a full 5-minute
    // continuous stream with zero po_token, cookie only) that the cookie's
    // attestation alone is enough to keep SabrStream out of
    // ATTESTATION_PENDING. Minting one here used to mean launching a fresh
    // Puppeteer/Chrome for every single track, which is exactly what made
    // playback unreliable on a small VM.
    const serverAbrStream = new SabrStream({
      formats: sabrFormats,
      serverAbrStreamingUrl,
      videoPlaybackUstreamerConfig,
      clientInfo: {
        clientName: Number.parseInt(
          Constants.CLIENT_NAME_IDS[this.#innertube?.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS],
          10
        ),
        clientVersion: this.#innertube?.session.context.client.clientVersion,
      },
    });

    // YouTube asks for a "reload" (new playback URL + config, same video)
    // periodically during a stream — confirmed empirically this arrives
    // around the ~60s mark. Without a handler, SabrStream just throws
    // ("Player response reload requested by server") and the stream dies,
    // which is what surfaced as "No media parts or protocol updates
    // received from server" after retries were exhausted. Mirrors the
    // reference implementation in googlevideo's own examples
    // (sabr-stream-factory.ts) — re-request with the reload context, hand
    // the fresh URL/config back to the same stream instead of dying.
    serverAbrStream.on('reloadPlayerResponse', async (reloadPlaybackContext) => {
      try {
        const reloadedResponse = await this.#makePlayerRequest(videoId, reloadPlaybackContext);
        const freshUrl = await this.#innertube?.session.player?.decipher(reloadedResponse.streaming_data?.server_abr_streaming_url);
        const freshConfig =
          reloadedResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;

        if (freshUrl && freshConfig) {
          serverAbrStream.setStreamingURL(freshUrl);
          serverAbrStream.setUstreamerConfig(freshConfig);
        } else {
          console.error('[PatchedYoutubeSabrExtractor] Reload response missing URL/config, stream will likely stall.');
        }
      } catch (error) {
        console.error('[PatchedYoutubeSabrExtractor] Failed to handle reloadPlayerResponse:', error);
      }
    });

    type SabrPlaybackOptions = {
      audioQuality: 'AUDIO_QUALITY_MEDIUM';
      enabledTrackTypes: typeof EnabledTrackTypes.AUDIO_ONLY;
    };

    const startOptions: SabrPlaybackOptions = {
      audioQuality: 'AUDIO_QUALITY_MEDIUM' as const,
      enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
    };

    const { audioStream } = await serverAbrStream.start(startOptions as Record<string, unknown>);

    const nodeStream = Readable.fromWeb(audioStream);

    nodeStream.on('data', (chunk) => {
      if (!outputStream.destroyed) {
        outputStream.write(chunk);
      }
    });

    nodeStream.on('end', () => {
      if (!outputStream.destroyed) {
        outputStream.end();
      }
      serverAbrStream.abort();
      serverAbrStream.removeAllListeners();
    });

    nodeStream.on('error', (error) => {
      console.error('[PatchedYoutubeSabrExtractor] Stream error:', error);
      serverAbrStream.removeAllListeners();
      if (!outputStream.destroyed) {
        outputStream.end();
      }
    });
  }
  /* v8 ignore stop */

  async getRelatedTracks(track: Track): Promise<ExtractorInfo> {
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }

    const videoId = this.#extractVideoId(track.url);

    if (!videoId) {
      return this.createResponse();
    }

    try {
      const videoInfo = await this.#innertube.getBasicInfo(videoId);
      const relatedVideos = videoInfo.watch_next_feed?.filter((item) => item.type === 'CompactVideo') || [];

      const tracks: Track[] = [];

      for (const video of relatedVideos.slice(0, MAX_RELATED_TRACKS)) {
        if (!('id' in video) || !video.id) {
          continue;
        }

        const videoData = video as VideoData;
        const relatedTrack = this.#createTrackFromVideoData(videoData, track.requestedBy, video);

        tracks.push(relatedTrack);
      }

      return this.createResponse(null, tracks);
    } catch (error) {
      console.error('[PatchedYoutubeSabrExtractor] Failed to get related tracks:', error);
      return this.createResponse();
    }
  }

  async #handleDirectPlaylist(playlistId: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    /* v8 ignore start */
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */

    const youtubePlaylist = await this.#innertube.getPlaylist(playlistId);

    if (!youtubePlaylist) {
      return this.createResponse();
    }

    while (youtubePlaylist.has_continuation) {
      await youtubePlaylist.getContinuation();
    }

    const tracks = await Promise.all(
      youtubePlaylist.videos
        .map((video) => {
          if (!('id' in video)) {
            return null;
          }

          return this.#createTrackFromVideoData(video as VideoData, context.requestedBy, video);
        })
        .filter((track) => !!track)
    );

    const discordPlayerPlaylist = new Playlist(this.context.player, {
      title: youtubePlaylist.info.title || 'Unknown',
      author:
        typeof youtubePlaylist.info.author === 'string'
          ? { name: youtubePlaylist.info.author, url: '' }
          : {
              name: (youtubePlaylist.info.author as { name?: string } | undefined)?.name || 'Unknown',
              url: (youtubePlaylist.info.author as { url?: string } | undefined)?.url || '',
            },
      type: 'playlist',
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      id: playlistId,
      source: 'youtube',
      rawPlaylist: youtubePlaylist,
      thumbnail: youtubePlaylist.info.thumbnails?.[0]?.url,
      description: youtubePlaylist.info.description || 'Unknown',
      tracks,
    });

    return this.createResponse(discordPlayerPlaylist);
  }

  async #handleDirectVideo(videoId: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    /* v8 ignore start */
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */

    const videoInfo = await this.#innertube.getBasicInfo(videoId);

    if (!videoInfo.basic_info) {
      return this.createResponse();
    }

    const track = this.#createTrackFromBasicInfo(videoId, videoInfo.basic_info, context.requestedBy, videoInfo);

    return this.createResponse(null, [track]);
  }

  async #handleSearch(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    /* v8 ignore start */
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */

    try {
      const searchResults = await this.#innertube.search(query, {
        type: 'video',
      });

      const tracks: Track[] = [];

      for (const video of searchResults.videos.slice(0, MAX_SEARCH_RESULTS)) {
        if (!('id' in video)) {
          continue;
        }

        const videoData = video as VideoData;
        const track = this.#createTrackFromVideoData(videoData, context.requestedBy, video);

        tracks.push(track);
      }

      return this.createResponse(null, tracks);
    } catch (error) {
      console.error('[PatchedYoutubeSabrExtractor] Failed to search YouTube:', error);
      return this.createResponse();
    }
  }

  #createTrackFromBasicInfo(
    videoId: string,
    basicInfo: {
      title?: string;
      author?: string;
      duration?: number;
      thumbnail?: Array<{ url?: string }>;
      view_count?: number;
    },
    requestedBy: ExtractorSearchContext['requestedBy'],
    raw: unknown
  ): Track {
    const track = new Track(this.context.player, {
      title: basicInfo.title || 'Unknown',
      author: basicInfo.author || 'Unknown',
      url: `https://youtube.com/watch?v=${videoId}`,
      duration: this.#parseDuration(basicInfo.duration || 0),
      thumbnail: basicInfo.thumbnail?.[0]?.url,
      views: basicInfo.view_count || 0,
      requestedBy,
      source: 'youtube',
      raw,
    });

    track.extractor = this;

    return track;
  }

  #createTrackFromVideoData(videoData: VideoData, requestedBy: ExtractorSearchContext['requestedBy'], raw: unknown): Track {
    const track = new Track(this.context.player, {
      title: videoData.title?.text || 'Unknown',
      author: videoData.author?.name || 'Unknown',
      url: `https://youtube.com/watch?v=${videoData.id}`,
      duration: this.#parseDuration(videoData.duration?.seconds || 0),
      thumbnail: videoData.thumbnails?.[0]?.url,
      views: Number.parseInt(videoData.view_count?.text?.replace(/\D/g, '') || '0', 10),
      requestedBy,
      source: 'youtube',
      raw,
    });

    track.extractor = this;

    return track;
  }

  #extractVideoId(url: string): string | null {
    const match = url.match(YOUTUBE_URL_REGEX);
    return match?.[1] || null;
  }

  #extractPlaylistId(url: string): string | null {
    const match = url.match(YOUTUBE_PLAYLIST_REGEX);
    return match?.[1] || null;
  }

  #parseDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    /* v8 ignore start */
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    /* v8 ignore stop */

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async #makePlayerRequest(videoId: string, reloadPlaybackContext?: unknown): Promise<PlayerResponse> {
    /* v8 ignore start */
    if (!this.#innertube) {
      throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */

    const watchEndpoint = new YTNodes.NavigationEndpoint({
      watchEndpoint: { videoId },
    });

    const playbackContext: Record<string, unknown> = {
      contentPlaybackContext: {
        vis: 0,
        splay: false,
        lactMilliseconds: '-1',
        signatureTimestamp: this.#innertube.session.player?.signature_timestamp,
      },
    };
    if (reloadPlaybackContext) {
      playbackContext.reloadPlaybackContext = reloadPlaybackContext;
    }

    const extraArgs = {
      playbackContext,
      contentCheckOk: true,
      racyCheckOk: true,
      parse: true as const,
    };

    const response = await watchEndpoint.call(this.#innertube.actions, extraArgs);
    return response as PlayerResponse;
  }
}
