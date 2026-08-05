"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityGateway = void 0;
const node_http_1 = __importDefault(require("node:http"));
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const ws_1 = __importStar(require("ws"));
const PROGRESS_TICK_MS = 3000;
// Playback transitions (skip/previous/toggle) involve async work downstream
// in discord-player (resolving and streaming the next track) — firing many
// of them back to back, whether from one person double/triple-clicking or
// several people clicking at once, piles up overlapping transitions and
// floods every connected client with state broadcasts. One accepted command
// per guild per window is plenty for a media player; the rest are just
// dropped, same as a real player ignoring extra key-repeats.
const COMMAND_COOLDOWN_MS = 350;
class ActivityGateway {
    constructor(musicPlayer, port) {
        this.musicPlayer = musicPlayer;
        this.port = port;
        this.rooms = new Map();
        this.socketGuild = new WeakMap();
        this.lastCommandAt = new Map();
        this.app = (0, express_1.default)();
        this.app.use(express_1.default.json());
        if (process.env.NODE_ENV === 'production') {
            const clientBuildPath = node_path_1.default.join(__dirname, '../../activity/packages/client/dist');
            this.app.use(express_1.default.static(clientBuildPath));
        }
        this.app.post('/api/token', (req, res) => {
            this.handleTokenExchange(req, res).catch((error) => {
                console.error('Activity token exchange failed:', error);
                res.status(500).send({ error: 'token_exchange_failed' });
            });
        });
        this.server = node_http_1.default.createServer(this.app);
        this.wss = new ws_1.WebSocketServer({ server: this.server, path: '/api/ws' });
        this.wss.on('connection', (socket) => this.handleConnection(socket));
        this.musicPlayer.onStateChange((guildId, state) => this.broadcast(guildId, state));
        setInterval(() => this.tickProgress(), PROGRESS_TICK_MS);
    }
    start() {
        this.server.listen(this.port, () => {
            console.log(`Activity gateway listening on port ${this.port}`);
        });
    }
    async handleTokenExchange(req, res) {
        const response = await fetchAndRetry('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID ?? '',
                client_secret: process.env.CLIENT_SECRET ?? '',
                grant_type: 'authorization_code',
                code: req.body.code,
            }),
        });
        const { access_token } = (await response.json());
        res.send({ access_token });
    }
    handleConnection(socket) {
        socket.on('message', (raw) => this.handleMessage(socket, raw));
        socket.on('close', () => this.leaveRoom(socket));
    }
    handleMessage(socket, raw) {
        let message;
        try {
            message = JSON.parse(raw.toString());
        }
        catch {
            return;
        }
        if (message.type === 'join') {
            this.joinRoom(socket, message.guildId);
            const state = this.musicPlayer.getState(message.guildId);
            if (state)
                socket.send(JSON.stringify({ type: 'state', state }));
            return;
        }
        if (message.type === 'command') {
            const guildId = this.socketGuild.get(socket);
            if (!guildId)
                return;
            if (!this.allowCommand(guildId))
                return;
            this.runCommand(guildId, message.action);
            return;
        }
        if (message.type === 'search') {
            this.handleSearch(socket, message.requestId, message.query);
            return;
        }
        if (message.type === 'queueAdd') {
            const guildId = this.socketGuild.get(socket);
            if (!guildId)
                return;
            this.handleQueueAdd(socket, guildId, message.voiceChannelId, message.userId, message.url);
            return;
        }
        if (message.type === 'queueRemove') {
            const guildId = this.socketGuild.get(socket);
            if (!guildId)
                return;
            this.musicPlayer.removeTrackFromQueue(guildId, message.url);
            return;
        }
        if (message.type === 'queueMove') {
            const guildId = this.socketGuild.get(socket);
            if (!guildId)
                return;
            this.musicPlayer.moveTrackInQueue(guildId, message.url, message.toIndex);
            return;
        }
        if (message.type === 'setVolume') {
            const guildId = this.socketGuild.get(socket);
            if (!guildId)
                return;
            this.musicPlayer.setVolume(guildId, message.value);
        }
    }
    handleSearch(socket, requestId, query) {
        this.musicPlayer
            .searchTracks(query)
            .then((results) => {
            if (socket.readyState === ws_1.default.OPEN) {
                socket.send(JSON.stringify({ type: 'searchResults', requestId, results }));
            }
        })
            .catch((error) => {
            console.error('Activity search failed:', error);
            this.sendError(socket, 'No pude buscar esa canción, senpai.');
        });
    }
    handleQueueAdd(socket, guildId, voiceChannelId, userId, url) {
        this.musicPlayer.addTrackToQueue(guildId, voiceChannelId, userId, url).catch((error) => {
            console.error('Activity queue add failed:', error);
            this.sendError(socket, 'No pude agregar esa canción, senpai.');
        });
    }
    sendError(socket, message) {
        if (socket.readyState === ws_1.default.OPEN) {
            socket.send(JSON.stringify({ type: 'error', message }));
        }
    }
    allowCommand(guildId) {
        const now = Date.now();
        const last = this.lastCommandAt.get(guildId) ?? 0;
        if (now - last < COMMAND_COOLDOWN_MS)
            return false;
        this.lastCommandAt.set(guildId, now);
        return true;
    }
    runCommand(guildId, action) {
        if (action === 'toggle')
            this.musicPlayer.togglePlayback(guildId);
        else if (action === 'skip')
            this.musicPlayer.skip(guildId);
        else if (action === 'previous')
            void this.musicPlayer.previous(guildId);
    }
    joinRoom(socket, guildId) {
        this.leaveRoom(socket);
        this.socketGuild.set(socket, guildId);
        if (!this.rooms.has(guildId))
            this.rooms.set(guildId, new Set());
        this.rooms.get(guildId).add(socket);
    }
    leaveRoom(socket) {
        const guildId = this.socketGuild.get(socket);
        if (!guildId)
            return;
        this.rooms.get(guildId)?.delete(socket);
        this.socketGuild.delete(socket);
    }
    broadcast(guildId, state) {
        const sockets = this.rooms.get(guildId);
        if (!sockets || sockets.size === 0)
            return;
        const payload = JSON.stringify({ type: 'state', state });
        for (const socket of sockets) {
            if (socket.readyState === ws_1.default.OPEN)
                socket.send(payload);
        }
    }
    tickProgress() {
        for (const [guildId, sockets] of this.rooms) {
            if (sockets.size === 0)
                continue;
            const state = this.musicPlayer.getState(guildId);
            if (state?.isPlaying)
                this.broadcast(guildId, state);
        }
    }
}
exports.ActivityGateway = ActivityGateway;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Retries once on a 429, waiting the amount of time Discord tells us to via
// the retry_after header — ported from the old activity/packages/server.
async function fetchAndRetry(input, init, nRetries = 3) {
    try {
        const response = await fetch(input, init);
        if (response.status === 429 && nRetries > 0) {
            const retryAfter = Number(response.headers.get('retry_after'));
            if (Number.isNaN(retryAfter))
                return response;
            await sleep(retryAfter * 1000);
            return await fetchAndRetry(input, init, nRetries - 1);
        }
        return response;
    }
    catch (ex) {
        if (nRetries <= 0)
            throw ex;
        await sleep(1000);
        return await fetchAndRetry(input, init, nRetries - 1);
    }
}
//# sourceMappingURL=ActivityGateway.js.map