"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoTokenProvider = void 0;
const YoutubeCookieStore_1 = require("./YoutubeCookieStore");
// Used to mint po_tokens via a real headless Chromium (BotGuard challenge)
// for anonymous/unauthenticated sessions. Once YOUTUBE_COOKIES was added,
// direct testing showed cookie auth alone is enough for both search/watch
// requests and full SABR streaming — po_token turned out unnecessary, and
// on a small VM the Puppeteer mint was outright unreliable (timeouts,
// mismatched identity breaking server_abr_streaming_url). Kept as a thin
// cookie holder so /set-cookie still has one place to read/write it.
class PoTokenProvider {
    constructor() {
        this.cookieStore = new YoutubeCookieStore_1.YoutubeCookieStore();
    }
    getCookie() {
        return this.cookieStore.get();
    }
    setCookie(cookie) {
        this.cookieStore.set(cookie);
    }
}
exports.PoTokenProvider = PoTokenProvider;
//# sourceMappingURL=PoTokenProvider.js.map