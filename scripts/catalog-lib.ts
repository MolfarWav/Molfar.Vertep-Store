// The rules of the shared catalog (Molfar.Vertep#373): what a pack file may hold. Used by scripts/catalog.ts (the pull request check
// and the index writer) and by its tests. Pure functions, no file access except `loadPacks`.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const LICENSES = ["CC0-1.0", "CC-BY-4.0"] as const;
export const LIMITS = { fileBytes: 200_000, entries: 500, tags: 8, name: 60, desc: 200, aliasLangs: 6, aliasesPerLang: 5 };

export interface Tags {
  version: number;
  kinds: string[];
  parts: string[];
  genders: string[];
  genres: string[];
  cultures: string[];
}
export interface Entry {
  id: string;
  kind: string;
  name: string;
  desc?: string;
  aliases?: Record<string, string[]>;
  tags?: string[];
  culture?: string;
  part?: string;
  gender?: string;
}
export interface Pack {
  format: number;
  id: string;
  name: string;
  author: string;
  license: string;
  description: string;
  version: number;
  entries: Entry[];
}
export interface LoadedPack {
  file: string;
  bytes: number;
  hash: string;
  pack: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v === v.trim();
/** Markup, links and control characters never belong in a catalog text. */
const clean = (s: string) => !/[<>\u0000-\u001f]/.test(s) && !/https?:|www\.|\]\(|`/i.test(s);
/** The form names are compared in: lower case, letters and digits only. */
export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export const hashOf = (raw: string) => createHash("sha256").update(raw).digest("hex").slice(0, 16);

/** Problems with one pack, each "where: what"; the path decides the namespace (`packs/<author>/<pack>.json`). */
export function checkPack(rel: string, raw: string, tags: Tags): string[] {
  const out: string[] = [];
  const fail = (where: string, what: string) => out.push(`${where}: ${what}`);
  const m = /^packs\/([a-z0-9][a-z0-9-]{0,31})\/([a-z0-9][a-z0-9-]{0,39})\.json$/.exec(rel);
  if (!m) return [`${rel}: a pack lives at packs/<author>/<pack>.json (lower case letters, digits and -)`];
  if (Buffer.byteLength(raw) > LIMITS.fileBytes) fail(rel, `larger than ${LIMITS.fileBytes} bytes`);
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    return [`${rel}: not valid JSON (${(e as Error).message})`];
  }
  if (!isObj(doc)) return [`${rel}: not an object`];
  const KEYS = ["format", "id", "name", "author", "license", "description", "version", "entries"];
  for (const k of Object.keys(doc)) if (!KEYS.includes(k)) fail(rel, `unknown field "${k}"`);
  if (doc.format !== 1) fail(rel, "format must be 1");
  if (doc.id !== `${m[1]}/${m[2]}`) fail(rel, `id must be "${m[1]}/${m[2]}" (the path is the namespace)`);
  if (!text(doc.name, 80) || !clean(doc.name)) fail(rel, "name: required, up to 80 characters, plain text");
  if (!text(doc.author, 80) || !clean(doc.author)) fail(rel, "author: required, up to 80 characters, plain text");
  if (!text(doc.description, 300) || !clean(doc.description)) fail(rel, "description: required, up to 300 characters, plain text");
  if (!(LICENSES as readonly string[]).includes(String(doc.license))) fail(rel, `license: one of ${LICENSES.join(", ")}`);
  if (!Number.isInteger(doc.version) || (doc.version as number) < 1) fail(rel, "version: a whole number from 1, raised when the pack changes");
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) return [...out, `${rel}: entries: a list with at least one entry`];
  if (doc.entries.length > LIMITS.entries) fail(rel, `at most ${LIMITS.entries} entries`);
  const ids = new Set<string>();
  const EKEYS = ["id", "kind", "name", "desc", "aliases", "tags", "culture", "part", "gender"];
  doc.entries.forEach((e, i) => {
    if (!isObj(e)) return fail(`${rel} entry ${i + 1}`, "not an object");
    const where = `${rel} "${typeof e.id === "string" ? e.id : "entry " + (i + 1)}"`;
    for (const k of Object.keys(e)) if (!EKEYS.includes(k)) fail(where, `unknown field "${k}"`);
    if (typeof e.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(e.id)) fail(where, "id: lower case letters, digits and -, up to 40");
    else if (ids.has(e.id)) fail(where, "id is used twice in the pack");
    else ids.add(e.id);
    if (!tags.kinds.includes(String(e.kind))) fail(where, `kind: one of ${tags.kinds.join(", ")}`);
    if (!text(e.name, LIMITS.name) || !clean(e.name)) fail(where, `name: required, up to ${LIMITS.name} characters, plain text`);
    const isName = e.kind === "name";
    if (e.desc !== undefined && (!text(e.desc, LIMITS.desc) || !clean(e.desc))) fail(where, `desc: up to ${LIMITS.desc} characters, plain text`);
    if (!isName && e.desc === undefined) fail(where, "desc: required for a place, an organization and an item");
    if (e.tags !== undefined) {
      if (!Array.isArray(e.tags) || e.tags.length > LIMITS.tags || new Set(e.tags).size !== e.tags.length || !e.tags.every((t) => typeof t === "string" && tags.genres.includes(t))) fail(where, `tags: up to ${LIMITS.tags} different genres from tags.json`);
    } else if (!isName) fail(where, "tags: required for a place, an organization and an item (at least one genre)");
    if (Array.isArray(e.tags) && e.tags.length === 0 && !isName) fail(where, "tags: at least one genre");
    if (e.culture !== undefined && !tags.cultures.includes(String(e.culture))) fail(where, "culture: a value from tags.json");
    if (isName) {
      if (e.culture === undefined) fail(where, "culture: required for a name");
      if (!tags.parts.includes(String(e.part))) fail(where, `part: ${tags.parts.join(" or ")}`);
      if (e.part === "given" && !tags.genders.includes(String(e.gender))) fail(where, `gender: ${tags.genders.join(", ")} for a given name`);
      if (e.part !== "given" && e.gender !== undefined) fail(where, "gender: only for a given name");
    } else {
      if (e.part !== undefined || e.gender !== undefined) fail(where, "part and gender are only for a name");
    }
    if (e.aliases !== undefined) {
      if (!isObj(e.aliases) || Object.keys(e.aliases).length > LIMITS.aliasLangs) fail(where, `aliases: {lang: [names]}, at most ${LIMITS.aliasLangs} languages`);
      else
        for (const [lang, list] of Object.entries(e.aliases)) {
          if (!/^[a-z]{2}$/.test(lang) || !Array.isArray(list) || list.length > LIMITS.aliasesPerLang || !list.every((a) => text(a, LIMITS.name) && clean(a))) fail(where, `aliases.${lang}: a two-letter language and up to ${LIMITS.aliasesPerLang} plain names`);
        }
    }
  });
  return out;
}

/** The key two entries are the same thing under: a name is a duplicate within its kind (and, for a name, its part and culture); the same words in another kind are fine ("Crown" the place, "Crown" the item). */
export const dupKey = (e: Entry) => [e.kind, e.kind === "name" ? `${e.part}:${e.culture}` : "", norm(e.name)].join("|");

/** Problems across packs: the same entry in two places (or twice in one). Aliases count as names for places, organizations and items. */
export function checkAcross(packs: { rel: string; entries: Entry[] }[]): string[] {
  const out: string[] = [];
  const seen = new Map<string, string>();
  for (const p of packs)
    for (const e of p.entries) {
      if (!isObj(e) || typeof e.name !== "string" || typeof e.kind !== "string") continue;
      const keys = [dupKey(e)];
      if (e.kind !== "name" && isObj(e.aliases)) for (const list of Object.values(e.aliases)) for (const a of Array.isArray(list) ? list : []) if (typeof a === "string") keys.push(dupKey({ ...e, name: a }));
      for (const k of keys) {
        const prev = seen.get(k);
        if (prev && prev !== `${p.rel} "${e.id}"`) out.push(`${p.rel} "${e.id}": "${e.name}" is already in ${prev}`);
        else seen.set(k, `${p.rel} "${e.id}"`);
      }
    }
  return out;
}

/** All pack files under `catalog/packs`, with their text, in a fixed order. */
export function loadPacks(root: string): LoadedPack[] {
  const base = path.join(root, "packs");
  const out: LoadedPack[] = [];
  if (!fs.existsSync(base)) return out;
  for (const author of fs.readdirSync(base).sort()) {
    const dir = path.join(base, author);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      let pack: unknown = null;
      try {
        pack = JSON.parse(raw);
      } catch {
        /* reported by checkPack */
      }
      out.push({ file: `packs/${author}/${f}`, bytes: Buffer.byteLength(raw), hash: hashOf(raw), pack });
    }
  }
  return out;
}

/** The index the engine reads: one row per pack. Written by `bun scripts/catalog.ts --write`, never by hand. */
export function buildIndex(tags: Tags, loaded: LoadedPack[]) {
  return {
    format: 1,
    tagsVersion: tags.version,
    packs: loaded
      .filter((l) => isObj(l.pack))
      .map((l) => {
        const p = l.pack as unknown as Pack;
        const count = (k: string) => p.entries.filter((e) => e.kind === k).length;
        return {
          id: p.id,
          file: l.file,
          name: p.name,
          author: p.author,
          license: p.license,
          description: p.description,
          version: p.version,
          count: p.entries.length,
          kinds: Object.fromEntries(["name", "place", "organization", "item"].map((k) => [k, count(k)]).filter(([, n]) => (n as number) > 0)),
          bytes: l.bytes,
          hash: l.hash,
        };
      }),
  };
}
