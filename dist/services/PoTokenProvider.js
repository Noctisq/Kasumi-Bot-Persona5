"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoTokenProvider = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const youtubei_js_1 = require("youtubei.js");
const bgutils_js_1 = require("bgutils-js");
const YoutubeCookieStore_1 = require("./YoutubeCookieStore");
// Finds the substring starting at `openIndex` (must be a '{') up to and
// including its matching closing '}', respecting string literals so a
// brace inside a quoted string doesn't throw off the count.
function extractBalancedBraces(text, openIndex) {
    let depth = 0;
    let quote = null;
    for (let i = openIndex; i < text.length; i++) {
        const char = text[i];
        if (quote) {
            if (char === '\\')
                i++; // skip escaped char, whatever it is
            else if (char === quote)
                quote = null;
            continue;
        }
        if (char === '"' || char === "'")
            quote = char;
        else if (char === '{')
            depth++;
        else if (char === '}') {
            depth--;
            if (depth === 0)
                return text.slice(openIndex, i + 1);
        }
    }
    throw new Error('Llave sin cerrar al extraer el objeto de window.ytAtN');
}
// Same request key discord-player-googlevideo's own generateWebPoToken()
// uses — it identifies which "client" is asking, not something tied to us
// specifically, so it's safe/expected to reuse.
const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';
// Fallback if the server doesn't give us a usable mintRefreshThreshold.
const DEFAULT_REFRESH_MS = 6 * 60 * 60 * 1000;
// Mints a session-level PO token using a REAL headless browser instead of
// jsdom. discord-player-googlevideo already tries this exact flow (see its
// generateWebPoToken.js) but does it with jsdom, and YouTube's BotGuard
// challenge now appears to detect and reject that simulated environment —
// confirmed empirically: the same protocol, run inside real Chromium via
// Puppeteer, mints a token that YouTube accepts (verified against a track
// that reliably failed with jsdom).
//
// Puppeteer is launched fresh for each mint and closed immediately after —
// deliberately not kept running continuously, to keep the memory footprint
// on a small VM bounded to "briefly, once every few hours" rather than
// "always".
class PoTokenProvider {
    constructor() {
        this.cookieStore = new YoutubeCookieStore_1.YoutubeCookieStore();
        this.current = null;
        this.refreshing = null;
        this.refreshTimer = null;
    }
    async getToken() {
        if (this.current)
            return this.current;
        return this.refresh();
    }
    getCookie() {
        return this.cookieStore.get();
    }
    // Called from /set-cookie. Drops the cached session token so the next
    // getToken() re-mints against the new cookie instead of reusing the old
    // (possibly stale) session identity.
    setCookie(cookie) {
        this.cookieStore.set(cookie);
        this.current = null;
        if (this.refreshTimer)
            clearTimeout(this.refreshTimer);
    }
    // The session token from getToken() is bound to our visitor identity —
    // enough for the watch/search requests, but SabrStream's own "stream
    // protection status" check stays stuck at ATTESTATION_PENDING and never
    // releases media segments unless the token it sees is minted for THIS
    // specific video. Real browser, same as getToken(), just a different
    // final identity. No caching here (every video needs its own), but
    // that's fine — prefetching already runs this ahead of playback.
    async getTokenForVideo(videoId) {
        const { poToken } = await this.mint(videoId);
        return poToken;
    }
    refresh() {
        if (this.refreshing)
            return this.refreshing;
        this.refreshing = this.mint()
            .then((token) => {
            this.current = token;
            return token;
        })
            .finally(() => {
            this.refreshing = null;
        });
        return this.refreshing;
    }
    scheduleRefresh(delayMs) {
        if (this.refreshTimer)
            clearTimeout(this.refreshTimer);
        // unref() so this timer alone never keeps the Node process alive.
        this.refreshTimer = setTimeout(() => {
            this.current = null;
            this.refresh().catch((error) => console.error('[PoTokenProvider] Background refresh failed:', error));
        }, delayMs).unref();
    }
    // videoId omitted -> session-bound token (mint identity = visitorData,
    // cached, auto-refreshed). videoId given -> content-bound token for that
    // video (minted fresh every time, not cached).
    //
    // Challenge is pulled straight from youtube.com's own HTML (the embedded
    // window.ytAtN({...}) call), not via Innertube's getAttestationChallenge()
    // API — confirmed by the community (see
    // https://github.com/LuanRT/googlevideo/issues/45) that streaming
    // specifically needs the challenge sourced this way; the API-fetched one
    // leaves SabrStream's attestation permanently stuck "pending" even
    // though it's perfectly fine for search/watch requests.
    async mint(videoId) {
        // SabrStream's attestation stayed permanently "pending" across four
        // different anonymous approaches (session vs content-bound token,
        // PLAYBACK engagement type, HTML-scraped challenge) — everything
        // pointed at needing a genuinely authenticated session, not a better
        // anonymous one. YOUTUBE_COOKIES carries that authentication through
        // every touchpoint here: the bootstrap session, the challenge fetch,
        // and the Puppeteer page itself.
        const cookie = this.cookieStore.get();
        const bootstrapInnertube = await youtubei_js_1.Innertube.create({
            user_agent: bgutils_js_1.USER_AGENT,
            enable_session_cache: false,
            ...(cookie ? { cookie } : {}),
        });
        const visitorData = bootstrapInnertube.session.context.client.visitorData || '';
        const pageResponse = await fetch('https://www.youtube.com', {
            headers: {
                accept: '*/*',
                'accept-language': 'en-US,en;q=0.7',
                'user-agent': bgutils_js_1.USER_AGENT,
                ...(cookie ? { cookie } : {}),
            },
        });
        const pageHtml = await pageResponse.text();
        // window.ytAtN({'R': '...', 'T': ...}) — R is itself a JSON STRING
        // (with \x-escaped characters), and the whole thing is a JS object
        // literal (single-quoted keys), not strict JSON — brace-balance and
        // evaluate it as JS rather than a regex assuming a fixed suffix, since
        // the surrounding wrapper code is YouTube's own minified output and
        // shifts between deploys.
        const callStart = pageHtml.indexOf('window.ytAtN({');
        if (callStart === -1)
            throw new Error('No se encontró la llamada a window.ytAtN en el HTML de YouTube');
        const objectLiteral = extractBalancedBraces(pageHtml, pageHtml.indexOf('{', callStart));
        // eslint-disable-next-line no-new-func
        const ytAtNArg = new Function(`return ${objectLiteral}`)();
        const rawChallenge = JSON.parse(ytAtNArg.R).bgChallenge;
        if (!rawChallenge)
            throw new Error('No se pudo obtener el reto de atestación de BotGuard');
        const interpreterUrl = rawChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
        const interpreterJavascript = await (await fetch(`https:${interpreterUrl}`)).text();
        if (!interpreterJavascript)
            throw new Error('No se pudo cargar el script de BotGuard');
        const { program, globalName } = rawChallenge;
        // --no-sandbox: Chromium's own sandbox needs unprivileged user
        // namespaces, which Ubuntu 23.10+ disables by default via AppArmor —
        // without this flag the browser process refuses to start at all on a
        // bare server ("No usable sandbox!"). Low risk here since the only page
        // ever loaded is youtube.com running BotGuard's own script, not
        // arbitrary/untrusted content.
        const browser = await puppeteer_1.default.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        let poToken;
        try {
            const page = await browser.newPage();
            await page.setUserAgent(bgutils_js_1.USER_AGENT);
            if (cookie)
                await page.setExtraHTTPHeaders({ cookie });
            await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
            const botguardResponse = await page.evaluate(runBotGuardSnapshot, interpreterJavascript, program, globalName);
            const integrityTokenResponse = await fetch((0, bgutils_js_1.buildURL)('GenerateIT', true), {
                method: 'POST',
                headers: {
                    'content-type': 'application/json+protobuf',
                    'x-goog-api-key': bgutils_js_1.GOOG_API_KEY,
                    'x-user-agent': 'grpc-web-javascript/0.1',
                    'user-agent': bgutils_js_1.USER_AGENT,
                },
                body: JSON.stringify([REQUEST_KEY, botguardResponse]),
            });
            const integrityJson = (await integrityTokenResponse.json());
            const [integrityToken, , mintRefreshThresholdSecs] = integrityJson;
            if (typeof integrityToken !== 'string') {
                throw new Error(`No se obtuvo integrity token: ${JSON.stringify(integrityJson)}`);
            }
            poToken = await page.evaluate(mintWebPoToken, integrityToken, videoId ?? visitorData);
            // Only the session token is cached/reused, so only it needs a
            // refresh schedule — a content-bound mint is used once and discarded.
            if (!videoId) {
                const refreshMs = typeof mintRefreshThresholdSecs === 'number' && mintRefreshThresholdSecs > 0
                    ? mintRefreshThresholdSecs * 1000
                    : DEFAULT_REFRESH_MS;
                this.scheduleRefresh(refreshMs);
            }
        }
        finally {
            await browser.close();
        }
        return { poToken, visitorData };
    }
}
exports.PoTokenProvider = PoTokenProvider;
// Runs INSIDE the Puppeteer page. Loads BotGuard's VM and takes a
// snapshot, returning the botguardResponse string (serializable — crosses
// back to Node fine). webPoSignalOutput's minter function does NOT cross
// the boundary (functions can't be serialized), so it's stashed on
// `window` for mintWebPoToken() to use in a later, separate evaluate() call.
async function runBotGuardSnapshot(interpreterJavascript, program, globalName) {
    // eslint-disable-next-line no-new-func
    new Function(interpreterJavascript)();
    const vm = self[globalName];
    if (!vm || !vm.a)
        throw new Error('VM de BotGuard no disponible tras cargar el script');
    // bgutils-js's real BotGuardClient resolves a promise from INSIDE this
    // callback rather than trusting vm.a(...)'s own return value to be
    // synchronized with it — mirroring that here; they don't always resolve
    // together in practice.
    let resolveVmFunctions;
    const vmFunctionsPromise = new Promise((resolve) => {
        resolveVmFunctions = resolve;
    });
    vm.a(program, (asyncSnapshotFunction) => {
        resolveVmFunctions({ asyncSnapshotFunction });
    }, true, undefined, () => { }, [[], []]);
    const vmFunctions = await Promise.race([
        vmFunctionsPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout esperando vmFunctionsCallback')), 5000)),
    ]);
    if (!vmFunctions.asyncSnapshotFunction)
        throw new Error('asyncSnapshotFunction no encontrada');
    window.__webPoSignalOutput = [];
    return new Promise((resolve, reject) => {
        try {
            vmFunctions.asyncSnapshotFunction?.((response) => resolve(response), [
                undefined,
                undefined,
                window.__webPoSignalOutput,
                undefined,
            ]);
        }
        catch (error) {
            reject(error);
        }
    });
}
// Runs INSIDE the page too, in a separate evaluate() call — the minter
// function from the snapshot step only exists in the page's JS realm, so
// this whole step (encode identity -> mint -> base64url-encode the result)
// has to happen there; only the final string crosses back to Node.
async function mintWebPoToken(integrityToken, identity) {
    function base64ToU8(b64) {
        const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        return bytes;
    }
    const getMinter = window.__webPoSignalOutput[0];
    if (!getMinter)
        throw new Error('No hay función minter en webPoSignalOutput');
    const mintCallback = await getMinter(base64ToU8(integrityToken));
    if (typeof mintCallback !== 'function')
        throw new Error('mintCallback no es una función');
    const identityBytes = new TextEncoder().encode(identity);
    const result = await mintCallback(identityBytes);
    if (!(result instanceof Uint8Array))
        throw new Error('El resultado del mint no es un Uint8Array');
    let binary = '';
    for (let i = 0; i < result.length; i++)
        binary += String.fromCharCode(result[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
//# sourceMappingURL=PoTokenProvider.js.map