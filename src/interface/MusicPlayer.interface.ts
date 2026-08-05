import { User, VoiceBasedChannel, TextBasedChannel } from 'discord.js';

export interface MusicTrack {
  title: string;
  author: string;
  url: string;
  thumbnail: string;
  duration: string;
}

export interface EnqueueResult {
  startedFresh: boolean;
}

export interface PlayerTrackInfo {
  title: string;
  author: string;
  url: string;
  thumbnail: string;
  duration: string;
  durationMS: number;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTrack: PlayerTrackInfo | null;
  positionMS: number;
  queue: PlayerTrackInfo[];
  volume: number;
}

export type StateChangeListener = (guildId: string, state: PlayerState) => void;

export interface MusicPlayer {
  search(query: string, requestedBy: User): Promise<MusicTrack[]>;
  enqueue(
    voiceChannel: VoiceBasedChannel,
    textChannel: TextBasedChannel,
    urls: string[],
    requestedBy: User
  ): Promise<EnqueueResult>;

  getState(guildId: string): PlayerState | null;
  togglePlayback(guildId: string): boolean;
  skip(guildId: string): boolean;
  previous(guildId: string): Promise<boolean>;
  onStateChange(listener: StateChangeListener): void;

  // Activity-facing: takes raw Discord IDs (received over the WebSocket)
  // instead of resolved discord.js objects, since the Activity only has IDs.
  searchTracks(query: string): Promise<MusicTrack[]>;
  addTrackToQueue(
    guildId: string,
    voiceChannelId: string,
    requestedByUserId: string,
    url: string
  ): Promise<EnqueueResult>;
  removeTrackFromQueue(guildId: string, url: string): boolean;
  moveTrackInQueue(guildId: string, url: string, toIndex: number): boolean;
  setVolume(guildId: string, volume: number): boolean;

  // Updates the YouTube session cookie and refreshes the extractor's live
  // session with it — no process restart needed. See /set-cookie.
  refreshYoutubeCookie(cookie: string): Promise<void>;
}
