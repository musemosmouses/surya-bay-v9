// main.ts — the entrypoint: hands Surya Bay to make.fun.
// It copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from the kit's vendor library.
// The output directory itself is never removed: the grader runs as an
// unprivileged user on a read-only filesystem, so deleting /output fails.
// Standard library only, no network, deterministic: two runs write the
// same bytes.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";

// Skip dotfiles (e.g. .gitkeep) when copying into the output tree: the
// grader rejects output paths that are not plain relative names, so a
// copied screenshots/.gitkeep fails run_completes. The .gitkeep files stay
// in the repo (they keep empty dirs on GitHub); they just never reach /output.
function skipDotfiles(src) {
  return !basename(src).startsWith(".");
}

mkdirSync(out, { recursive: true });
cpSync(join(root, "game"), join(out, "game"), { recursive: true, filter: skipDotfiles });
mkdirSync(join(out, "screenshots"), { recursive: true });
if (existsSync(join(root, "screenshots"))) {
  cpSync(join(root, "screenshots"), join(out, "screenshots"), { recursive: true, filter: skipDotfiles });
}
const bytes = await buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, "dossier.json"), Buffer.from(bytes));
console.log("wrote " + out + "/dossier.json (" + bytes.length + " bytes)");
