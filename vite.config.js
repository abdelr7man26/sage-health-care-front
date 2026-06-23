import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    // In production builds, fail fast when VITE_API_URL is not configured.
    // This prevents accidentally shipping a build that calls localhost:5000/api.
    // Vite natively injects VITE_* variables from .env files into import.meta.env;
    // we only need to validate here — NOT override via define (which conflicts).
    if (mode === 'production' && !env.VITE_API_URL) {
        throw new Error(
            '[vite] VITE_API_URL is required for production builds.\n' +
            'Create client/.env.production with:\n' +
            '  VITE_API_URL=https://your-domain.com/api'
        );
    }

    return {
        plugins: [react()],
        // Dev-only proxy: makes the frontend and backend share one origin
        // (http://localhost:5173) so the httpOnly refresh cookie is first-party and
        // persists across reloads — mirroring production where both sit behind nginx.
        // Without this, the cross-port split (5173 vs 5000) makes the browser drop the
        // auth cookie, forcing a re-login on every reopen. Proxies API + uploaded files.
        server: {
            proxy: {
                '/api':     { target: 'http://localhost:5000', changeOrigin: true },
                '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
            },
        },
        // No define override needed: Vite handles VITE_* variables natively via .env files.
        // Adding 'import.meta.env.VITE_API_URL' to define would conflict with Vite's
        // own substitution pass and may double-replace or overwrite the env file value.
        build: {
            // Disable the module preload polyfill — it's the only inline <script> Vite
            // emits in production and the sole reason CSP needed 'unsafe-inline'.
            // Modern browsers (Chrome 66+, Firefox 67+, Safari 17+) support modulepreload
            // natively, so the polyfill is not needed for the target audience.
            modulePreload: { polyfill: false },

            rollupOptions: {
                output: {
                    // Split heavy / rarely-changing vendor libs into their own chunks.
                    //   - Smaller initial app bundle (vendor cached separately).
                    //   - Long-term caching: app code changes often, these libs don't,
                    //     so a redeploy doesn't force users to re-download React etc.
                    //   - One shared copy of a lib used across many lazy routes
                    //     (e.g. framer-motion) instead of it leaking into the main bundle.
                    // recharts (charts) and leaflet (maps) are already isolated via
                    // React.lazy, but pinning them here guarantees a single stable chunk.
                    manualChunks(id) {
                        if (!id.includes('node_modules')) return;
                        if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'charts';
                        if (id.includes('leaflet')) return 'maps';
                        if (id.includes('framer-motion')) return 'motion';
                        if (id.includes('@tanstack')) return 'query';
                        if (id.includes('react-router')) return 'router';
                        if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react-vendor';
                        // No catch-all 'vendor' chunk: a single merged vendor chunk
                        // would be pulled in eagerly (axios is used at startup),
                        // forcing admin/doctor-only libs onto the patient's first load.
                        // Returning undefined lets Rollup keep the rest co-located with
                        // the lazy route that actually uses them.
                    },
                },
            },
        },
    };
});
