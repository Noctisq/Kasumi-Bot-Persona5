"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _PatchedYoutubeSabrExtractor_instances, _PatchedYoutubeSabrExtractor_innertube, _PatchedYoutubeSabrExtractor_startStream, _PatchedYoutubeSabrExtractor_handleDirectPlaylist, _PatchedYoutubeSabrExtractor_handleDirectVideo, _PatchedYoutubeSabrExtractor_handleSearch, _PatchedYoutubeSabrExtractor_createTrackFromBasicInfo, _PatchedYoutubeSabrExtractor_createTrackFromVideoData, _PatchedYoutubeSabrExtractor_extractVideoId, _PatchedYoutubeSabrExtractor_extractPlaylistId, _PatchedYoutubeSabrExtractor_parseDuration, _PatchedYoutubeSabrExtractor_makePlayerRequest;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchedYoutubeSabrExtractor = void 0;
const node_stream_1 = require("node:stream");
const discord_player_1 = require("discord-player");
const sabr_stream_1 = require("googlevideo/sabr-stream");
const utils_1 = require("googlevideo/utils");
const youtubei_js_1 = require("youtubei.js");
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
/* v8 ignore start */
function setupYoutubeJsEvaluator() {
    youtubei_js_1.Platform.shim.eval = async (data, env) => {
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
class PatchedYoutubeSabrExtractor extends discord_player_1.BaseExtractor {
    constructor() {
        super(...arguments);
        _PatchedYoutubeSabrExtractor_instances.add(this);
        _PatchedYoutubeSabrExtractor_innertube.set(this, null);
    }
    // No po_token here — confirmed by direct testing that a cookie from a
    // logged-in session is sufficient on its own for both search/watch
    // requests and full SABR streaming. Puppeteer-minted po_tokens turned out
    // actively harmful in production: on a small VM the mint can time out
    // outright, and even when it succeeds the resulting po_token+visitor_data
    // combination has caused server_abr_streaming_url to come back missing
    // ("No valid URL to decipher") despite the session otherwise being valid.
    async activate() {
        setupYoutubeJsEvaluator();
        const cookie = this.options.poTokenProvider.getCookie();
        __classPrivateFieldSet(this, _PatchedYoutubeSabrExtractor_innertube, await youtubei_js_1.Innertube.create({
            cache: new youtubei_js_1.UniversalCache(true, '/tmp/.cache'),
            ...(cookie ? { cookie } : {}),
        }), "f");
        this.protocols = ['ytsearch', 'youtube'];
    }
    async deactivate() {
        __classPrivateFieldSet(this, _PatchedYoutubeSabrExtractor_innertube, null, "f");
    }
    async validate(query, type) {
        if (type === 'arbitrary') {
            return false;
        }
        return YOUTUBE_DOMAIN_REGEX.test(query) || query.startsWith('youtube:') || query.startsWith('ytsearch:');
    }
    async handle(query, context) {
        if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
            throw new Error('PatchedYoutubeSabrExtractor not initialized');
        }
        const cleanQuery = query.replace(/^(youtube:|ytsearch:)/, '').trim();
        const playlistId = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_extractPlaylistId).call(this, cleanQuery);
        if (playlistId) {
            return __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_handleDirectPlaylist).call(this, playlistId, context);
        }
        const videoId = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_extractVideoId).call(this, cleanQuery);
        if (videoId) {
            return __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_handleDirectVideo).call(this, videoId, context);
        }
        return __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_handleSearch).call(this, cleanQuery, context);
    }
    async stream(track) {
        if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
            throw new Error('PatchedYoutubeSabrExtractor not initialized');
        }
        const videoId = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_extractVideoId).call(this, track.url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }
        const outputStream = new node_stream_1.PassThrough();
        /* v8 ignore start */
        __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_startStream).call(this, videoId, outputStream).catch((error) => {
            console.error('[PatchedYoutubeSabrExtractor] Stream error:', error);
            if (track.metadata && typeof track.metadata === 'object') {
                track.metadata.streamError = error;
            }
            if (!outputStream.destroyed) {
                outputStream.end();
            }
        });
        /* v8 ignore stop */
        return outputStream;
    }
    /* v8 ignore stop */
    async getRelatedTracks(track) {
        if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
            throw new Error('PatchedYoutubeSabrExtractor not initialized');
        }
        const videoId = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_extractVideoId).call(this, track.url);
        if (!videoId) {
            return this.createResponse();
        }
        try {
            const videoInfo = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f").getBasicInfo(videoId);
            const relatedVideos = videoInfo.watch_next_feed?.filter((item) => item.type === 'CompactVideo') || [];
            const tracks = [];
            for (const video of relatedVideos.slice(0, MAX_RELATED_TRACKS)) {
                if (!('id' in video) || !video.id) {
                    continue;
                }
                const videoData = video;
                const relatedTrack = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_createTrackFromVideoData).call(this, videoData, track.requestedBy, video);
                tracks.push(relatedTrack);
            }
            return this.createResponse(null, tracks);
        }
        catch (error) {
            console.error('[PatchedYoutubeSabrExtractor] Failed to get related tracks:', error);
            return this.createResponse();
        }
    }
}
exports.PatchedYoutubeSabrExtractor = PatchedYoutubeSabrExtractor;
_PatchedYoutubeSabrExtractor_innertube = new WeakMap(), _PatchedYoutubeSabrExtractor_instances = new WeakSet(), _PatchedYoutubeSabrExtractor_startStream = 
/* v8 ignore start */
async function _PatchedYoutubeSabrExtractor_startStream(videoId, outputStream) {
    const playerResponse = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_makePlayerRequest).call(this, videoId);
    console.error('[DEBUG]', 'videoId=', videoId, 'hasServerAbrUrl=', !!playerResponse.streaming_data?.server_abr_streaming_url, 'hasPlayer=', !!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")?.session.player, 'signatureTimestamp=', __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")?.session.player?.signature_timestamp, 'playabilityStatus=', JSON.stringify(playerResponse.playability_status));
    const serverAbrStreamingUrl = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")?.session.player?.decipher(playerResponse.streaming_data?.server_abr_streaming_url);
    const videoPlaybackUstreamerConfig = playerResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
    if (!videoPlaybackUstreamerConfig) {
        throw new Error('Streaming configuration not available');
    }
    if (!serverAbrStreamingUrl) {
        throw new Error('Streaming URL not available');
    }
    const sabrFormats = playerResponse.streaming_data?.adaptive_formats.map((format) => (0, utils_1.buildSabrFormat)(format)) || [];
    // No per-video po_token — confirmed by direct testing (a full 5-minute
    // continuous stream with zero po_token, cookie only) that the cookie's
    // attestation alone is enough to keep SabrStream out of
    // ATTESTATION_PENDING. Minting one here used to mean launching a fresh
    // Puppeteer/Chrome for every single track, which is exactly what made
    // playback unreliable on a small VM.
    const serverAbrStream = new sabr_stream_1.SabrStream({
        formats: sabrFormats,
        serverAbrStreamingUrl,
        videoPlaybackUstreamerConfig,
        clientInfo: {
            clientName: Number.parseInt(youtubei_js_1.Constants.CLIENT_NAME_IDS[__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")?.session.context.client.clientName], 10),
            clientVersion: __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")?.session.context.client.clientVersion,
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
            const reloadedResponse = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_makePlayerRequest).call(this, videoId, reloadPlaybackContext);
            const freshUrl = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")?.session.player?.decipher(reloadedResponse.streaming_data?.server_abr_streaming_url);
            const freshConfig = reloadedResponse.player_config?.media_common_config.media_ustreamer_request_config?.video_playback_ustreamer_config;
            if (freshUrl && freshConfig) {
                serverAbrStream.setStreamingURL(freshUrl);
                serverAbrStream.setUstreamerConfig(freshConfig);
            }
            else {
                console.error('[PatchedYoutubeSabrExtractor] Reload response missing URL/config, stream will likely stall.');
            }
        }
        catch (error) {
            console.error('[PatchedYoutubeSabrExtractor] Failed to handle reloadPlayerResponse:', error);
        }
    });
    const startOptions = {
        audioQuality: 'AUDIO_QUALITY_MEDIUM',
        enabledTrackTypes: utils_1.EnabledTrackTypes.AUDIO_ONLY,
    };
    const { audioStream } = await serverAbrStream.start(startOptions);
    const nodeStream = node_stream_1.Readable.fromWeb(audioStream);
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
}, _PatchedYoutubeSabrExtractor_handleDirectPlaylist = async function _PatchedYoutubeSabrExtractor_handleDirectPlaylist(playlistId, context) {
    /* v8 ignore start */
    if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
        throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */
    const youtubePlaylist = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f").getPlaylist(playlistId);
    if (!youtubePlaylist) {
        return this.createResponse();
    }
    while (youtubePlaylist.has_continuation) {
        await youtubePlaylist.getContinuation();
    }
    const tracks = await Promise.all(youtubePlaylist.videos
        .map((video) => {
        if (!('id' in video)) {
            return null;
        }
        return __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_createTrackFromVideoData).call(this, video, context.requestedBy, video);
    })
        .filter((track) => !!track));
    const discordPlayerPlaylist = new discord_player_1.Playlist(this.context.player, {
        title: youtubePlaylist.info.title || 'Unknown',
        author: typeof youtubePlaylist.info.author === 'string'
            ? { name: youtubePlaylist.info.author, url: '' }
            : {
                name: youtubePlaylist.info.author?.name || 'Unknown',
                url: youtubePlaylist.info.author?.url || '',
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
}, _PatchedYoutubeSabrExtractor_handleDirectVideo = async function _PatchedYoutubeSabrExtractor_handleDirectVideo(videoId, context) {
    /* v8 ignore start */
    if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
        throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */
    const videoInfo = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f").getBasicInfo(videoId);
    if (!videoInfo.basic_info) {
        return this.createResponse();
    }
    const track = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_createTrackFromBasicInfo).call(this, videoId, videoInfo.basic_info, context.requestedBy, videoInfo);
    return this.createResponse(null, [track]);
}, _PatchedYoutubeSabrExtractor_handleSearch = async function _PatchedYoutubeSabrExtractor_handleSearch(query, context) {
    /* v8 ignore start */
    if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
        throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */
    try {
        const searchResults = await __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f").search(query, {
            type: 'video',
        });
        const tracks = [];
        for (const video of searchResults.videos.slice(0, MAX_SEARCH_RESULTS)) {
            if (!('id' in video)) {
                continue;
            }
            const videoData = video;
            const track = __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_createTrackFromVideoData).call(this, videoData, context.requestedBy, video);
            tracks.push(track);
        }
        return this.createResponse(null, tracks);
    }
    catch (error) {
        console.error('[PatchedYoutubeSabrExtractor] Failed to search YouTube:', error);
        return this.createResponse();
    }
}, _PatchedYoutubeSabrExtractor_createTrackFromBasicInfo = function _PatchedYoutubeSabrExtractor_createTrackFromBasicInfo(videoId, basicInfo, requestedBy, raw) {
    const track = new discord_player_1.Track(this.context.player, {
        title: basicInfo.title || 'Unknown',
        author: basicInfo.author || 'Unknown',
        url: `https://youtube.com/watch?v=${videoId}`,
        duration: __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_parseDuration).call(this, basicInfo.duration || 0),
        thumbnail: basicInfo.thumbnail?.[0]?.url,
        views: basicInfo.view_count || 0,
        requestedBy,
        source: 'youtube',
        raw,
    });
    track.extractor = this;
    return track;
}, _PatchedYoutubeSabrExtractor_createTrackFromVideoData = function _PatchedYoutubeSabrExtractor_createTrackFromVideoData(videoData, requestedBy, raw) {
    const track = new discord_player_1.Track(this.context.player, {
        title: videoData.title?.text || 'Unknown',
        author: videoData.author?.name || 'Unknown',
        url: `https://youtube.com/watch?v=${videoData.id}`,
        duration: __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_instances, "m", _PatchedYoutubeSabrExtractor_parseDuration).call(this, videoData.duration?.seconds || 0),
        thumbnail: videoData.thumbnails?.[0]?.url,
        views: Number.parseInt(videoData.view_count?.text?.replace(/\D/g, '') || '0', 10),
        requestedBy,
        source: 'youtube',
        raw,
    });
    track.extractor = this;
    return track;
}, _PatchedYoutubeSabrExtractor_extractVideoId = function _PatchedYoutubeSabrExtractor_extractVideoId(url) {
    const match = url.match(YOUTUBE_URL_REGEX);
    return match?.[1] || null;
}, _PatchedYoutubeSabrExtractor_extractPlaylistId = function _PatchedYoutubeSabrExtractor_extractPlaylistId(url) {
    const match = url.match(YOUTUBE_PLAYLIST_REGEX);
    return match?.[1] || null;
}, _PatchedYoutubeSabrExtractor_parseDuration = function _PatchedYoutubeSabrExtractor_parseDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    /* v8 ignore start */
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    /* v8 ignore stop */
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}, _PatchedYoutubeSabrExtractor_makePlayerRequest = async function _PatchedYoutubeSabrExtractor_makePlayerRequest(videoId, reloadPlaybackContext) {
    /* v8 ignore start */
    if (!__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f")) {
        throw new Error('PatchedYoutubeSabrExtractor not initialized');
    }
    /* v8 ignore stop */
    const watchEndpoint = new youtubei_js_1.YTNodes.NavigationEndpoint({
        watchEndpoint: { videoId },
    });
    const playbackContext = {
        contentPlaybackContext: {
            vis: 0,
            splay: false,
            lactMilliseconds: '-1',
            signatureTimestamp: __classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f").session.player?.signature_timestamp,
        },
    };
    if (reloadPlaybackContext) {
        playbackContext.reloadPlaybackContext = reloadPlaybackContext;
    }
    const extraArgs = {
        playbackContext,
        contentCheckOk: true,
        racyCheckOk: true,
        parse: true,
    };
    const response = await watchEndpoint.call(__classPrivateFieldGet(this, _PatchedYoutubeSabrExtractor_innertube, "f").actions, extraArgs);
    return response;
};
PatchedYoutubeSabrExtractor.identifier = 'com.kasumi.patched-youtube-sabr';
//# sourceMappingURL=PatchedYoutubeSabrExtractor.js.map