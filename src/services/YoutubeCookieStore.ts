import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const COOKIE_FILE = join(process.cwd(), 'data', 'youtube-cookie.txt');

// YOUTUBE_COOKIES from .env only gets read once at boot (dotenv). Cookies go
// stale periodically (see PoTokenProvider), so /set-cookie needs a place to
// write a fresh value the running process actually re-reads — a file, not
// the env var. Seeded from YOUTUBE_COOKIES on first boot only.
export class YoutubeCookieStore {
  private value: string;

  constructor() {
    if (existsSync(COOKIE_FILE)) {
      this.value = readFileSync(COOKIE_FILE, 'utf-8').trim();
    } else {
      this.value = process.env.YOUTUBE_COOKIES ?? '';
      if (this.value) this.persist();
    }
  }

  get(): string {
    return this.value;
  }

  set(cookie: string): void {
    this.value = cookie.trim();
    this.persist();
  }

  private persist(): void {
    mkdirSync(dirname(COOKIE_FILE), { recursive: true });
    writeFileSync(COOKIE_FILE, this.value, 'utf-8');
  }
}
