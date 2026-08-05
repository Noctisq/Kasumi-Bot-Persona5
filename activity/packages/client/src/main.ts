import type { CommandResponse } from '@discord/embedded-app-sdk';
import './style.css';
import { discordSdk } from './discordSdk';
import heroImage from './images/sumire_kasumi.png';

type Auth = CommandResponse<'authenticate'>;
let auth: Auth;

// Mirrors src/interface/MusicPlayer.interface.ts on the bot side. Kept as a
// plain duplicate rather than a shared package — client and server are
// separate TS projects and this shape is small/stable enough not to be
// worth the extra build wiring.
interface MusicTrack {
	title: string;
	author: string;
	url: string;
	thumbnail: string;
	duration: string;
}

interface PlayerTrackInfo extends MusicTrack {
	durationMS: number;
}

interface PlayerState {
	isPlaying: boolean;
	isPaused: boolean;
	currentTrack: PlayerTrackInfo | null;
	positionMS: number;
	queue: PlayerTrackInfo[];
	volume: number;
}

type CommandAction = 'toggle' | 'skip' | 'previous';

async function setupDiscordSdk() {
	await discordSdk.ready();

	const { code } = await discordSdk.commands.authorize({
		client_id: import.meta.env.VITE_CLIENT_ID,
		response_type: 'code',
		state: '',
		prompt: 'none',
		scope: ['applications.commands', 'identify', 'guilds', 'guilds.members.read', 'rpc.voice.read'],
	});

	// Retrieve an access_token from our activity's server
	const response = await fetch('/api/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code }),
	});
	const tokenPayload = await response.json();
	if (!response.ok || !tokenPayload.access_token) {
		throw new Error(`Token exchange failed: ${JSON.stringify(tokenPayload)}`);
	}

	auth = await discordSdk.commands.authenticate({ access_token: tokenPayload.access_token });

	if (auth == null) {
		throw new Error('Authenticate command failed');
	}
}

function formatError(error: unknown): string {
	if (error instanceof Error) return error.message;
	try {
		return JSON.stringify(error, null, 2);
	} catch {
		return String(error);
	}
}

// Surfaces a failed setupDiscordSdk() (rate limit, expired session, etc.)
// as something visible. Without this, a failure here was silent: the
// WebSocket never connects, so every search/command afterwards just
// quietly no-ops — indistinguishable from "there are no results" unless
// you go digging in the console.
//
// No retry button on purpose: the one real-world trigger we've hit
// ("The resource is being rate limited") comes from Discord's own native
// client, outside @discord/embedded-app-sdk entirely — confirmed by
// grepping the SDK's bundled source, that exact string isn't in there.
// There's no retry_after or any other timing info exposed to us for it,
// so a retry button could only ever hit the same still-active limit again
// with no way to know when it'll actually help.
function showConnectionError(message: string): void {
	if (document.getElementById('connection-banner')) return;
	const banner = document.createElement('div');
	banner.id = 'connection-banner';
	banner.className = 'connection-banner';
	banner.textContent = message;
	document.body.appendChild(banner);
}

function escapeHtml(value: string): string {
	const div = document.createElement('div');
	div.textContent = value;
	return div.innerHTML;
}

