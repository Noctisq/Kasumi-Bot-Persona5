import { YoutubeCookieStore } from './YoutubeCookieStore';

// Used to mint po_tokens via a real headless Chromium (BotGuard challenge)
// for anonymous/unauthenticated sessions. Once YOUTUBE_COOKIES was added,
// direct testing showed cookie auth alone is enough for both search/watch
// requests and full SABR streaming — po_token turned out unnecessary, and
// on a small VM the Puppeteer mint was outright unreliable (timeouts,
// mismatched identity breaking server_abr_streaming_url). Kept as a thin
// cookie holder so /set-cookie still has one place to read/write it.
export class PoTokenProvider {
  private readonly cookieStore = new YoutubeCookieStore();

  getCookie(): string {
    return this.cookieStore.get();
  }

  setCookie(cookie: string): void {
    this.cookieStore.set(cookie);
  }
}
