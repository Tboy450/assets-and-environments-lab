# Assets & Environments Lab — handoff for Claude

## Project and links

- Public source: https://github.com/Tboy450/assets-and-environments-lab
- GitHub Pages app: https://tboy450.github.io/assets-and-environments-lab/
- Existing hosted fallback, retained: https://asset-explorer-tboy450.tboy450.chatgpt.site
- Read AGENTS.md first. Native asset archives, device paths and the six mobile GIF imports remain private under the latest owner instructions.

## Run a fresh clone

Requires Node.js 22 or newer. The app has no npm dependencies to install.

```sh
git clone https://github.com/Tboy450/assets-and-environments-lab.git
cd assets-and-environments-lab
npm test
npm start
```

Open http://127.0.0.1:4194/. A fresh local clone creates its own writable catalog from the committed showcase and resolves media from showcase/public-assets. It does not need the original owner's device folders. Existing local catalogs are retained. Windows users can also run Open-Studio.cmd.

```sh
npm run build:pages
node scripts/preview-pages.mjs
```

Preview the Pages subpath at http://127.0.0.1:4268/assets-and-environments-lab/. Pages publishes through .github/workflows/pages.yml when main changes. GitHub Actions runs the tests before deploying.

## Current behavior

- Explorer provides a large preview with category buttons, search, favorites, previous/next navigation and asset details.
- Grid preserves the earlier gallery layout at library.html.
- Blender shows 168 previewable models: 167 archived Kenney GLBs plus the existing foundation model. Collections are views of the same catalog entries, not duplicate files.
- Dragonfly includes 37 rotorcraft/system model views and four terrain snapshots.
- Worlds includes 16 additional studies: four Titan snapshots, six Swarmfall campaign biomes, four Skyway foundation versions and two RPG world maps. Combined with the original five worlds, the aggregate view has 21 Worlds entries.
- RPG maps adapt actual preserved Python layout/color data into a browser inspector. They are labeled visualizations, not gameplay screenshots.
- PNG/GIF characters are image assets; GLB/glTF characters are model assets. Semantic Character/Prop/Terrain tags have been discussed, but the owner has not requested their implementation yet.
- The public showcase contains 1,054 allowed catalog entries and 244 real preview thumbnails. Native file metadata can appear without the underlying private binary.
- The local app has imports and a Windows native picker with remembered collection folders. These write tools are hidden in the static public app.

## Source map

- site/index.html, site/studio/explorer.mjs, explorer.css: Explorer UI.
- site/library.html, site/studio/library.mjs, style.css: Grid UI.
- site/studio/collections.mjs: collection membership, including Blender's shared kit entries.
- site/studio/browse-data.mjs: categories, image-first sorting and animation grouping.
- site/studio/viewer.mjs, preview-model.mjs, thumbnails.mjs: media/model rendering and real preview captures.
- site/studio/terrain-model.mjs, terrain-map.mjs, terrain-manifest.json, terrain-sources/: terrain and RPG layout adapters.
- server.mjs and lib/: local-only HTTP, storage, imports, bootstrap and source indexing.
- showcase/: committed portable public snapshot, including catalog, browser assets and thumbnails.
- scripts/build-github-pages.mjs: rebases showcase resource roots to the repository subpath. Keep virtual /api route identifiers and split('/') expressions intact.
- scripts/build-public-showcase.mjs: owner-device export builder. It uses private local catalog/snapshots and the public allowlist; it is not required to build Pages from a fresh clone.

## Validation and next work

A clean-copy startup check loaded 1,054 entries, resolved all 573 public media files, and kept 402 native source entries unavailable for download. Explorer model rendering and Grid-to-Explorer navigation were verified at the GitHub Pages subpath.

Thirteen tests pass, including a fresh-clone regression check for converted glTF files whose original import-batch path no longer exists. The Blender count was checked in Explorer and Grid. The source app and terrain previews were checked in the previous hosted version.

When changing the Pages output, verify actual Three.js imports, GLB/glTF texture dependencies, category navigation, Grid switching and RPG animation playback at the repository subpath. Check phone and desktop views. Save meaningful screenshots; do not merely claim the layout was touched up.

Suggested continuation: review usability with the owner, then implement only the next requested change. Do not modify or deploy the original Swarmfall/Dragonfly site. Keep credits and source/license notices; public visibility does not relicense third-party assets.

## What stays local

library/, data/, .runtime/, sources.local.json, studio.config.json, local receipts and recovery archives are ignored by Git. The raw asset library is about 2.86 GB and includes native Blender/Houdini sources and original downloaded archives. It is not included in the public repository or a public release. The public repository includes the complete runnable lab source and the sanitized browser asset snapshot instead.

The six user-supplied animated GIFs were independently copied and SHA-256 verified before being moved out of Downloads. They remain outside the public allowlist. Do not publish them or any new native import without explicit owner authorization.

## Recovery note

Several local helper files were found containing only zero bytes during handoff validation. The runtime store was recovered from its archived source and the portable test/Pages preview were reconstructed. Damaged one-time snapshot/terrain preparation helpers are preserved locally under archive/corruption-2026-10-20 and excluded from this repository pending recovery. Existing generated terrain data and the runnable app remain included. Do not rerun those private preparation helpers without recovery.

Catalog visibility on 2026-10-20: 1,054 of 1,107 entries (95.2%) appear publicly; 53 (4.8%) remain private. This measures catalog entries, not original binaries or bytes. Public metadata/previews do not imply that the corresponding native source file is public.

Public visibility breakdown (catalog entries): 652 public files or interactive previews (58.9%), 402 metadata-only listings with private native binaries (36.3%), and 53 fully private entries (4.8%). The six mobile GIFs remain private.
