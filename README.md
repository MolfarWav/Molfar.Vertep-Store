# Molfar Vertep Store

The list of apps shown in the **Store** of [Molfar Vertep](https://github.com/MolfarWav/Molfar.Vertep).
Molfar Vertep reads [`apps.json`](apps.json) from this repository, so an app added here shows up for
everyone, marked as new for people who have Molfar Vertep open.

## Official and community apps

- **Official** apps live under [MolfarWav](https://github.com/MolfarWav) and are maintained by the
  Molfar Vertep maintainers.
- **Community** apps are everything else. They are made by other people and run real code on the
  Molfar Vertep server they are installed on, so Molfar Vertep shows what each app's plugins can do
  before it installs, and asks again when an update wants more.

Official status comes from where an app's repository lives, never from this list: nothing in an
entry can make an app official.

## Add your app

1. Make sure your app installs with **Import app** in the Molfar Vertep launcher. The repository must
   be public and have `manifest.json` at its root.
2. Fork this repository and add an entry at the end of `apps.json`:

   ```json
   {
     "id": "my-app",
     "name": "My App",
     "description": "What it does, in a sentence or two.",
     "author": "Your name",
     "repository": "https://github.com/you/my-app",
     "tags": ["notes"],
     "added": "2026-10-02"
   }
   ```

   - `id`: lowercase letters, digits, `-` and `_`, up to 64 characters, unique in the list.
   - `name` up to 80 characters, `description` up to 500, `author` up to 80.
   - `repository`: an `https://` git URL. Optional `ref`: a branch or tag to install.
   - `tags`: up to 8, lowercase, up to 32 characters each.
   - `added`: the day you add it, `YYYY-MM-DD`.
3. Run `bun scripts/validate.ts --clone` (it checks every entry and that each repository has a
   `manifest.json`), then open a pull request.

## The shared catalog

[`catalog/`](catalog) holds a shared base of standard things for stories and worlds: **names** (given and
family, by culture), **places**, **organizations** and **items**, each with a short description and tags for a
direction or style (`fantasy`, `cyberpunk`, ...). Apps use it to look a thing up before they invent it, and to
offer names that are not the model's usual ones. Nothing in it is tied to a named world. Design and
decisions: [Molfar.Vertep#373](https://github.com/MolfarWav/Molfar.Vertep/issues/373).

- `catalog/tags.json`: the fixed tag vocabulary. Need a new tag? Ask for it in your pull request.
- `catalog/packs/<author>/<pack>.json`: a pack. The path is its namespace, so an entry's full id is
  `<author>/<pack>:<id>`.
- `catalog/index.json`: the list of packs with a content hash. **Never edit it by hand**: a check on `main`
  rewrites it (`bun scripts/catalog.ts --write`).

### Donate a pack

1. Write a pack file (the app's "Donate" flow will make one from your lorebook or world; until then by hand).
   Content licence **CC0-1.0** or **CC-BY-4.0** (your name is shown). No names, places or items from published
   works, games, films or franchises, no real people, brands or towns, nothing tied to a named world, nothing
   adult.
2. Put it at `catalog/packs/<your-nick>/<pack>.json` and run `bun scripts/catalog.ts`. It checks the shape,
   the tags and the limits (a pack: at most 200 KB and 500 entries; a description at most 200 characters), and
   that nothing is already in the catalog under the same name.
3. Open a pull request. The check runs again; the owner reads one clean diff and merges. No GitHub account?
   Send the file to the owner and he adds it.

An entry:

```json
{ "id": "ash-gate", "kind": "place", "name": "Ash Gate", "desc": "A burnt-out city gate where smugglers meet.",
  "aliases": { "uk": ["Попелясті ворота"] }, "tags": ["dark_fantasy", "medieval"] }
{ "id": "olena", "kind": "name", "name": "Олена", "culture": "ukrainian", "part": "given", "gender": "f" }
```