function formatTime(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function renderChannelLabel() {
	let channelName = 'canal desconocido';

	if (discordSdk.channelId != null && discordSdk.guildId != null) {
		const channel = await discordSdk.commands.getChannel({ channel_id: discordSdk.channelId });
		if (channel.name != null) channelName = channel.name;
	}

	const label = document.getElementById('channel-label');
	if (label) label.textContent = `#${channelName}`;
}

function renderPlayerMockup() {
	const app = document.querySelector<HTMLDivElement>('#app');
	if (!app) throw new Error('Could not find #app element');

	app.innerHTML = `
		<div class="hero-bg">
			<img src="${heroImage}" alt="Sumire" />
		</div>
		<div class="ray-burst"></div>
		<div class="panel-backdrop" id="panel-backdrop"></div>
		<div class="app-shell">
			<div class="now-playing-card">
				<div class="track-row">
					<img class="art" id="art" src="${heroImage}" alt="" />
					<div class="track-meta">
						<div class="track-title" id="track-title">Nada sonando</div>
						<div class="track-artist" id="track-artist">Usa /play o busca algo aquí</div>
						<div class="channel-label" id="channel-label"></div>
					</div>
					<div class="track-actions">
						<button class="icon-btn" id="panel-toggle" aria-label="Buscar / Cola"><span>🔍</span></button>
					</div>
				</div>
				<div class="scrubber">
					<div class="scrubber-track"><div class="scrubber-fill" id="progress-fill"></div></div>
					<div class="scrubber-times">
						<span id="time-elapsed">0:00</span>
						<span id="time-remaining">-0:00</span>
					</div>
				</div>
				<div class="transport">
					<button class="transport-btn" data-action="previous" aria-label="Anterior"><span>⏮</span></button>
					<button class="transport-btn transport-btn--main" data-action="toggle" aria-label="Reproducir"><span>▶</span></button>
					<button class="transport-btn" data-action="skip" aria-label="Siguiente"><span>⏭</span></button>
				</div>
				<div class="volume-row">
					<span class="volume-icon">🔈</span>
					<input type="range" min="0" max="100" value="100" class="volume-slider" id="volume-slider" />
					<span class="volume-icon">🔊</span>
				</div>
			</div>
			<div class="side-panel" id="side-panel">
				<div class="side-panel-body">
					<span class="side-panel-title" id="side-panel-title">A continuación</span>
					<form id="search-form">
						<input type="text" class="search-input" id="search-input" placeholder="Buscar canción o pegar link..." />
					</form>
					<div class="track-list" id="unified-list"></div>
				</div>
			</div>
		</div>
	`;

	app.querySelectorAll<HTMLButtonElement>('.transport-btn').forEach((button) => {
		button.addEventListener('click', () => {
			if (button.disabled) return;
			sendCommand(button.dataset.action as CommandAction);
			// Brief lockout so a rapid burst of clicks (or an impatient
			// double-tap) can't flood the gateway with duplicate commands —
			// mirrors the cooldown enforced server-side.
			button.disabled = true;
			setTimeout(() => {
				button.disabled = false;
			}, 400);
		});
	});

	document.getElementById('panel-toggle')?.addEventListener('click', togglePanel);
	document.getElementById('panel-backdrop')?.addEventListener('click', () => {
		if (!WIDE_LAYOUT_QUERY.matches) togglePanel();
	});
	document.getElementById('search-form')?.addEventListener('submit', handleSearchSubmit);
	document.getElementById('search-input')?.addEventListener('input', handleSearchInput);
	setupVolumeSlider();
}

// Sizes and moves .ray-burst so ITS OWN center lands exactly on the album
// art's real screen position (measured, not guessed) — the CSS gradient then
// just radiates from its own default center, so no offset math can drift out
// of sync. Generously larger than the viewport so the rays always reach
// every edge no matter where the art ends up.
function positionRayBurst() {
	const art = document.getElementById('art');
	const burst = document.querySelector<HTMLDivElement>('.ray-burst');
	if (!art || !burst) return;

	const artRect = art.getBoundingClientRect();
	const centerX = artRect.left + artRect.width / 2;
	const centerY = artRect.top + artRect.height / 2;
	const size = Math.max(window.innerWidth, window.innerHeight) * 2.4;

	burst.style.width = `${size}px`;
	burst.style.height = `${size}px`;
	burst.style.left = `${centerX - size / 2}px`;
	burst.style.top = `${centerY - size / 2}px`;
}

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePositionRayBurst() {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(positionRayBurst, 100);
}

// --- Realtime sync with the bot ---------------------------------------

let socket: WebSocket | null = null;
let latestState: PlayerState | null = null;
let stateReceivedAt = 0;
let lastThumbnail: string | null = null;
let isDraggingVolume = false;
let draggedUrl: string | null = null;
let draggedRow: HTMLDivElement | null = null;
let isDragging = false;
let searchResults: MusicTrack[] | null = null;
const pendingSearches = new Map<string, (results: MusicTrack[]) => void>();

// Discord's Activity sandbox blocks requests to domains that aren't
// registered as a URL Mapping in the Developer Portal — plain <img src>
// to an external host gets silently blocked (this isn't something
// patchUrlMappings from the SDK covers, since that only patches
// fetch/WebSocket/XHR, not native <img> loads). So we rewrite the URL
// ourselves to go through the mapped proxy path instead.
// Requires a URL Mapping in the Dev Portal: Prefix "/images", Target "i.ytimg.com".
function toProxiedThumbnail(url: string): string {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === 'i.ytimg.com') {
			return `/images${parsed.pathname}${parsed.search}`;
		}
	} catch {
		// not a valid absolute URL, fall through and use it as-is
	}
	return url;
}

