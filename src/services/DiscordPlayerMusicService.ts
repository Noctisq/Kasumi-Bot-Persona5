import { Client, User, VoiceBasedChannel, TextBasedChannel } from 'discord.js';
import { Player, QueryType } from 'discord-player';
import { YoutubeSabrExtractor } from 'discord-player-googlevideo';
import { MusicPlayer, MusicTrack, EnqueueResult } from '../interface/MusicPlayer.interface';

export class DiscordPlayerMusicService implements MusicPlayer {
  private constructor(private readonly player: Player) {}

  static async create(client: Client): Promise<DiscordPlayerMusicService> {
    const player = new Player(client);
    await player.extractors.register(YoutubeSabrExtractor, {});

    player.events.on('playerStart', (queue, track) => {
      queue.metadata?.channel?.send(`Now playing **${track.title}**!`);
    });
    player.events.on('emptyQueue', (queue) => {
      queue.metadata?.channel?.send('Queue finished, senpai! See you next time~');
    });
    player.events.on('playerError', (queue, error) => {
      console.error('Player error:', error);
      queue.metadata?.channel?.send('Something went wrong while playing that song, senpai. Skipping...');
    });
    player.events.on('error', (queue, error) => {
      console.error('General player error:', error);
      queue.metadata?.channel?.send('Something broke, senpai. :(');
    });

    return new DiscordPlayerMusicService(player);
  }

  async search(query: string, requestedBy: User): Promise<MusicTrack[]> {
    // YoutubeSabrExtractor solo acepta URLs de YouTube directas o queries con
    // prefijo `ytsearch:`; texto de búsqueda plano lo rechaza en silencio.
    const result = await this.player.search(`ytsearch:${query}`, {
      requestedBy,
      searchEngine: QueryType.AUTO,
    });
    return result.tracks.map(track => ({ title: track.title, url: track.url }));
  }

  async enqueue(
    voiceChannel: VoiceBasedChannel,
    textChannel: TextBasedChannel,
    urls: string[],
    requestedBy: User
  ): Promise<EnqueueResult> {
    // Snapshot ANTES del loop de play() — play() crea/muta la cola, así que
    // calcular esto después siempre daría startedFresh = false.
    const existingQueue = this.player.nodes.get(voiceChannel.guildId);
    const startedFresh = !existingQueue || (!existingQueue.node.isPlaying() && existingQueue.tracks.size === 0);

    for (const url of urls) {
      await this.player.play(voiceChannel, url, {
        nodeOptions: { metadata: { channel: textChannel } },
        requestedBy,
      });
    }

    return { startedFresh };
  }
}
