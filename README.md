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
