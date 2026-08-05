import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	envDir: '../../',
	server: {
		port: 3000,
		// cloudflared quick tunnels get a new random *.trycloudflare.com hostname
		// every run, so allow the whole subdomain instead of one fixed host.
		allowedHosts: ['.trycloudflare.com'],
		proxy: {
			'/api': {
				target: 'http://localhost:3001',
				changeOrigin: true,
				secure: false,
				ws: true,
			},
		},
		hmr: {
			clientPort: 443,
		},
	},
});
