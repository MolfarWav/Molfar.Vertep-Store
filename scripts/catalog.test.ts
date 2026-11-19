import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { buildIndex, checkAcross, checkPack, norm, type Tags } from "./catalog-lib";

const tags: Tags = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "..", "catalog", "tags.json"), "utf8"));
const REL = "packs/molfar/test.json";
const pack = (entries: unknown[], extra: object = {}) =>
  JSON.stringify({ format: 1, id: "molfar/test", name: "Test", author: "Molfar", license: "CC0-1.0", description: "A test pack.", version: 1, entries, ...extra });
const place = { id: "ash-gate", kind: "place", name: "Ash Gate", desc: "A burnt-out city gate.", tags: ["dark_fantasy"] };
const given = { id: "olena", kind: "name", name: "Olena", culture: "ukrainian", part: "given", gender: "f" };

test("a good pack passes", () => {
  expect(checkPack(REL, pack([place, given, { ...given, id: "kovalenko", name: "Kovalenko", part: "family", gender: undefined }]), tags)).toEqual([]);
});

test("the path is the namespace and the pack must say so", () => {
  expect(checkPack("packs/Molfar/test.json", pack([place]), tags)[0]).toContain("lives at packs/<author>/<pack>.json");
  expect(checkPack(REL, pack([place], { id: "other/test" }), tags).join()).toContain('id must be "molfar/test"');
});

test("shape: unknown fields, licence, tags, links and markup are refused", () => {
  const bad = (e: object) => checkPack(REL, pack([{ ...place, ...e }]), tags).join(" | ");
  expect(bad({ mana: 3 })).toContain('unknown field "mana"');
  expect(bad({ tags: ["World of Ash"] })).toContain("tags:");
  expect(bad({ tags: [] })).toContain("at least one genre");
  expect(bad({ desc: undefined })).toContain("desc: required");
  expect(bad({ desc: "See https://example.com" })).toContain("desc:");
  expect(bad({ name: "<b>Gate</b>" })).toContain("name:");
  expect(bad({ kind: "monster" })).toContain("kind:");
  expect(bad({ id: "Ash Gate" })).toContain("id:");
  expect(bad({ gender: "f" })).toContain("only for a name");
  expect(checkPack(REL, pack([place], { license: "MIT" }), tags).join()).toContain("license:");
  expect(checkPack(REL, pack([place], { license: "CC-BY-NC-4.0" }), tags).join()).toContain("license:");
});

test("names need a culture and a part; a given name needs a gender, a family name has none", () => {
  const bad = (e: object) => checkPack(REL, pack([{ ...given, ...e }]), tags).join(" | ");
  expect(bad({ culture: undefined })).toContain("culture: required");
  expect(bad({ part: undefined })).toContain("part:");
  expect(bad({ gender: undefined })).toContain("gender:");
  expect(bad({ part: "family" })).toContain("only for a given name");
});

test("the same id twice, an empty pack and broken JSON", () => {
  expect(checkPack(REL, pack([place, place]), tags).join()).toContain("used twice");
  expect(checkPack(REL, pack([]), tags).join()).toContain("at least one entry");
  expect(checkPack(REL, "{nope", tags)[0]).toContain("not valid JSON");
});

test("duplicates across packs: same kind and words (aliases too), not the same words in another kind, names by part and culture", () => {
  const a = { rel: "packs/molfar/a.json", entries: [place as never, given as never] };
  const same = { rel: "packs/x/b.json", entries: [{ ...place, id: "p2", name: "ASH-gate" }] as never };
  expect(checkAcross([a, same]).join()).toContain("is already in");
  const aliasHit = { rel: "packs/x/b.json", entries: [{ ...place, id: "p2", name: "Cinder Gate", aliases: { uk: ["Ash Gate"] } }] as never };
  expect(checkAcross([a, aliasHit]).join()).toContain("is already in");
  const item = { rel: "packs/x/b.json", entries: [{ id: "i1", kind: "item", name: "Ash Gate", desc: "A key.", tags: ["fantasy"] }] as never };
  expect(checkAcross([a, item])).toEqual([]);
  const family = { rel: "packs/x/b.json", entries: [{ ...given, id: "o2", part: "family", gender: undefined }] as never };
  expect(checkAcross([a, family])).toEqual([]);
  const otherCulture = { rel: "packs/x/b.json", entries: [{ ...given, id: "o3", culture: "polish" }] as never };
  expect(checkAcross([a, otherCulture])).toEqual([]);
  expect(checkAcross([a, a])).toEqual([]);
});

test("the index counts kinds and carries the hash; norm keeps letters of every script", () => {
  const raw = pack([place, given]);
  const idx = buildIndex(tags, [{ file: REL, bytes: raw.length, hash: "abc", pack: JSON.parse(raw) }]);
  expect(idx.packs[0]).toMatchObject({ id: "molfar/test", count: 2, kinds: { name: 1, place: 1 }, hash: "abc", file: REL });
  expect(norm("Попелясті Ворота!")).toBe("попелястіворота");
});
