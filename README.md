# Assets & Environments Lab

[Public source](https://github.com/Tboy450/assets-and-environments-lab) · [GitHub app](https://tboy450.github.io/assets-and-environments-lab/) · [Claude handoff](HANDOFF.md)

Fresh clone: Node.js 22+, run `npm test`, then `npm start`. No package install is required. The included sanitized showcase supplies the initial catalog; private native archives remain on the owner’s device.

This workspace owns the independent lab copied from the studio created in “Review CSE and continue its todo.” Its viewer, project catalog, imports and asset snapshots are separate from Swarmfall.

Run `Open-Studio.cmd`, then open **http://127.0.0.1:4194/**. Node.js is required; no package install is needed. The previous studio used port 4193. This address is local to this computer.

## Collections

- **All Local Device Assets**: one search across every connected collection, including the asset archive.
- **Asset Archive**: the six Game Asset Library backups plus the extracted Kenney kit.
- **Blender Assets**: 168 previewable models, plus native scenes and FBX/OBJ versions under Source files. The extracted Kenney kit also appears here; collection views reuse the same files and preserve their original credits.
- **Houdini Assets**: native scenes, digital assets, geometry caches and exports; Apprentice work retains its noncommercial terms.
- **Rocket Run**: artwork, fonts, desktop icons and procedural art sources, with a playable local copy.
- **Dragon’s Lair RPG / Tboy450-new-rpg-update**: source uploads, processed sprites, effects, future assets and archived art from the local project copies.
- **Beginner Python Projects**: assets from the two modular pygame folders.

The original Swarmfall environments and Import Demo remain available as separate collections. Selecting a project changes the library and lab branding. Image thumbnails, search, type filters and 48-item pages keep larger collections usable. Standard GLB/glTF, images/GIFs, audio and video have previews; other formats retain source details/downloads. Native files are never executed by the studio.

Explorer keeps a large interactive preview beside the asset tray. Grid retains the earlier card layout. Worlds now includes four Titan height-field snapshots, six Swarmfall campaign biomes, four archived Skyway foundation versions and two RPG layout visualizations. RPG maps adapt preserved layout/color data into a browser inspector; they are not gameplay screenshots. `library/snapshots/2026-10-20/terrain-archive/` preserves the seven source files used for these new views.

Public showcase: https://asset-explorer-tboy450.tboy450.chatgpt.site . Only the asset IDs in `provenance/public-showcase-allowlist.json` are published. New local imports are not published automatically; the six mobile GIFs were explicitly approved for public inclusion on 2026-10-20.

## Independence and backup

`library/snapshots/2026-10-19/` contains copied source assets and the original archive, (6,289 files / 2.83 GB), with SHA-256 copy verification in `provenance/independent-snapshot.local.json`. The snapshot includes license/readme notes and supported sidecars. Scans now read the snapshot folders. Changes to Swarmfall’s lab or its original asset folders do not update these copies.

Back up this **entire workspace**, especially `library/`, `data/`, `sources.local.json`, `studio.config.json` and local provenance receipts. Git ignores the large library, catalog and device-specific settings. A Git commit alone is not a backup of those files. Source assets retain their original terms; copying does not relicense them.

New files can be imported into a project or placed in `library/inbox/` and registered with **Scan inbox**. **Rescan connected folders** refreshes the configured snapshot indexes; it does not refresh them from Swarmfall. For future imports, use new versioned batches rather than overwriting a preserved snapshot. Add further asset folders in `sources.local.json`. This indexes the chosen asset folders rather than crawling every personal folder on the computer.

ZIPs stay intact; archive members appear individually only when an extracted source folder is present. The six original archive checksums/source receipts remain in the copied catalog. Offline/deleted source records are retained and marked unavailable.

## Rocket Run and GitHub

Public source: https://github.com/Tboy450/whitehousegame/tree/codex/horizontal-rocket

All 25 curated local source, test, script and asset files match the public branch’s Git blob SHA at `0800439094a7306632e46d0b6063ea46eb2b3885`. The game is uploaded there. `main` still has only a README because draft PR #1 remains unmerged: https://github.com/Tboy450/whitehousegame/pull/1

The studio links to the public GitHub source and a separate playable local copy. GitHub Pages deployment has not been configured or claimed. The earlier ChatGPT-hosted game remains its existing deployment. See `integration/rocket-run-github-verification.json` for the file comparison. The original game checkout was not modified.

## Validation

Run `node --test tests/*.test.mjs`. The twelve studio checks cover collection membership, browsing, remembered picker folders, import bytes, recovery, path isolation, project branding, route handlers, source indexing, rescans, missing/offline files and Houdini formats. The copied Rocket Run suite has 54 passing checks and its static build succeeds. Browser acceptance is recorded separately in `VALIDATION.md`.

The existing `GAME-INTEGRATION-PLAN.md` retains staged Swarmfall environment integration work. Viewing an asset here does not establish gameplay collision, navigation or damage readiness.