// Swaps the small album art between the real track thumbnail and Sumire's
// art (used as a placeholder when nothing is playing). Skips DOM work when
// the source hasn't changed so we don't re-fetch/flicker on every progress
// tick — the background itself stays static (see .hero-bg), only this small
// square swaps per track.
function setArt(thumbnailUrl: string | undefined) {
	const url = thumbnailUrl ?? null;
	if (url === lastThumbnail) return;
	lastThumbnail = url;

	const art = document.getElementById('art') as HTMLImageElement | null;
	if (!art) return;

	art.src = url ? toProxiedThumbnail(url) : heroImage;
}

function connectWebSocket() {
	if (discordSdk.guildId == null) return;

	const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	socket = new WebSocket(`${protocol}//${location.host}/api/ws`);

	socket.addEventListener('open', () => {
		socket?.send(JSON.stringify({ type: 'join', guildId: discordSdk.guildId }));
	});

	socket.addEventListener('message', (event) => {
		try {
			const message = JSON.parse(event.data);
			if (message.type === 'state') {
				applyState(message.state);
			} else if (message.type === 'searchResults') {
				const resolve = pendingSearches.get(message.requestId);
				if (resolve) {
					pendingSearches.delete(message.requestId);
					resolve(message.results);
				}
			} else if (message.type === 'error') {
				console.warn('[Kasumi Player] error del servidor:', message.message);
			}
		} catch (error) {
			console.warn('[Kasumi Player] mensaje de WS inválido:', error);
		}
	});

	socket.addEventListener('close', () => {
		socket = null;
		setTimeout(connectWebSocket, 2000);
	});
}

function sendCommand(action: CommandAction) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'command', action }));
	}
}

function sendSearch(query: string): Promise<MusicTrack[]> {
	return new Promise((resolve) => {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			resolve([]);
			return;
		}
		const requestId = crypto.randomUUID();
		pendingSearches.set(requestId, resolve);
		socket.send(JSON.stringify({ type: 'search', requestId, query }));
	});
}

function sendQueueAdd(url: string) {
	if (!socket || socket.readyState !== WebSocket.OPEN) return;
	if (discordSdk.channelId == null || auth?.user?.id == null) return;
	socket.send(
		JSON.stringify({ type: 'queueAdd', voiceChannelId: discordSdk.channelId, userId: auth.user.id, url }),
	);
}

function sendQueueRemove(url: string) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'queueRemove', url }));
	}
}

function sendQueueMove(url: string, toIndex: number) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'queueMove', url, toIndex }));
	}
}

function sendVolume(value: number) {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'setVolume', value }));
	}
}

// --- Unified search/queue panel -----------------------------------------

// Above this width there's room for the player and the panel side by side
// (see the matching breakpoint in style.css), so the panel stays open all
// the time and the backdrop/modal treatment is disabled entirely — below
// it, the panel is a toggleable modal with a dark backdrop.
const WIDE_LAYOUT_QUERY = window.matchMedia('(min-width: 900px)');

function togglePanel() {
	const panel = document.getElementById('side-panel');
	const toggleBtn = document.getElementById('panel-toggle');
	const backdrop = document.getElementById('panel-backdrop');
	if (!panel || !toggleBtn) return;

	const opening = !panel.classList.contains('side-panel--open');
	panel.classList.toggle('side-panel--open', opening);
	backdrop?.classList.toggle('panel-backdrop--open', opening);
	toggleBtn.classList.toggle('icon-btn--active', opening);

	if (opening) {
		renderUnifiedList();
		document.getElementById('search-input')?.focus();
	}
}

