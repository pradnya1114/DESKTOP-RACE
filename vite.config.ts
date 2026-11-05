import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const GSTATIC_MODELS_BASE = 'https://www.gstatic.com/aistudio/starter-apps/desk-racer/models';
const GLB_FILES = [
  'desk_props.glb',
  'kart_1to87.glb',
  'room_environment.glb',
  'track_coaster.glb',
];

function fetchGstaticModelsOnBuild(): Plugin {
  let outDir = 'dist';
  return {
    name: 'fetch-gstatic-models-on-build',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    async closeBundle() {
      const assetsModelsDir = path.resolve(outDir, 'assets/models');
      const apiModelsDir = path.resolve(outDir, 'api/gstatic-models');
      await Promise.all([
        fs.mkdir(assetsModelsDir, { recursive: true }),
        fs.mkdir(apiModelsDir, { recursive: true }),
      ]);

      await Promise.all(
        GLB_FILES.map(async (file) => {
          const localSource = path.resolve('public/assets/models', file);
          const dest1 = path.join(assetsModelsDir, file);
          const dest2 = path.join(apiModelsDir, file);

          try {
            const buf = await fs.readFile(localSource);
            await Promise.all([fs.writeFile(dest1, buf), fs.writeFile(dest2, buf)]);
            return;
          } catch {
            // Fallback to network download if local file is missing
          }

          const url = `${GSTATIC_MODELS_BASE}/${file}`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          await Promise.all([
            fs.writeFile(dest1, buffer),
            fs.writeFile(dest2, buffer),
          ]);
        })
      );
    },
  };
}

const gstaticModelsProxy = {
  '/api/gstatic-models': {
    target: 'https://www.gstatic.com',
    changeOrigin: true,
    rewrite: (reqPath: string) =>
      reqPath.replace(/^\/api\/gstatic-models/, '/aistudio/starter-apps/desk-racer/models'),
  },
  '/assets/models': {
    target: 'https://www.gstatic.com',
    changeOrigin: true,
    rewrite: (reqPath: string) =>
      reqPath.replace(/^\/assets\/models/, '/aistudio/starter-apps/desk-racer/models'),
  },
};

export default defineConfig({
  plugins: [
    fetchGstaticModelsOnBuild(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.png',
        'apple-touch-icon.png',
        'icon.svg',
        'icon-maskable.svg',
        'assets/data/*.json',
        'assets/fonts/*',
        'assets/audio/*.wav',
        'assets/models/*.glb',
        'api/gstatic-models/*.glb',
      ],
      manifest: {
        id: '/',
        name: 'Desk Racer - Miniature Coaster Racing',
        short_name: 'DeskRacer',
        description: 'Miniature desk coaster time-trial racing game with full 100% offline play.',
        theme_color: '#0d0f12',
        background_color: '#0d0f12',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        categories: ['games', 'arcade', 'racing'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30 MB to precache all GLB models & audio
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wav,json,glb,wasm}'],
        ignoreURLParametersMatching: [/.*/],
        runtimeCaching: [
          {
            urlPattern: /.*\.(?:glb|gltf)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'desk-racer-3d-models',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /.*\/assets\/audio\/.*\.(?:wav|mp3|ogg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'desk-racer-audio',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /.*\/assets\/fonts\/.*\.(?:woff2?|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /.*\/assets\/data\/.*\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'desk-racer-data',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: gstaticModelsProxy,
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    proxy: gstaticModelsProxy,
  },
});

