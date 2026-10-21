# Asset Explorer — Claude handoff

## Start here

- Public repository: https://github.com/Tboy450/assets-and-environments-lab
- GitHub Pages app: https://tboy450.github.io/assets-and-environments-lab/
- Retired, owner-only legacy copy: https://asset-explorer-tboy450.tboy450.chatgpt.site
- Latest status summary: [HANDOFF-STATUS.md](HANDOFF-STATUS.md)
- Deployment checks: https://github.com/Tboy450/assets-and-environments-lab/actions/workflows/pages.yml
- Read AGENTS.md. This file describes the app and its current state; conversation history and personal asset reports are not included.

## Run locally

Requires Node.js 22 or newer. No package installation is required.

```sh
git clone https://github.com/Tboy450/assets-and-environments-lab.git
cd assets-and-environments-lab
npm test
npm start
```

Open http://127.0.0.1:4194/. A fresh clone builds a writable local catalog from showcase/studio/public-data.json. It does not need the owner's device folders. Existing local catalogs are preserved.

## Verified current state — 2026-10-21

- GitHub Pages is the primary public app. The public cleanup was published in commit e7872b32a115b0896e5c0029ceb84b6c2f72dacc; its Actions run passed.
- Its catalog has 1,058 entries. Import Demo is absent, and public CREDITS.md has no device path. All six approved mobile GIF URLs return HTTP 200.
- The old chatgpt.site copy is retired from public access: its custom access policy allows only the owner, with no other users or groups. Anonymous requests to its homepage and CREDITS.md return HTTP 401. Its content was preserved, not deleted.
- Public GIF copies retain their original bytes and source/license notes.
- The corrupted mobile-effects importer was reconstructed as JavaScript, with its damaged copy retained in the owner's ignored archive.
- The 15-test suite and the fresh-checkout catalog check passed in GitHub Actions.

## Source map

- site/index.html and site/studio/explorer.mjs / explorer.css: Explorer layout.
- site/library.html and site/studio/library.mjs / style.css: retained Grid layout.
- site/studio/collections.mjs and browse-data.mjs: collection membership, categories and ordering.
- site/studio/viewer.mjs, preview-model.mjs and thumbnails.mjs: previews and thumbnails.
- site/studio/terrain-*.mjs, terrain-manifest.json and terrain-sources/: terrain/RPG visualization adapters.
- server.mjs and lib/: local HTTP service, catalog, storage, imports and portable bootstrap.
- showcase/: sanitized portable public snapshot, catalog and browser media.
- scripts/build-github-pages.mjs and .github/workflows/pages.yml: GitHub Pages build and publication.
- scripts/import-mobile-effects.mjs: manual local copy-only import of the six GIFs; takes SOURCE_FOLDER. It accepts original numbered or descriptive filenames. Repeated imports skip existing checksums. It never publishes assets automatically.

## Build the public app

```sh
npm run build:pages
node scripts/preview-pages.mjs
```

Preview http://127.0.0.1:4268/assets-and-environments-lab/. The Pages workflow runs tests and builds from the committed showcase; no owner-device archive or Sites login is needed.

Explorer and Grid are both retained. Blender shows compatible shared models through collection views, without duplicating files. Browser model/terrain previews do not establish playable-game readiness.

## Boundaries and known limitations

- Never modify or deploy the original Swarmfall project/public link. This is a separate lab.
- No imagegen/image_gen. Use code, Blender or other suitable graphics tools.
- Keep native imports, device paths, local settings, catalog history and personal reports private. Publish only allowlisted asset IDs.
- The six GIFs are approved for public inclusion; their creator/reuse rights remain recorded as unreviewed. Preserve existing notices.
- Retain inherited ?v=dev references. Archive inherited behavior changes with restore notes.
- GIF list thumbnails currently use the original GIF files, including one around 16 MB. Phone bandwidth optimization remains a possible future task.
- Older one-time snapshot/terrain preparation helpers were crash-damaged and excluded from the public source. Their generated terrain data is included; the app and Pages build do not need those helpers. The owner's archive/ folder contains recovery evidence.

Continue with the owner's next requested change. There is no need to import conversation history or publish their personal asset-count report.