// Keeps the panel's "open" class in sync with the wide/narrow breakpoint:
// on wide layouts it's always shown (CSS also forces this, this just keeps
// the JS-side open/closed bookkeeping consistent with what's on screen).
function syncPanelForViewport() {
	const panel = document.getElementById('side-panel');
	if (!panel) return;

	if (WIDE_LAYOUT_QUERY.matches) {
		panel.classList.add('side-panel--open');
		document.getElementById('panel-backdrop')?.classList.remove('panel-backdrop--open');
		renderUnifiedList();
	}
}

function isPanelOpen(): boolean {
	return document.getElementById('side-panel')?.classList.contains('side-panel--open') ?? false;
}

async function handleSearchSubmit(event: SubmitEvent) {
	event.preventDefault();
	const input = document.getElementById('search-input') as HTMLInputElement | null;
	const query = input?.value.trim();
	const list = document.getElementById('unified-list');
	if (!query || !list) return;

	list.innerHTML = '<p class="empty-hint">Buscando...</p>';
	searchResults = await sendSearch(query);
	renderUnifiedList();
}

function handleSearchInput() {
	const input = document.getElementById('search-input') as HTMLInputElement | null;
	if (input && input.value.trim() === '' && searchResults !== null) {
		searchResults = null;
		renderUnifiedList();
	}
}

function trackRowHtml(track: MusicTrack, trailing: string, extraClass = '', position?: number): string {
	const indexHtml = position !== undefined ? `<span class="track-item-index">${position}</span>` : '';
	return `
		<div class="track-item ${extraClass}" data-url="${encodeURIComponent(track.url)}">
			${indexHtml}
			<img class="track-item-art" src="${toProxiedThumbnail(track.thumbnail)}" alt="" />
			<div class="track-item-meta">
				<span class="track-item-title">${escapeHtml(track.title)}</span>
				<span class="track-item-artist">${escapeHtml(track.author)}</span>
			</div>
			${trailing}
		</div>
	`;
}

function renderUnifiedList() {
	const list = document.getElementById('unified-list');
	const titleEl = document.getElementById('side-panel-title');
	if (!list) return;

	if (searchResults !== null) {
		if (titleEl) titleEl.textContent = 'Resultados';
		renderSearchResultsInto(list, searchResults);
	} else {
		if (titleEl) titleEl.textContent = 'A continuación';
		renderQueueInto(list, latestState?.queue ?? []);
	}
}

function renderSearchResultsInto(list: HTMLElement, results: MusicTrack[]) {
	if (results.length === 0) {
		list.innerHTML = '<p class="empty-hint">Sin resultados, senpai.</p>';
		return;
	}

	list.innerHTML = results.map((track) => trackRowHtml(track, '', 'track-item--clickable')).join('');

	list.querySelectorAll<HTMLDivElement>('.track-item--clickable').forEach((row) => {
		row.addEventListener('click', () => {
			const url = row.dataset.url;
			if (!url) return;
			const decodedUrl = decodeURIComponent(url);

			sendQueueAdd(decodedUrl);

			// Immediate feedback that the click registered, then drop the
			// track from the results — "it disappeared" IS the confirmation
			// that it made it into the queue.
			row.classList.add('track-item--added');
			setTimeout(() => {
				searchResults = (searchResults ?? []).filter((track) => track.url !== decodedUrl);
				renderUnifiedList();
			}, 220);
		});
	});
}

