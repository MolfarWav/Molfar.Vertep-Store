// Checks apps.json the way Molfar Vertep reads it, but strictly: the engine
// skips a bad entry, this script fails on one, so a pull request cannot
// quietly drop an app from everyone's Store.
//   bun scripts/validate.ts           shape of every entry
//   bun scripts/validate.ts --clone   also clones each repository and looks
//                                     for manifest.json at its root
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const file = path.join(import.meta.dir, "..", "apps.json");
const problems: string[] = [];
const fail = (where: string, what: string) => problems.push(`${where}: ${what}`);

let doc: unknown;
try {
  doc = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`apps.json is not valid JSON: ${(e as Error).message}`);
  process.exit(1);
}
const list = doc && typeof doc === "object" ? (doc as { apps?: unknown }).apps : undefined;
if (!Array.isArray(list)) {
  console.error('apps.json must be { "apps": [ ... ] }');
  process.exit(1);
}

const KEYS = new Set(["id", "name", "description", "author", "repository", "ref", "tags", "added"]);
const text = (v: unknown, max: number) => typeof v === "string" && v.trim() !== "" && v.trim().length <= max && v === v.trim();
const seen = new Set<string>();
const toClone: { id: string; repository: string; ref?: string }[] = [];

list.forEach((item, i) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return fail(`entry ${i + 1}`, "not an object");
  const e = item as Record<string, unknown>;
  const where = typeof e.id === "string" ? `"${e.id}"` : `entry ${i + 1}`;
  for (const k of Object.keys(e)) if (!KEYS.has(k)) fail(where, `unknown field "${k}"`);
  if (typeof e.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(e.id)) fail(where, "id: lowercase letters, digits, - and _, up to 64, starting with a letter or digit");
  else if (seen.has(e.id)) fail(where, "id is already used by another entry");
  else seen.add(e.id);
  if (!text(e.name, 80)) fail(where, "name: required, up to 80 characters, no surrounding spaces");
  if (!text(e.description, 500)) fail(where, "description: required, up to 500 characters, no surrounding spaces");
  if (!text(e.author, 80)) fail(where, "author: required, up to 80 characters, no surrounding spaces");
  const repoOk = typeof e.repository === "string" && /^https:\/\/[^\s/]+\/[^\s]+$/.test(e.repository);
  if (!repoOk) fail(where, "repository: an https:// git URL");
  if (e.ref !== undefined) {
    const ref = e.ref;
    if (typeof ref !== "string" || !/^\w[\w./-]{0,199}$/.test(ref) || ref.includes("..") || ref.includes("//") || ref.endsWith("/") || ref.endsWith(".lock")) fail(where, "ref: a branch or tag name");
  }
  if (!Array.isArray(e.tags) || e.tags.length > 8 || !e.tags.every((t) => typeof t === "string" && /^[a-z0-9][a-z0-9 -]{0,31}$/.test(t))) fail(where, "tags: up to 8, lowercase, up to 32 characters each");
  if (typeof e.added !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.added) || Number.isNaN(Date.parse(e.added))) fail(where, "added: a date, YYYY-MM-DD");
  if (repoOk) toClone.push({ id: String(e.id), repository: e.repository as string, ...(typeof e.ref === "string" ? { ref: e.ref } : {}) });
});

if (process.argv.includes("--clone") && problems.length === 0) {
  for (const app of toClone) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-check-"));
    try {
      const args = ["clone", "--depth", "1", "--quiet", ...(app.ref ? ["--branch", app.ref] : []), "--", app.repository, dir];
      const r = spawnSync("git", args, { stdio: "pipe", timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
      if (r.status !== 0) fail(`"${app.id}"`, `could not clone: ${String(r.stderr).trim().split("\n")[0]}`);
      else {
        try {
          const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { name?: unknown };
          if (typeof m.name !== "string" || !m.name.trim()) fail(`"${app.id}"`, "manifest.json has no name");
        } catch {
          fail(`"${app.id}"`, "no valid manifest.json at the repository root");
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

if (problems.length) {
  console.error(problems.map((p) => `- ${p}`).join("\n"));
  process.exit(1);
}
console.log(`apps.json: ${list.length} app${list.length === 1 ? "" : "s"}, all valid${process.argv.includes("--clone") ? ", every repository has a manifest" : ""}.`);
