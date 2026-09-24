// scripts/prepare-pages.mjs
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const preferredFiles = [
  "dist/client/index.html",
  ".output/public/index.html",
  "dist/index.html",
];

const preferred = preferredFiles.find((file) => existsSync(file));

const discovered =
  preferred ||
  readdirSync(".", { recursive: true })
    .filter(
      (file) =>
        typeof file === "string" &&
        file.endsWith("/index.html") &&
        !file.startsWith("node_modules/") &&
        !file.startsWith(".git/") &&
        !file.startsWith("pages-dist/"),
    )
    .find((file) => existsSync(file));

if (!discovered) {
  throw new Error(
    "Static index.html was not generated. Searched the build output for index.html.",
  );
}

const root = dirname(discovered);

mkdirSync("pages-dist", { recursive: true });
cpSync(root, "pages-dist", { recursive: true });
cpSync(join(root, "index.html"), "pages-dist/404.html");
writeFileSync("pages-dist/.nojekyll", "");