function renderQueueInto(list: HTMLElement, queue: PlayerTrackInfo[]) {
	if (queue.length === 0) {
		list.innerHTML = '<p class="empty-hint">La cola está vacía.</p>';
		return;
	}

	list.innerHTML = queue
		.map((track, index) =>
			trackRowHtml(track, '<button class="track-item-remove" aria-label="Quitar">✕</button>', '', index + 1)
		)
		.join('');

	list.querySelectorAll<HTMLButtonElement>('.track-item-remove').forEach((button) => {
		button.addEventListener('click', (event) => {
			event.stopPropagation();
			const url = button.closest<HTMLDivElement>('.track-item')?.dataset.url;
			if (url) sendQueueRemove(decodeURIComponent(url));
		});
	});

	// Drag-and-drop reordering, Apple-Music-style: as you drag over another
	// row, the dragged row actually moves in the DOM right away (live
	// reorder), and every row that shifted as a result animates smoothly
	// from its old position to its new one (the "FLIP" technique — no
	// library needed, just measuring positions before/after the DOM move).
	list.querySelectorAll<HTMLDivElement>('.track-item').forEach((row) => {
		const encodedUrl = row.dataset.url;
		if (!encodedUrl) return;
		const url = decodeURIComponent(encodedUrl);

		row.draggable = true;

		row.addEventListener('dragstart', () => {
			draggedUrl = url;
			draggedRow = row;
			isDragging = true;
			requestAnimationFrame(() => row.classList.add('dragging'));
		});

		row.addEventListener('dragover', (event) => {
			event.preventDefault();
			if (!draggedRow || draggedRow === row) return;
			const rect = row.getBoundingClientRect();
			const insertAfter = event.clientY > rect.top + rect.height / 2;
			reorderQueueRow(list, draggedRow, row, insertAfter);
		});

		row.addEventListener('drop', (event) => {
			event.preventDefault();
			finalizeQueueReorder(list);
		});

		row.addEventListener('dragend', () => {
			row.classList.remove('dragging');
			isDragging = false;
			draggedUrl = null;
			draggedRow = null;
			// Re-render from latestState now that dragging is done: on a
			// successful drop finalizeQueueReorder() already patched
			// latestState.queue to match what's on screen, so this is a
			// silent no-op repaint; on a cancelled drag (dropped outside the
			// list, Escape, etc.) latestState.queue was never touched, so
			// this snaps the preview back to the real order.
			if (isPanelOpen() && searchResults === null) renderUnifiedList();
		});
	});
}

// Moves `draggedRow` to sit before/after `targetRow`, animating every row
// that shifted as a result from its previous screen position to its new
// one (classic FLIP: First/Last positions measured, delta applied as a
// transform, then transitioned away).
function reorderQueueRow(list: HTMLElement, draggedRow: HTMLDivElement, targetRow: HTMLDivElement, insertAfter: boolean) {
	const rows = Array.from(list.querySelectorAll<HTMLDivElement>('.track-item'));
	const firstRects = new Map<HTMLDivElement, DOMRect>();
	rows.forEach((row) => firstRects.set(row, row.getBoundingClientRect()));

	if (insertAfter) {
		targetRow.after(draggedRow);
	} else {
		targetRow.before(draggedRow);
	}

	rows.forEach((row) => {
		const firstRect = firstRects.get(row);
		if (!firstRect) return;
		const lastRect = row.getBoundingClientRect();
		const deltaY = firstRect.top - lastRect.top;
		if (deltaY === 0) return;

		row.style.transition = 'none';
		row.style.transform = `translateY(${deltaY}px)`;
		requestAnimationFrame(() => {
			row.style.transition = 'transform 0.2s ease';
			row.style.transform = '';
		});
	});
}

function finalizeQueueReorder(list: HTMLElement) {
	if (!draggedUrl) return;
	const rows = Array.from(list.querySelectorAll<HTMLDivElement>('.track-item'));
	const toIndex = rows.findIndex((row) => row.dataset.url === encodeURIComponent(draggedUrl as string));
	if (toIndex < 0) return;

	// Patch our own copy of the queue to match what's already on screen
	// (the FLIP reorder already moved the DOM). The confirming broadcast
	// from the server will carry the identical order, so this just makes
	// sure nothing re-renders a stale order in the moment before it
	// arrives — that gap was reading as "the list reverts after the drop".
	if (latestState) {
		const queue = [...latestState.queue];
		const fromIndex = queue.findIndex((track) => track.url === draggedUrl);
		if (fromIndex >= 0) {
			const [moved] = queue.splice(fromIndex, 1);
			queue.splice(toIndex, 0, moved);
			latestState = { ...latestState, queue };
		}
	}

	sendQueueMove(draggedUrl, toIndex);
}

