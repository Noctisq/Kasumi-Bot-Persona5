"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioPlayer = void 0;
const SongQueue_1 = require("./SongQueue");
const { stream } = require('play-dl');
const { AudioPlayerStatus, createAudioPlayer, createAudioResource, } = require('@discordjs/voice');
class AudioPlayer {
    constructor() {
    }
    static getInstance() {
        if (!AudioPlayer.instance) {
            AudioPlayer.instance = new AudioPlayer();
        }
        return AudioPlayer.instance;
    }
    initialize(songsToAdd, connection) {
        this.songs = new SongQueue_1.SongQueue(songsToAdd);
        this.connection = connection;
    }
    async createAudioStream() {
        this.audioStream = await stream(this.songs.playNext(), {
            discordPlayerCompatibility: true
        });
    }
    ;
    async createAudioResource() {
        this.audioResource = await createAudioResource(this.audioStream.stream, { inputType: stream.type });
    }
    ;
    async createAudioPlayer() {
        return await createAudioPlayer();
    }
    ;
    async playMusic() {
        try {
            const player = await createAudioPlayer();
            await this.createAudioStream();
            await this.createAudioResource();
            await player.play(this.audioResource);
            await this.connection.subscribe(player);
            console.log('solo deberia de aparecer una vez en play music');
            player.on(AudioPlayerStatus.Idle, () => this.nextSong(player, this.connection));
        }
        catch (error) {
            console.log(error);
        }
    }
    async nextSong(player, connection) {
        try {
            console.log();
            if (this.songs.getCurrentQueue().length <= 0) {
                return connection.destroy();
            }
            await this.createAudioStream();
            await this.createAudioResource();
            await player.play(this.audioResource);
        }
        catch (error) {
            console.error(error);
        }
    }
}
exports.AudioPlayer = AudioPlayer;
//# sourceMappingURL=AudioPlayer.js.map