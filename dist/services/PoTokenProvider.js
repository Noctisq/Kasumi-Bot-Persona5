"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoTokenProvider = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const youtubei_js_1 = require("youtubei.js");
const bgutils_js_1 = require("bgutils-js");
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
        this.current = null;
        this.refreshing = null;
        this.refreshTimer = null;
    }
    async getToken() {
        if (this.current)
            return this.current;
        return this.refresh();
    }
    refresh() {
        if (this.refreshing)
            return this.refreshing;
        this.refreshing = this.mintToken()
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
    async mintToken() {
        const bootstrapInnertube = await youtubei_js_1.Innertube.create({
            user_agent: bgutils_js_1.USER_AGENT,
            enable_session_cache: false,
        });
        const visitorData = bootstrapInnertube.session.context.client.visitorData || '';
        const challengeResponse = await bootstrapInnertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
        if (!challengeResponse.bg_challenge)
            throw new Error('No se pudo obtener el reto de atestación de BotGuard');
        const interpreterUrl = challengeResponse.bg_challenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
        const interpreterJavascript = await (await fetch(`https:${interpreterUrl}`)).text();
        if (!interpreterJavascript)
            throw new Error('No se pudo cargar el script de BotGuard');
        const { program, global_name: globalName } = challengeResponse.bg_challenge;
        const browser = await puppeteer_1.default.launch({ headless: true });
        let poToken;
        try {
            const page = await browser.newPage();
            await page.setUserAgent(bgutils_js_1.USER_AGENT);
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
            poToken = await page.evaluate(mintWebPoToken, integrityToken, visitorData);
            const refreshMs = typeof mintRefreshThresholdSecs === 'number' && mintRefreshThresholdSecs > 0
                ? mintRefreshThresholdSecs * 1000
                : DEFAULT_REFRESH_MS;
            this.scheduleRefresh(refreshMs);
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