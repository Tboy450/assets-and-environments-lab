# Validation — October 19, 2026

October 20 update:

- Terrain/collection update: 12 tests pass. Blender now shows 168 compatible model previews in Explorer and Grid, reusing the 167 archived Kenney GLBs plus the existing foundation model. Shared FBX/OBJ and native Blender sources are also visible in Blender's Source files without duplicating file storage.
- Added 16 Worlds entries: four Titan height-field snapshots, six campaign biomes, four retained Skyway foundation passes and two RPG world-layout maps. All have actual rendered thumbnails. RPG region tapping and both beach/plains map versions were verified in the browser; these are labeled visualizations rather than gameplay screenshots.
- Seven source files were preserved with SHA-256 receipts in library/snapshots/2026-10-20/terrain-archive; private provenance is data/terrain-archive-receipt.local.json. The source project folders were read only.
- Public version 2 deployed successfully, source 879fecab45fc995d1d85003cd0bf46b3568b97c6. Its catalog contains 1,054 allowed entries and 244 thumbnails. Browser verification confirmed the live Blender count of 168. The six mobile GIFs remain excluded.

- Studio: 11 tests pass, including animation grouping, image-first sorting and remembered Windows picker folders.
- Explorer and retained Grid both browse the independent catalog. Browser checks covered Dragonfly's 37 model views, actual thumbnails, RPG animation playback and a split glTF web copy of the larger Houdini export.
- Desktop at 1440×900 and phone widths 390 and 320 fit without horizontal page overflow. Asset details remain scrollable on phones. The real Windows native dialog was not opened during verification; folder selection logic and remembered defaults passed the injected-chooser test.
- Six mobile GIFs (25,770,400 bytes) were moved from Downloads to Game Asset Library/Effects/Animated/mobile-2026-10-20 and independently imported into the lab. SHA-256 matched archive bytes, lab storage and served downloads before Downloads entries were removed. Private receipt: data/mobile-effects-import-2026-10-20.json.
- Those six GIFs are excluded from the public showcase. Publication uses the explicit 1,038-asset allowlist; native files and local device paths remain excluded.
- Separate public showcase successfully deployed on October 20: https://asset-explorer-tboy450.tboy450.chatgpt.site (version 1, source 4b2f9f5e54e48e3ed53b59d6055c0725cc71bbc0). The public package contains 228 actual rendered thumbnails. Windows packaging used installed Git Bash with TAR_OPTIONS=--force-local. The original Swarmfall site was not deployed by this task.

- Studio: 9 tests pass (imports/recovery, path isolation, project branding, routes, rescan idempotence, offline sources and Houdini formats). Windows atomic catalog writes now retry transient file locks while retaining the prior catalog and temporary file on failure.
- Rocket Run: 54 tests pass; static build succeeds. All 25 curated local files match the public GitHub branch at 0800439094a7306632e46d0b6063ea46eb2b3885.
- Independent library: 6289 copied files / 2832186786 bytes verified. 215 OneDrive placeholders restored from local committed Git objects, with object-hash and size checks; eight legacy PNGs copied through Windows and SHA-256 compared.
- 159 unavailable supplemental Python/doc sidecars are listed in the private receipt. No indexed asset file is unavailable. These extra code/doc files are outside the asset catalog.
- Catalog: 1045 entries, no missing source assets. All indexed source/archived asset roots point inside this workspace. Source paths remain in the private copy receipt.
- Browser: library loads with the full collection picker, 48-item pages and 216 RPG entries; sampled RPG sprites load. GLB model viewer renders the Kenney tree. Its inherited demo originally missed Textures/colormap.png; the sidecar has been added through the real import endpoint. Browser verification confirmed the restored green canopy and brown trunk. Rocket Run’s local menu and both source/play links also load.
- Swarmfall baseline: the read-only original-source comparison now reports four source files changed since the inherited snapshot (the other Dragonfly chat is active). The independent copies of all four still match the recorded baseline hashes. This workspace did not write to the original game or its deployment.
- Native Blender/Houdini sources are preserved, not executed or re-authored. Dependencies referring outside an original native scene may need path remapping when opened in the authoring application.
- GitHub Pages for Rocket Run is not deployed by this task. The public source branch is complete; main still awaits draft PR #1.
