export class SongQueue {
    public queue;
    constructor(songs) {
        this.queue = songs;
    }

    addSong(song) {
        this.queue.push(song);
    }

    playNext() {
        if (this.queue.length > 0) {
            const nextSong = this.queue.shift();
            console.log("songs being reproduced: ", nextSong ,"CURRENT LIST: ",this.queue);

            return nextSong;
        }
        return null; // Queue is empty
    }

    getCurrentQueue() {
        return this.queue;
    }
}