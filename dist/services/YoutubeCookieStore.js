"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YoutubeCookieStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const COOKIE_FILE = (0, node_path_1.join)(process.cwd(), 'data', 'youtube-cookie.txt');
// YOUTUBE_COOKIES from .env only gets read once at boot (dotenv). Cookies go
// stale periodically (see PoTokenProvider), so /set-cookie needs a place to
// write a fresh value the running process actually re-reads — a file, not
// the env var. Seeded from YOUTUBE_COOKIES on first boot only.
class YoutubeCookieStore {
    constructor() {
        if ((0, node_fs_1.existsSync)(COOKIE_FILE)) {
            this.value = (0, node_fs_1.readFileSync)(COOKIE_FILE, 'utf-8').trim();
        }
        else {
            this.value = process.env.YOUTUBE_COOKIES ?? '';
            if (this.value)
                this.persist();
        }
    }
    get() {
        return this.value;
    }
    set(cookie) {
        this.value = cookie.trim();
        this.persist();
    }
    persist() {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(COOKIE_FILE), { recursive: true });
        (0, node_fs_1.writeFileSync)(COOKIE_FILE, this.value, 'utf-8');
    }
}
exports.YoutubeCookieStore = YoutubeCookieStore;
//# sourceMappingURL=YoutubeCookieStore.js.map