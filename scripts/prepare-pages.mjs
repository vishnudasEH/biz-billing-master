import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// The app is a fully client-side SPA (Firebase is the backend), so the build
// produces a static shell plus assets — no server runtime. With nitro disabled
// the client build lands in dist/client and the prerendered shell is
// dist/client/_shell.html. GitHub Pages needs that shell as index.html.
const projectRoot = resolve(".");
const sourceRoot = join(projectRoot, "dist", "client");
const shellPath = join(sourceRoot, "_shell.html");

if (!existsSync(shellPath)) {
  throw new Error(
    "Static SPA shell was not generated. Expected the build to produce dist/client/_shell.html.",
  );
}

rmSync("pages-dist", { recursive: true, force: true });
mkdirSync("pages-dist", { recursive: true });
cpSync(sourceRoot, "pages-dist", { recursive: true });
cpSync(shellPath, join("pages-dist", "index.html"));
// SPA deep links: GitHub Pages serves 404.html for unknown paths.
cpSync(shellPath, join("pages-dist", "404.html"));
rmSync(join("pages-dist", "_shell.html"), { force: true });
writeFileSync(join("pages-dist", ".nojekyll"), "");

console.log(`Using static output: ${sourceRoot}`);
