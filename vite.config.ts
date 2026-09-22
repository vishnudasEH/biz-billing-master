// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages serves project sites from a sub-path (https://<user>.github.io/<repo>/).
// Set VITE_BASE_PATH="/<repo>/" in CI; defaults to "/" for local dev and Lovable preview.
const basePath = process.env["VITE_BASE_PATH"] || "/";

// Firebase web config is a publishable identifier, not a secret (security comes
// from Firestore rules). Resolve each value from, in order:
//   1. VITE_FIREBASE_* (local .env.local / GitHub Actions secrets)
//   2. Lovable-stored secrets (GOOGLE_API_KEY for the key, FIREBASE_* for the rest)
const pick = (viteName: string, altName?: string) =>
  process.env[viteName] || (altName ? process.env[altName] : undefined) || "";

const firebaseEnv: Record<string, string> = {
  VITE_FIREBASE_API_KEY: pick("VITE_FIREBASE_API_KEY", "GOOGLE_API_KEY"),
  VITE_FIREBASE_AUTH_DOMAIN: pick("VITE_FIREBASE_AUTH_DOMAIN", "FIREBASE_AUTH_DOMAIN"),
  VITE_FIREBASE_PROJECT_ID: pick("VITE_FIREBASE_PROJECT_ID", "FIREBASE_PROJECT_ID"),
  VITE_FIREBASE_STORAGE_BUCKET: pick("VITE_FIREBASE_STORAGE_BUCKET", "FIREBASE_STORAGE_BUCKET"),
  VITE_FIREBASE_MESSAGING_SENDER_ID: pick(
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "FIREBASE_MESSAGING_SENDER_ID",
  ),
  VITE_FIREBASE_APP_ID: pick("VITE_FIREBASE_APP_ID", "FIREBASE_APP_ID"),
};

export default defineConfig({
  vite: {
    base: basePath,
    define: Object.fromEntries(
      Object.entries(firebaseEnv).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
    ),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Static export: the whole app runs in the browser (Firebase is the backend),
    // so we ship a single SPA shell that GitHub Pages can host.
    spa: { enabled: true },
  },
});
