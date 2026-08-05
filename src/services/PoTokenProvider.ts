import puppeteer from 'puppeteer';
import { Innertube } from 'youtubei.js';
import { buildURL, GOOG_API_KEY, USER_AGENT } from 'bgutils-js';

export interface PoToken {
  poToken: string;
  visitorData: string;
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
export class PoTokenProvider {
  private current: PoToken | null = null;
  private refreshing: Promise<PoToken> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  async getToken(): Promise<PoToken> {
    if (this.current) return this.current;
    return this.refresh();
  }

  private refresh(): Promise<PoToken> {
    if (this.refreshing) return this.refreshing;

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

  private scheduleRefresh(delayMs: number): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    // unref() so this timer alone never keeps the Node process alive.
    this.refreshTimer = setTimeout(() => {
      this.current = null;
      this.refresh().catch((error) => console.error('[PoTokenProvider] Background refresh failed:', error));
    }, delayMs).unref();
  }

  private async mintToken(): Promise<PoToken> {
    const bootstrapInnertube = await Innertube.create({
      user_agent: USER_AGENT,
      enable_session_cache: false,
    });
    const visitorData = bootstrapInnertube.session.context.client.visitorData || '';

    const challengeResponse = await bootstrapInnertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
    if (!challengeResponse.bg_challenge) throw new Error('No se pudo obtener el reto de atestación de BotGuard');

    const interpreterUrl =
      challengeResponse.bg_challenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
    const interpreterJavascript = await (await fetch(`https:${interpreterUrl}`)).text();
    if (!interpreterJavascript) throw new Error('No se pudo cargar el script de BotGuard');

    const { program, global_name: globalName } = challengeResponse.bg_challenge;

    const browser = await puppeteer.launch({ headless: true });
    let poToken: string;
    try {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });

      const botguardResponse = await page.evaluate(runBotGuardSnapshot, interpreterJavascript, program, globalName);

      const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
        method: 'POST',
        headers: {
          'content-type': 'application/json+protobuf',
          'x-goog-api-key': GOOG_API_KEY,
          'x-user-agent': 'grpc-web-javascript/0.1',
          'user-agent': USER_AGENT,
        },
        body: JSON.stringify([REQUEST_KEY, botguardResponse]),
      });
      const integrityJson = (await integrityTokenResponse.json()) as [string, number, number, string];
      const [integrityToken, , mintRefreshThresholdSecs] = integrityJson;
      if (typeof integrityToken !== 'string') {
        throw new Error(`No se obtuvo integrity token: ${JSON.stringify(integrityJson)}`);
      }

      poToken = await page.evaluate(mintWebPoToken, integrityToken, visitorData);

      const refreshMs =
        typeof mintRefreshThresholdSecs === 'number' && mintRefreshThresholdSecs > 0
          ? mintRefreshThresholdSecs * 1000
          : DEFAULT_REFRESH_MS;
      this.scheduleRefresh(refreshMs);
    } finally {
      await browser.close();
    }

    return { poToken, visitorData };
  }
}

// Runs INSIDE the Puppeteer page. Loads BotGuard's VM and takes a
// snapshot, returning the botguardResponse string (serializable — crosses
// back to Node fine). webPoSignalOutput's minter function does NOT cross
// the boundary (functions can't be serialized), so it's stashed on
// `window` for mintWebPoToken() to use in a later, separate evaluate() call.
async function runBotGuardSnapshot(interpreterJavascript: string, program: string, globalName: string): Promise<string> {
  // eslint-disable-next-line no-new-func
  new Function(interpreterJavascript)();
  const vm = (self as unknown as Record<string, { a?: (...args: unknown[]) => unknown }>)[globalName];
  if (!vm || !vm.a) throw new Error('VM de BotGuard no disponible tras cargar el script');

  // bgutils-js's real BotGuardClient resolves a promise from INSIDE this
  // callback rather than trusting vm.a(...)'s own return value to be
  // synchronized with it — mirroring that here; they don't always resolve
  // together in practice.
  let resolveVmFunctions!: (fns: { asyncSnapshotFunction?: (...args: unknown[]) => unknown }) => void;
  const vmFunctionsPromise = new Promise<{ asyncSnapshotFunction?: (...args: unknown[]) => unknown }>((resolve) => {
    resolveVmFunctions = resolve;
  });

  vm.a(
    program,
    (asyncSnapshotFunction: (...args: unknown[]) => unknown) => {
      resolveVmFunctions({ asyncSnapshotFunction });
    },
    true,
    undefined,
    () => {},
    [[], []]
  );

  const vmFunctions = await Promise.race([
    vmFunctionsPromise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout esperando vmFunctionsCallback')), 5000)),
  ]);
  if (!vmFunctions.asyncSnapshotFunction) throw new Error('asyncSnapshotFunction no encontrada');

  (window as unknown as Record<string, unknown[]>).__webPoSignalOutput = [];
  return new Promise<string>((resolve, reject) => {
    try {
      vmFunctions.asyncSnapshotFunction?.((response: string) => resolve(response), [
        undefined,
        undefined,
        (window as unknown as Record<string, unknown[]>).__webPoSignalOutput,
        undefined,
      ]);
    } catch (error) {
      reject(error);
    }
  });
}

// Runs INSIDE the page too, in a separate evaluate() call — the minter
// function from the snapshot step only exists in the page's JS realm, so
// this whole step (encode identity -> mint -> base64url-encode the result)
// has to happen there; only the final string crosses back to Node.
async function mintWebPoToken(integrityToken: string, identity: string): Promise<string> {
  function base64ToU8(b64: string): Uint8Array {
    const binary = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const getMinter = (window as unknown as Record<string, unknown[]>).__webPoSignalOutput[0] as (
    integrityTokenBytes: Uint8Array
  ) => Promise<(identityBytes: Uint8Array) => Promise<Uint8Array>>;
  if (!getMinter) throw new Error('No hay función minter en webPoSignalOutput');

  const mintCallback = await getMinter(base64ToU8(integrityToken));
  if (typeof mintCallback !== 'function') throw new Error('mintCallback no es una función');

  const identityBytes = new TextEncoder().encode(identity);
  const result = await mintCallback(identityBytes);
  if (!(result instanceof Uint8Array)) throw new Error('El resultado del mint no es un Uint8Array');

  let binary = '';
  for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
