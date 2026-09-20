// Copies the Stockfish engine files out of node_modules and into public/, so
// Vite serves them as plain static files. They can't be imported like normal
// JS: the engine runs inside a Web Worker and loads its own .wasm file by
// looking for a sibling with a matching name, so both files have to sit
// together at a real, predictable URL.
//
// Runs on postinstall, so the copied files always match the installed
// package version. They're gitignored — no need for a 1.8MB binary in git
// when npm install regenerates it.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "..", "node_modules", "stockfish", "bin");
const to = join(here, "..", "public", "stockfish");

// The "lite single-threaded" build — see decision.md D-030. Single-threaded
// avoids needing COOP/COEP headers; "lite" is 1.8MB instead of 99MB.
const FILES = ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"];

mkdirSync(to, { recursive: true });
for (const file of FILES) {
  copyFileSync(join(from, file), join(to, file));
}
console.log(`Copied ${FILES.length} Stockfish files into public/stockfish/`);
