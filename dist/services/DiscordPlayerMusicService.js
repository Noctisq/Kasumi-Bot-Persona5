"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordPlayerMusicService = void 0;
const node_stream_1 = require("node:stream");
const discord_player_1 = require("discord-player");
const PatchedYoutubeSabrExtractor_1 = require("./extractors/PatchedYoutubeSabrExtractor");
const PoTokenProvider_1 = require("./PoTokenProvider");
class DiscordPlayerMusicService {
    constructor(player) {
        this.player = player;
        this.stateChangeListener = null;
        // Guilds where a skip/previous was issued and we're still waiting on
        // discord-player to resolve + start streaming whatever comes next. Skip
        // and previous are NOT instantaneous — they involve a network round trip
        // to YouTube — so a burst of clicks used to queue up that many concurrent
        // resolutions, each one competing for the same voice connection and
        // slowing every other one down, which is what made the Activity look
        // "hung". This is cleared by the actual player events (see create()
        // below), not a timer, so it always matches how long the transition
        // really takes.
        this.transitioning = new Set();
        // Resolving a stream from YouTube (player request -> decipher -> PO
        // token) is the ~5s bottleneck, measured directly — not the download
        // itself. So instead of waiting for that on every skip/previous, we kick
        // it off ahead of time for whatever's front-of-queue ("next") and
        // top-of-history ("previous") as soon as the current track is confirmed
        // playing, and hand the already-in-flight result to discord-player via
        // onBeforeCreateStream (see create() below) when it's actually needed.
        // Capped at exactly one guess in each direction per guild — no deep
        // prefetching — so a queue edit before the guess is used only wastes at
        // most one YouTube request, not an unbounded number.
        this.prefetchCache = new Map();
    }
    static async create(client) {
        const player = new discord_player_1.Player(client);
        const poTokenProvider = new PoTokenProvider_1.PoTokenProvider();
        await player.extractors.register(PatchedYoutubeSabrExtractor_1.PatchedYoutubeSabrExtractor, { poTokenProvider });
        const service = new DiscordPlayerMusicService(player);
        player.events.on('playerStart', (queue, track) => {
            service.transitioning.delete(queue.guild.id);
            queue.metadata?.channel?.send(`Now playing **${track.title}**!`);
            service.emitState(queue.guild.id);
            service.prefetchUpcoming(queue);
        });
        player.events.on('emptyQueue', (queue) => {
            service.transitioning.delete(queue.guild.id);
            service.clearPrefetch(queue.guild.id);
            queue.metadata?.channel?.send('Queue finished, senpai! See you next time~');
            service.emitState(queue.guild.id);
        });
        player.events.on('playerError', (queue, error) => {
            service.transitioning.delete(queue.guild.id);
            service.clearPrefetch(queue.guild.id);
            console.error('Player error:', error);
            queue.metadata?.channel?.send('Something went wrong while playing that song, senpai. Skipping...');
        });
        player.events.on('error', (queue, error) => {
            service.transitioning.delete(queue.guild.id);
            service.clearPrefetch(queue.guild.id);
            console.error('General player error:', error);
            queue.metadata?.channel?.send('Something broke, senpai. :(');
        });
        player.events.on('playerPause', (queue) => service.emitState(queue.guild.id));
        player.events.on('playerResume', (queue) => service.emitState(queue.guild.id));
        // Deliberately NOT listening to playerSkip or playerFinish: both fire
        // during the handoff between tracks, at a point where queue.currentTrack
        // can still resolve to the OLD track's (not-yet-cleared) audio resource
        // instead of the new one. Broadcasting state at that moment sends out
        // stale data that clobbers the optimistic "next track" broadcast
        // skip()/previous() already sent. playerStart (new track actually
        // started) and emptyQueue (nothing left) are the only trustworthy
        // "the transition is done" signals — every track change reaches one of
        // those two, manual skip/previous included, so nothing is lost by
        // not also broadcasting on these two.
        player.events.on('audioTrackAdd', (queue) => {
            service.emitState(queue.guild.id);
            service.prefetchUpcoming(queue);
        });
        player.events.on('audioTracksAdd', (queue) => {
            service.emitState(queue.guild.id);
            service.prefetchUpcoming(queue);
        });
        player.events.on('audioTrackRemove', (queue) => {
            service.emitState(queue.guild.id);
            service.prefetchUpcoming(queue);
        });
        player.events.on('audioTracksRemove', (queue) => {
            service.emitState(queue.guild.id);
            service.prefetchUpcoming(queue);
        });
        player.events.on('volumeChange', (queue) => service.emitState(queue.guild.id));
        // Public hook (unlike track.resource, which discord-player's own docs
        // flag as "not useful outside of the library"): called right before
        // discord-player would otherwise ask an extractor to resolve a stream.
        // Returning a stream here short-circuits that resolution; returning
        // null falls through to the normal path.
        (0, discord_player_1.onBeforeCreateStream)(async (track, _queryType, queue) => {
            const slot = service.prefetchCache.get(queue.guild.id);
            if (!slot)
                return null;
            const direction = slot.next?.trackUrl === track.url ? 'next' : slot.previous?.trackUrl === track.url ? 'previous' : null;
            if (!direction)
                return null;
            const entry = slot[direction];
            slot[direction] = null;
            if (!entry)
                return null;
            try {
                const streamable = await entry.streamPromise;
                return streamable instanceof node_stream_1.Readable ? streamable : null;
            }
            catch {
                return null;
            }
        });
        return service;
    }
    async search(query, requestedBy) {
        // YoutubeSabrExtractor solo acepta URLs de YouTube directas o queries con
        // prefijo `ytsearch:`; texto de búsqueda plano lo rechaza en silencio.
        const result = await this.player.search(`ytsearch:${query}`, {
            requestedBy,
            searchEngine: discord_player_1.QueryType.AUTO,
        });
        return result.tracks.map(track => this.toTrackInfo(track));
    }
    async searchTracks(query) {
        const result = await this.player.search(`ytsearch:${query}`, {
            searchEngine: discord_player_1.QueryType.AUTO,
        });
        return result.tracks.map(track => this.toTrackInfo(track));
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
    async addTrackToQueue(guildId, voiceChannelId, requestedByUserId, url) {
        const channel = await this.player.client.channels.fetch(voiceChannelId);
        if (!channel || !channel.isVoiceBased()) {
            throw new Error('El canal indicado no es un canal de voz válido.');
        }
        const requestedBy = await this.player.client.users.fetch(requestedByUserId);
        // Same "snapshot before play()" reasoning as enqueue() above.
        const existingQueue = this.player.nodes.get(guildId);
        const startedFresh = !existingQueue || (!existingQueue.node.isPlaying() && existingQueue.tracks.size === 0);
        // No text-channel metadata here on purpose: the Activity already shows
        // live state, so we don't also want a duplicate "Now playing" chat
        // message for queues started this way. Guilds with a queue already
        // created via /play keep getting those messages as before.
        await this.player.play(channel, url, { requestedBy });
        return { startedFresh };
    }
    removeTrackFromQueue(guildId, url) {
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return false;
        const track = queue.tracks.data.find(t => t.url === url);
        if (!track)
            return false;
        return queue.node.remove(track) !== null;
    }
    moveTrackInQueue(guildId, url, toIndex) {
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return false;
        const track = queue.tracks.data.find(t => t.url === url);
        if (!track)
            return false;
        // Not using queue.node.move() here: internally it does remove()+insert(),
        // and remove() always emits audioTrackRemove — which our listener turns
        // into a state broadcast with the track already gone but not yet
        // reinserted. Clients receiving that transient state see the queue
        // snap back to (roughly) its pre-move order for a moment. Suppressing
        // that intermediate emit and only emitting once, after the track is
        // back in its new spot, avoids the flash entirely.
        const removed = queue.node.remove(track, false);
        if (!removed)
            return false;
        queue.node.insert(removed, toIndex);
        this.emitState(guildId);
        // Suppressing remove/insert's own events (above) also means the
        // prefetch listener never saw this mutation — recompute by hand so a
        // reorder doesn't leave a stale "next" prefetch pointed at a track
        // that's no longer at the front of the queue.
        this.prefetchUpcoming(queue);
        return true;
    }
    setVolume(guildId, volume) {
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return false;
        return queue.node.setVolume(Math.min(100, Math.max(0, volume)));
    }
    getState(guildId) {
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return null;
        const currentTrack = queue.currentTrack;
        return {
            isPlaying: queue.node.isPlaying(),
            isPaused: queue.node.isPaused(),
            currentTrack: currentTrack ? this.toTrackInfo(currentTrack) : null,
            positionMS: queue.node.getTimestamp()?.current.value ?? 0,
            queue: queue.tracks.data.map(track => this.toTrackInfo(track)),
            volume: queue.node.volume,
        };
    }
    togglePlayback(guildId) {
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return false;
        return queue.node.setPaused(!queue.node.isPaused());
    }
    skip(guildId) {
        if (this.transitioning.has(guildId))
            return false;
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return false;
        this.transitioning.add(guildId);
        // Show the switch immediately instead of waiting on the network round
        // trip to resolve + start streaming the next track — that's what made
        // skip/previous feel stuck. The upcoming track is known synchronously
        // (front of the queue), so we can broadcast it as "now playing" right
        // away; the real playerStart broadcast that follows just confirms it.
        this.emitOptimisticTransition(guildId, queue.tracks.data[0] ?? null, queue.tracks.data.slice(1));
        const skipped = queue.node.skip();
        // skip() itself was a no-op (e.g. nothing playing) — nothing will fire
        // the events that would otherwise clear this, so clear it ourselves.
        if (!skipped)
            this.transitioning.delete(guildId);
        return skipped;
    }
    async previous(guildId) {
        if (this.transitioning.has(guildId))
            return false;
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return false;
        this.transitioning.add(guildId);
        // Same reasoning as skip() above. GuildQueueHistory.previous() puts the
        // current track back at the front of the upcoming queue once it runs,
        // so we predict that same shape here.
        const upcoming = queue.currentTrack ? [queue.currentTrack, ...queue.tracks.data] : queue.tracks.data;
        this.emitOptimisticTransition(guildId, queue.history.previousTrack, upcoming);
        try {
            await queue.history.previous();
            return true;
        }
        catch (error) {
            console.error('Failed to go to previous track:', error);
            this.transitioning.delete(guildId);
            return false;
        }
    }
    emitOptimisticTransition(guildId, predictedTrack, upcoming) {
        if (!this.stateChangeListener)
            return;
        const queue = this.player.nodes.get(guildId);
        if (!queue)
            return;
        this.stateChangeListener(guildId, {
            isPlaying: true,
            isPaused: false,
            currentTrack: predictedTrack ? this.toTrackInfo(predictedTrack) : null,
            positionMS: 0,
            queue: upcoming.map(track => this.toTrackInfo(track)),
            volume: queue.node.volume,
        });
    }
    onStateChange(listener) {
        this.stateChangeListener = listener;
    }
    emitState(guildId) {
        if (!this.stateChangeListener)
            return;
        const state = this.getState(guildId);
        if (state)
            this.stateChangeListener(guildId, state);
    }
    prefetchUpcoming(queue) {
        this.prefetchTrack(queue.guild.id, 'next', queue.tracks.data[0] ?? null);
        this.prefetchTrack(queue.guild.id, 'previous', queue.history.previousTrack);
    }
    prefetchTrack(guildId, direction, track) {
        const slot = this.prefetchCache.get(guildId) ?? { next: null, previous: null };
        this.prefetchCache.set(guildId, slot);
        if (!track) {
            slot[direction] = null;
            return;
        }
        // Already prefetching (or holding) exactly this track — nothing to do.
        if (slot[direction]?.trackUrl === track.url)
            return;
        const extractor = this.player.extractors.get(PatchedYoutubeSabrExtractor_1.PatchedYoutubeSabrExtractor.identifier);
        if (!extractor)
            return;
        const streamPromise = extractor.stream(track);
        // Prefetches are speculative — nobody awaits this directly until (and
        // unless) onBeforeCreateStream picks it up, so swallow a failure here
        // purely to avoid an unhandled rejection warning.
        streamPromise.catch(() => { });
        slot[direction] = { trackUrl: track.url, streamPromise };
    }
    clearPrefetch(guildId) {
        const slot = this.prefetchCache.get(guildId);
        if (!slot)
            return;
        this.prefetchCache.delete(guildId);
        for (const entry of [slot.next, slot.previous]) {
            if (!entry)
                continue;
            entry.streamPromise
                .then((streamable) => {
                if (streamable instanceof node_stream_1.Readable && !streamable.destroyed)
                    streamable.destroy();
            })
                .catch(() => { });
        }
    }
    toTrackInfo(track) {
        return {
            title: track.title,
            author: track.author,
            url: track.url,
            thumbnail: track.thumbnail,
            duration: track.duration,
            durationMS: track.durationMS,
        };
    }
}
exports.DiscordPlayerMusicService = DiscordPlayerMusicService;
//# sourceMappingURL=DiscordPlayerMusicService.js.map