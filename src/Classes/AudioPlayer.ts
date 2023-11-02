import { SongQueue } from "./SongQueue";

const { stream } = require('play-dl');
const {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
} = require('@discordjs/voice');

export class AudioPlayer {
    private static instance: AudioPlayer;
    public songs: SongQueue;
    public connection;
    public audioStream;
    public audioResource;

    private constructor() {
    }

    public static getInstance() {
        if (!AudioPlayer.instance) {
            AudioPlayer.instance = new AudioPlayer()
        }
        return AudioPlayer.instance;

    }

    public initialize(songsToAdd, connection) {
        this.songs = new SongQueue(songsToAdd);
        this.connection = connection;
    }

    async createAudioStream() {
        this.audioStream = await stream(this.songs.playNext(), {
            discordPlayerCompatibility: true
        });
    };

    async createAudioResource() {

        this.audioResource = await createAudioResource(this.audioStream.stream, { inputType: stream.type });
    };

    async createAudioPlayer() {
        return await createAudioPlayer();
    };

    async playMusic() {
        try {
            const player = await createAudioPlayer();
            await this.createAudioStream();
            await this.createAudioResource();
            await player.play(this.audioResource)
            await this.connection.subscribe(player);
            console.log('solo deberia de aparecer una vez en play music')
            player.on(AudioPlayerStatus.Idle, () => this.nextSong(player, this.connection));
        } catch (error) {
            console.log(error);
        }



    }
    async nextSong(player, connection) {
        try {
            console.log()
            if (this.songs.getCurrentQueue().length <= 0) {
                return connection.destroy();
            }
            await this.createAudioStream();
            await this.createAudioResource();
            await player.play(this.audioResource);
        } catch (error) {
            console.error(error);
        }


    }
}