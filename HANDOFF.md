# Asset Explorer — Claude handoff

## Start here

- Public repository: https://github.com/Tboy450/assets-and-environments-lab
- GitHub Pages app: https://tboy450.github.io/assets-and-environments-lab/
- Retained Site fallback: https://asset-explorer-tboy450.tboy450.chatgpt.site
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

## Verified completed work

- All 1,336 app/source and approved showcase files were checked against local commit f12d0367dc65459b0c9ceb7eed7003e749d44036: none missing or changed. The source/media publication commit is 4f455f2cb820dd1220bb30e24d32632c64d0006a.

- The six mobile GIFs are approved in provenance/public-showcase-allowlist.json and present in both public snapshots.
- Existing Site version 3 was deployed successfully on 2026-10-21, from source commit 43192e68be7123a4bf4bafe17df5ab5155481fb2.
- The live catalog contains 1,060 entries, including all six GIF IDs. All six media URLs returned HTTP 200 with image/gif content type.
- Public GIF copies match their original SHA-256 receipts. Imports and source/license notes remain intact.
- scripts/import-mobile-effects.mjs was rebuilt as JavaScript after its previous contents were replaced by an unrelated Python fragment. This is a reconstruction, not recovered original code. The damaged copy is retained in the owner's ignored archive/ folder.
- All 15 local tests pass, including byte preservation, duplicate prevention on rerun and rejection of an invalid sixth GIF before catalog mutation.

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
