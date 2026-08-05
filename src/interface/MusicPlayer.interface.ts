import { User, VoiceBasedChannel, TextBasedChannel } from 'discord.js';

export interface MusicTrack {
  title: string;
  url: string;
}

export interface EnqueueResult {
  startedFresh: boolean;
}

export interface MusicPlayer {
  search(query: string, requestedBy: User): Promise<MusicTrack[]>;
  enqueue(
    voiceChannel: VoiceBasedChannel,
    textChannel: TextBasedChannel,
    urls: string[],
    requestedBy: User
  ): Promise<EnqueueResult>;
}
