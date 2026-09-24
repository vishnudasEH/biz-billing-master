import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "pages-dist",
]);

function findIndexHtml(directory) {
  if (!existsSync(directory)) return null;

  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;

    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isFile() && entry === "index.html") {
      return path;
    }

    if (stats.isDirectory()) {
      const result = findIndexHtml(path);
      if (result) return result;
    }
  }

  return null;
}

const projectRoot = resolve(".");
const indexPath = findIndexHtml(projectRoot);

if (!indexPath) {
  throw new Error(
    "Static index.html was not generated. Expected the build to produce an index.html under the project root.",
  );
}

const sourceRoot = indexPath.slice(0, -"/index.html".length);

mkdirSync("pages-dist", { recursive: true });
cpSync(sourceRoot, "pages-dist", { recursive: true });
cpSync(indexPath, "pages-dist/404.html");
writeFileSync("pages-dist/.nojekyll", "");

console.log(`Using static output: ${sourceRoot}`);
