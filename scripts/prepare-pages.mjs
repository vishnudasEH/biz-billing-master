import {
  cpSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const projectRoot = resolve(".");
const candidates = [".output/public", "dist", "build"];

let sourceRoot = null;
let indexPath = null;

for (const candidate of candidates) {
  const dir = join(projectRoot, candidate);
  const file = join(dir, "index.html");
  if (existsSync(file)) {
    sourceRoot = dir;
    indexPath = file;
    break;
  }
}

if (!sourceRoot || !indexPath) {
  throw new Error(
    "Static index.html was not generated. Expected the build to produce an index.html in .output/public, dist, or build.",
  );
}

mkdirSync("pages-dist", { recursive: true });
cpSync(sourceRoot, "pages-dist", { recursive: true });
cpSync(indexPath, "pages-dist/404.html");
writeFileSync("pages-dist/.nojekyll", "");

console.log(`Using static output: ${sourceRoot}`);
