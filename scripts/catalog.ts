// Checks the shared catalog (catalog/, Molfar.Vertep#373) and writes its index.
//   bun scripts/catalog.ts            checks every pack and the packs against each other (the pull request check)
//   bun scripts/catalog.ts --write    also rewrites catalog/index.json (the push check commits it)
//   bun scripts/catalog.ts --index    checks that catalog/index.json is the one --write would make
import fs from "node:fs";
import path from "node:path";
import { buildIndex, checkAcross, checkPack, loadPacks, type Entry, type Tags } from "./catalog-lib";

const root = path.join(import.meta.dir, "..", "catalog");
let tags: Tags;
try {
  tags = JSON.parse(fs.readFileSync(path.join(root, "tags.json"), "utf8"));
} catch (e) {
  console.error(`catalog/tags.json is not readable: ${(e as Error).message}`);
  process.exit(1);
}
const loaded = loadPacks(root);
const problems: string[] = [];
for (const l of loaded) problems.push(...checkPack(l.file, fs.readFileSync(path.join(root, l.file), "utf8"), tags));
if (problems.length === 0) problems.push(...checkAcross(loaded.map((l) => ({ rel: l.file, entries: (l.pack as { entries: Entry[] }).entries }))));
if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
const index = `${JSON.stringify(buildIndex(tags, loaded), null, 2)}\n`;
const indexFile = path.join(root, "index.json");
if (process.argv.includes("--write")) fs.writeFileSync(indexFile, index);
else if (process.argv.includes("--index") && (!fs.existsSync(indexFile) || fs.readFileSync(indexFile, "utf8").replace(/\r\n/g, "\n") !== index)) {
  console.error("catalog/index.json is out of date: run `bun scripts/catalog.ts --write`");
  process.exit(1);
}
const entries = loaded.reduce((n, l) => n + (l.pack as { entries: unknown[] }).entries.length, 0);
console.log(`catalog: ${loaded.length} pack${loaded.length === 1 ? "" : "s"}, ${entries} entries, all valid.`);
