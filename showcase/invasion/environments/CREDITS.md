# Asset & Environment Lab — sources and modifications

October 19 Scout comparison: the current hull/sensor polish and original pre-polish template
are original Swarmfall gameplay artwork. Original/polished inspection links were added by
Codex (OpenAI); the original template is retained unchanged for comparison. Neither version
is licensed as CC0 or claimed to depict real hardware. Art/device acceptance remains pending.

October 19: original procedural smoke, fire and ember shaders, fracture emission metadata,
bounded local firelight and preview controls by Codex (OpenAI). No image-generation service,
downloaded VFX imagery or franchise assets were used. These are invented visual aftermath
studies, not physical fire simulation or implemented gameplay burning. Supported individual
architecture assets now have derivative destruction previews; their intact source geometry
and the creator/license notices below are retained. No imported source file was overwritten.

October 17 public release adds an individual asset inspector for four existing Swarmfall
procedural drone models, five Quaternius urban buildings/props and nine Kenney fantasy pieces.
Their original geometry and materials are retained on a fit-to-view inspection stand. Drone
geometry remains the existing Swarmfall game artwork; this does not relicense it as CC0.
The Quaternius and Kenney notices/source links below remain the relevant kit attribution.
The viewer's stand, inspection cameras and grouped catalog were added by Codex (OpenAI).

Five separate visual studies by Codex (OpenAI), October 16, 2026. Original architecture, dimensions,
layout, terrain and lighting are invented visual designs. No image-generation service was used.

## Imported runtime models

- **carlcapu333, cyberpunk City.** https://blendswap.com/blend/21664
  (legacy archive ID 91935), [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
  Used in **Skyway megacity**. Original untextured architecture converted from Blender with
  modifiers applied. New ceramic/metal PBR palette, normalized scale and merged render batches
  by Codex; original source, included license notice and inspection report retained. No source
  geometry was decimated. Embedded scripts disabled; original Blender file not overwritten.
- **Voxelatio, drone City.** https://blendswap.com/blend/27360 — CC0 listing.
  Used in **Phototextured city**. Packed facade/roof images retained, with a 1024 px texture
  cap; animation omitted, modifiers applied, scale normalized and meshes grouped by material
  for rendering. Original Blender scene preserved. Some source textures are intended for
  aerial views; a close camera can expose their low resolution. This is an adaptation study,
  not a claim that every storefront/texture has been redesigned as alien architecture.

- **Quaternius, Downtown City MegaKit, free Standard edition.**
  https://quaternius.itch.io/downtown-city-megakit — CC0 1.0.
  Selected complete buildings: `Building_Large_2`, `Building_Medium_2_001`, `Building_Small_1`;
  supporting `Prop_ACUnit`, `Prop_Planter_Single`. Original glTF geometry/buffers retained.
  Textures reduced to at most 512 × 512 pixels for the browser test; transforms and placement
  are authored in `worlds.mjs`. Local license: `assets/downtown/LICENSE.txt`.
- **Kenney, Fantasy Town Kit 2.0.** https://kenney.nl/assets/fantasy-town-kit — CC0 1.0.
  Selected modular GLB pieces and their texture are preserved in `assets/fantasy/`;
  `wall-wood-window-shutters` is used in the inhabited citadel district. The remaining selected
  pieces are available for further composition. Original files unchanged; placement and scale
  changed. Local license: `assets/fantasy/LICENSE.txt`.
- **three.js r180**, official npm package `three@0.180.0`, MIT.
  https://github.com/mrdoob/three.js/tree/r180
  GLTFLoader, BufferGeometryUtils and OrbitControls addons copied unchanged. Existing core and
  license are in `dist/vendor/three/`; addon provenance is recorded in that folder's README.

## Original composition

Cyberpunk City / Skyway now adds original contoured coastal land, individual footing pads,
access roads and ocean water around the preserved source architecture. Contact points inform
the drawing, not structural calculations. The broad intermediate plinth is archived; the
flat-ground version remains available through the credits panel for comparison.

Owner review selected the second low-coast draft as the default. Full base fitting is still
unfinished. The later full-height terrain envelope buried architecture and is archived;
it is not the current default. The first raised platform and second low coast are selectable
historical comparisons. Gallery titles are Skyway megacity and Phototextured city.

The preserved Blender Skyway variant adds an original Geometry Nodes foundation derivative:
selected actual underside contacts from carlcapu333's CC-BY 3.0 city, with structural fill
projected onto the unchanged second coast using Raycast. Source architecture, coastal land
and earlier versions remain intact. This is visual support geometry; inspection/refinement,
collision and authored tunnels remain open. The credits panel retains the plain second coast.

The October 17 **Houdini coastal terrain** variant replaces that structural fill with a
connected landscape authored in Houdini 22.0.466 Apprentice. HeightField projection of selected
actual undersides, coast blending, protected contact edges and adaptive triangulation fit the
ground without extending source buildings. The animated ocean is retained from the second
coast. Contact shapes derive from carlcapu333's city (CC-BY 3.0); terrain authoring, converted
mesh and viewer integration by Codex. The source geometry and all earlier variants are retained.
The local editable Houdini project uses Apprentice's Non-Commercial edition. These remain
visual prototype assets; full artistic review, collision and campaign integration are open.

Alien arcology: radial ceramic towers, skyways, canals, landing pads and planetary setting.
Metropolis: connected street grid, civic park, financial landmarks, waterfront and lower-detail
distant skyline. Tidal citadel: terraces, original curved roofs, spires, bridges, cliffs,
waterfalls and alien sea, with the Kenney wall pieces in lower houses.

The skyline and terraces are visual prototypes, not geographic data. The city layout is not
yet connected to game collision, pathfinding, zone capture, damage or campaign saves. Pilot
view is a free-flight camera with no collision. Performance counters describe the current
browser/device, not verified phone benchmarks. Light mode reduces resolution and shadows;
streaming and distance-dependent replacement remain follow-ups.

## October 17 destruction art variants

All five environments now include procedural derivative geometry for Damaged, Major
destruction and Ruins, with Intact retained. Codex authored the structural grouping, jagged
facade cuts, exposed cross sections, bent rods and settled rubble in `city-damage.mjs`.
Source UVs are retained, materials are roughened/darkened and alien/stone/urban debris uses
different shapes and palettes. This is a geometric art study, not simulated structural failure.
The cities' original authors and licenses above also apply to their modified architecture;
cyberpunk City remains attributed to carlcapu333 under CC-BY 3.0. Terrain/water and protected
citadel foundation terraces remain intact. No image generation or proprietary game geometry
was used. Battle-triggered damage, local building collision, persistence and art cleanup are
still follow-ups. The browser builds variants from retained sources without overwriting them.

## Preserved source backups

Original downloaded archives/scenes remain in the separate reusable local library:
`Documents/Game Asset Library/`. Its README, JSON catalog, source receipts,
archive inventories and SHA-256 checksums track the actual backups and pending downloads.
Downloads copies and earlier project work were retained. Browser derivatives are additional
files; no current Swarmfall planet or simulator environment was replaced.

Cyberpunk City and drone City now have separate converted runtime tests. Their original source
backups remain unchanged. HY-21 and Hidden Alley are preserved backups, not runtime imports;
they still need separate conversion/material/dependency inspection.
Paid Synty assets and proprietary Skyrim/Minecraft/Spider-Man/Crackdown/Kakarot geometry have
not been copied into the gallery. Earlier screenshots remain reference-only research.
