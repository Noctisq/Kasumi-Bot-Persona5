"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordPlayerMusicService = void 0;
const discord_player_1 = require("discord-player");
const discord_player_googlevideo_1 = require("discord-player-googlevideo");
class DiscordPlayerMusicService {
    constructor(player) {
        this.player = player;
    }
    static async create(client) {
        const player = new discord_player_1.Player(client);
        await player.extractors.register(discord_player_googlevideo_1.YoutubeSabrExtractor, {});
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
    async search(query, requestedBy) {
        // YoutubeSabrExtractor solo acepta URLs de YouTube directas o queries con
        // prefijo `ytsearch:`; texto de búsqueda plano lo rechaza en silencio.
        const result = await this.player.search(`ytsearch:${query}`, {
            requestedBy,
            searchEngine: discord_player_1.QueryType.AUTO,
        });
        return result.tracks.map(track => ({ title: track.title, url: track.url }));
    }
    async enqueue(voiceChannel, textChannel, urls, requestedBy) {
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
exports.DiscordPlayerMusicService = DiscordPlayerMusicService;
//# sourceMappingURL=DiscordPlayerMusicService.js.map