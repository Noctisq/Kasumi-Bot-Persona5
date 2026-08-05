import http from 'node:http';
import path from 'node:path';
import express, { Application, Request, Response as ExpressResponse } from 'express';
import WebSocket, { WebSocketServer, RawData } from 'ws';
import { MusicPlayer, PlayerState } from '../interface/MusicPlayer.interface';

type ClientMessage =
  | { type: 'join'; guildId: string }
  | { type: 'command'; action: 'toggle' | 'skip' | 'previous' }
  | { type: 'search'; requestId: string; query: string }
  | { type: 'queueAdd'; voiceChannelId: string; userId: string; url: string }
  | { type: 'queueRemove'; url: string }
  | { type: 'queueMove'; url: string; toIndex: number }
  | { type: 'setVolume'; value: number };

const PROGRESS_TICK_MS = 3000;
// Playback transitions (skip/previous/toggle) involve async work downstream
// in discord-player (resolving and streaming the next track) — firing many
// of them back to back, whether from one person double/triple-clicking or
// several people clicking at once, piles up overlapping transitions and
// floods every connected client with state broadcasts. One accepted command
// per guild per window is plenty for a media player; the rest are just
// dropped, same as a real player ignoring extra key-repeats.
const COMMAND_COOLDOWN_MS = 350;

export class ActivityGateway {
  private readonly app: Application;
  private readonly server: http.Server;
  private readonly wss: WebSocketServer;
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly socketGuild = new WeakMap<WebSocket, string>();
  private readonly lastCommandAt = new Map<string, number>();

  constructor(private readonly musicPlayer: MusicPlayer, private readonly port: number) {
    this.app = express();
    this.app.use(express.json());

    if (process.env.NODE_ENV === 'production') {
      const clientBuildPath = path.join(__dirname, '../../activity/packages/client/dist');
      this.app.use(express.static(clientBuildPath));
    }

    this.app.post('/api/token', (req, res) => {
      this.handleTokenExchange(req, res).catch((error) => {
        console.error('Activity token exchange failed:', error);
        res.status(500).send({ error: 'token_exchange_failed' });
      });
    });

    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: '/api/ws' });
    this.wss.on('connection', (socket) => this.handleConnection(socket));

    this.musicPlayer.onStateChange((guildId, state) => this.broadcast(guildId, state));

    setInterval(() => this.tickProgress(), PROGRESS_TICK_MS);
  }

  start(): void {
    this.server.listen(this.port, () => {
      console.log(`Activity gateway listening on port ${this.port}`);
    });
  }

  private async handleTokenExchange(req: Request, res: ExpressResponse): Promise<void> {
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

    const { access_token } = (await response.json()) as { access_token: string };
    res.send({ access_token });
  }

  private handleConnection(socket: WebSocket): void {
    socket.on('message', (raw) => this.handleMessage(socket, raw));
    socket.on('close', () => this.leaveRoom(socket));
  }

  private handleMessage(socket: WebSocket, raw: RawData): void {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message.type === 'join') {
      this.joinRoom(socket, message.guildId);
      const state = this.musicPlayer.getState(message.guildId);
      if (state) socket.send(JSON.stringify({ type: 'state', state }));
      return;
    }

    if (message.type === 'command') {
      const guildId = this.socketGuild.get(socket);
      if (!guildId) return;
      if (!this.allowCommand(guildId)) return;
      this.runCommand(guildId, message.action);
      return;
    }

    if (message.type === 'search') {
      this.handleSearch(socket, message.requestId, message.query);
      return;
    }

    if (message.type === 'queueAdd') {
      const guildId = this.socketGuild.get(socket);
      if (!guildId) return;
      this.handleQueueAdd(socket, guildId, message.voiceChannelId, message.userId, message.url);
      return;
    }

    if (message.type === 'queueRemove') {
      const guildId = this.socketGuild.get(socket);
      if (!guildId) return;
      this.musicPlayer.removeTrackFromQueue(guildId, message.url);
      return;
    }

    if (message.type === 'queueMove') {
      const guildId = this.socketGuild.get(socket);
      if (!guildId) return;
      this.musicPlayer.moveTrackInQueue(guildId, message.url, message.toIndex);
      return;
    }

    if (message.type === 'setVolume') {
      const guildId = this.socketGuild.get(socket);
      if (!guildId) return;
      this.musicPlayer.setVolume(guildId, message.value);
    }
  }

  private handleSearch(socket: WebSocket, requestId: string, query: string): void {
    this.musicPlayer
      .searchTracks(query)
      .then((results) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'searchResults', requestId, results }));
        }
      })
      .catch((error) => {
        console.error('Activity search failed:', error);
        this.sendError(socket, 'No pude buscar esa canción, senpai.');
      });
  }

  private handleQueueAdd(
    socket: WebSocket,
    guildId: string,
    voiceChannelId: string,
    userId: string,
    url: string
  ): void {
    this.musicPlayer.addTrackToQueue(guildId, voiceChannelId, userId, url).catch((error) => {
      console.error('Activity queue add failed:', error);
      this.sendError(socket, 'No pude agregar esa canción, senpai.');
    });
  }

  private sendError(socket: WebSocket, message: string): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'error', message }));
    }
  }

  private allowCommand(guildId: string): boolean {
    const now = Date.now();
    const last = this.lastCommandAt.get(guildId) ?? 0;
    if (now - last < COMMAND_COOLDOWN_MS) return false;
    this.lastCommandAt.set(guildId, now);
    return true;
  }

  private runCommand(guildId: string, action: 'toggle' | 'skip' | 'previous'): void {
    if (action === 'toggle') this.musicPlayer.togglePlayback(guildId);
    else if (action === 'skip') this.musicPlayer.skip(guildId);
    else if (action === 'previous') void this.musicPlayer.previous(guildId);
  }

  private joinRoom(socket: WebSocket, guildId: string): void {
    this.leaveRoom(socket);
    this.socketGuild.set(socket, guildId);
    if (!this.rooms.has(guildId)) this.rooms.set(guildId, new Set());
    this.rooms.get(guildId)!.add(socket);
  }

  private leaveRoom(socket: WebSocket): void {
    const guildId = this.socketGuild.get(socket);
    if (!guildId) return;
    this.rooms.get(guildId)?.delete(socket);
    this.socketGuild.delete(socket);
  }

  private broadcast(guildId: string, state: PlayerState): void {
    const sockets = this.rooms.get(guildId);
    if (!sockets || sockets.size === 0) return;

    const payload = JSON.stringify({ type: 'state', state });
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  private tickProgress(): void {
    for (const [guildId, sockets] of this.rooms) {
      if (sockets.size === 0) continue;
      const state = this.musicPlayer.getState(guildId);
      if (state?.isPlaying) this.broadcast(guildId, state);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries once on a 429, waiting the amount of time Discord tells us to via
// the retry_after header — ported from the old activity/packages/server.
async function fetchAndRetry(input: RequestInfo, init?: RequestInit, nRetries = 3): Promise<Response> {
  try {
    const response = await fetch(input, init);

    if (response.status === 429 && nRetries > 0) {
      const retryAfter = Number(response.headers.get('retry_after'));
      if (Number.isNaN(retryAfter)) return response;
      await sleep(retryAfter * 1000);
      return await fetchAndRetry(input, init, nRetries - 1);
    }
    return response;
  } catch (ex) {
    if (nRetries <= 0) throw ex;
    await sleep(1000);
    return await fetchAndRetry(input, init, nRetries - 1);
  }
}
