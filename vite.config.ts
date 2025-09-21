import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import loadVersion from 'vite-plugin-package-version';
import { VitePWA } from 'vite-plugin-pwa';

const SUPPORTED_LANGUAGES = new Set(['en', 'fr']);

const envLanguage =
  process.env.VITE_APP_LANG ??
  process.env.APP_LANG ??
  process.env.npm_config_lang;

const inlineLanguageArgument = process.argv.find((arg) =>
  arg.startsWith('--lang=')
);

const separatedLanguageArgumentIndex = process.argv.indexOf('--lang');

const separatedLanguageArgument =
  separatedLanguageArgumentIndex >= 0
    ? process.argv[separatedLanguageArgumentIndex + 1]
    : undefined;

const requestedLanguage =
  envLanguage ??
  inlineLanguageArgument?.split('=')[1] ??
  separatedLanguageArgument;

const normalizedRequestedLanguage =
  typeof requestedLanguage === 'string'
    ? requestedLanguage.trim().toLowerCase()
    : undefined;

const buildLanguage =
  normalizedRequestedLanguage &&
  SUPPORTED_LANGUAGES.has(normalizedRequestedLanguage)
    ? normalizedRequestedLanguage
    : 'en';

export default defineConfig({
  plugins: [
    react(),
    loadVersion(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: 'llama.ui',
        name: 'llama.ui - Minimal AI chat interface',
        short_name: 'llama.ui',
        description:
          'A minimal Interface for AI Companion that runs entirely in your browser.',
        display: 'standalone',
        theme_color: '#EEEEEE',
        background_color: '#EEEEEE',
        start_url: 'https://llama-ui.js.org',
        scope: 'https://llama-ui.js.org',
        orientation: 'any',
        lang: 'en',
        icons: [
          {
            purpose: 'maskable',
            sizes: '512x512',
            src: 'assets/manifest-icon-512.maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'any',
            sizes: '512x512',
            src: 'assets/manifest-icon-512.maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'any',
            sizes: '192x192',
            src: 'assets/manifest-icon-192.maskable.png',
            type: 'image/png',
          },
          {
            purpose: 'maskable',
            sizes: '192x192',
            src: 'assets/manifest-icon-192.maskable.png',
            type: 'image/png',
          },
        ],
        screenshots: [
          {
            src: 'screenshots/desktop.png',
            sizes: '1366x1024',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: 'screenshots/mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
        shortcuts: [
          {
            name: 'New Chat',
            url: '/',
            description: 'Start a new chat.',
          },
        ],
        categories: ['ai', 'llm', 'webui', 'llm-ui', 'llm-webui'],
        launch_handler: {
          client_mode: ['navigate-existing', 'auto'],
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,woff2,woff}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'document' ||
              request.destination === 'script' ||
              request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.url.endsWith('/v1/models') &&
              !request.url.includes('localhost') &&
              !/(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})/.test(
                request.url
              ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'api-models',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 15, // 15 minutes
              },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_LANG__: JSON.stringify(buildLanguage),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: function (file) {
          return file.names.some((name) => name.includes('css'))
            ? `assets/[name]-[hash].[ext]`
            : `assets/[name].[ext]`;
        },
        manualChunks: {
          katex: ['katex'],
          'pdfjs-dist': ['pdfjs-dist'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/v1': 'http://localhost:8080',
      '/props': 'http://localhost:8080',
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
});