function setupVolumeSlider() {
	const slider = document.getElementById('volume-slider') as HTMLInputElement | null;
	if (!slider) return;

	slider.addEventListener('pointerdown', () => {
		isDraggingVolume = true;
	});
	slider.addEventListener('change', () => {
		isDraggingVolume = false;
		sendVolume(Number(slider.value));
	});
}

function applyState(state: PlayerState) {
	latestState = state;
	stateReceivedAt = Date.now();

	const titleEl = document.getElementById('track-title');
	const artistEl = document.getElementById('track-artist');
	const toggleIcon = document.querySelector('.transport-btn[data-action="toggle"] span');
	const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement | null;
	const isStopped = state.isPaused || !state.currentTrack;

	if (titleEl) titleEl.textContent = state.currentTrack?.title ?? 'Nada sonando';
	if (artistEl) artistEl.textContent = state.currentTrack ? state.currentTrack.author : 'Usa /play o busca algo aquí';
	if (toggleIcon) toggleIcon.textContent = isStopped ? '▶' : '⏸';
	if (volumeSlider && !isDraggingVolume) volumeSlider.value = String(state.volume);
	setArt(state.currentTrack?.thumbnail);

	// Skip the queue-list rebuild while a drag is in progress: replacing the
	// dragged row's DOM node mid-gesture cancels the native drag operation
	// outright (the browser drops it since its source element vanished),
	// which is what produced the "reverts after a moment" symptom.
	// dragend's own handler re-renders once the gesture is done.
	if (isPanelOpen() && searchResults === null && !isDragging) renderUnifiedList();
}

// Interpolates the scrubber smoothly between the periodic state ticks the
// server sends, instead of jumping every few seconds.
function tickProgress() {
	const fill = document.getElementById('progress-fill') as HTMLDivElement | null;
	const elapsedEl = document.getElementById('time-elapsed');
	const remainingEl = document.getElementById('time-remaining');
	const track = latestState?.currentTrack;

	if (track && track.durationMS > 0) {
		const elapsed = latestState && !latestState.isPaused ? Date.now() - stateReceivedAt : 0;
		const positionMS = Math.min((latestState?.positionMS ?? 0) + elapsed, track.durationMS);
		const pct = Math.min(100, Math.max(0, (positionMS / track.durationMS) * 100));

		if (fill) fill.style.width = `${pct}%`;
		if (elapsedEl) elapsedEl.textContent = formatTime(positionMS);
		if (remainingEl) remainingEl.textContent = `-${formatTime(track.durationMS - positionMS)}`;
	} else {
		if (fill) fill.style.width = '0%';
		if (elapsedEl) elapsedEl.textContent = '0:00';
		if (remainingEl) remainingEl.textContent = '-0:00';
	}

	requestAnimationFrame(tickProgress);
}

// Render the UI immediately — it doesn't depend on Discord at all, so this
// also lets us iterate on the design in a plain browser tab (localhost:3000)
// without going through the Discord App Launcher every time.
renderPlayerMockup();
syncPanelForViewport();
WIDE_LAYOUT_QUERY.addEventListener('change', syncPanelForViewport);
positionRayBurst();
requestAnimationFrame(tickProgress);

// Re-measure once webfonts finish loading (they can shift layout slightly
// after the first paint) and on every resize.
document.fonts?.ready.then(positionRayBurst).catch(() => {});
window.addEventListener('resize', schedulePositionRayBurst);

// The Discord-specific bits (auth, channel name, realtime sync) are
// best-effort and run separately so a failure/hang here (e.g. when opened
// outside Discord) never blocks the UI from showing.
setupDiscordSdk()
	.then(() => {
		renderChannelLabel();
		connectWebSocket();
	})
	.catch((error) => {
		console.warn('[Kasumi Player] Discord SDK setup skipped/failed:', formatError(error));
		showConnectionError('No se pudo conectar con Discord — la búsqueda y el control en vivo no van a funcionar hasta que recargues.');
	});
