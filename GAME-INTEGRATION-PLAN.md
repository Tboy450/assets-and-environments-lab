# From lab art to a Swarmfall battle

October 19, 2026 — Codex. This plan is stored in the independent studio. It does not change
the original campaign, source lab, public link or existing master checklist status.

Start with one **Metropolis district** as a separate optional test mission. Its explicit grid
and modular buildings make it a smaller first task than routing through all of Skyway.
Keep Skyway, Phototextured City, Alien arcology and Tidal citadel as distinct later settings.
Use a full city as distant context around a proposed roughly 0.8–1 km active district; agree
scale against drone size before reusing the lab's invented fit-to-view/2 km normalization.

| Stage | Concrete implementation | Acceptance before expanding |
| --- | --- | --- |
| 1. Environment contract | Plain versioned district manifest: original source ID, project/license receipt, transform/units, stable structure IDs, render chunks, surface IDs, obstacle/height data, authored objective sites and drop courts. Preserve component IDs before merging by material. | Geometry and rules use the same transforms; one known point/height agrees across both. Import/preview does not imply battle-ready. |
| 2. Optional district loader | Prepare renderer/collision/surfaces asynchronously before creating the battle; show progress/retry/cancel. Keep the seven-planet campaign working. Use a separate test save namespace initially. | Failed/cancelled loading preserves the current mission and releases partial resources. |
| 3. Terrain and surfaces | Reuse fitted terrain; authored streets/terraces/bridges have distinct surface IDs/heights. Pick the intended surface instead of flattening pads through buildings. | A bridge and its road below both work; click destinations match real geometry. |
| 4. Drone/defender movement | Scouts, Links, Strikers and Breachers stay flying with clearance, climb limits and alternate routes. Dragonfly alone retains landing/drilling. Ground defenders use street/bridge connections. Add world-height-aware combat/line of sight. | No flying through facades, buried defenders, under-bridge order errors or shots through solid buildings. |
| 5. Authored capture and descent | Put capture sites and defenders at reachable surfaces. Validate the full parachute descent corridor, pod footprints and formation space. No arbitrary rings inside imported towers. | Existing 1–3 drone pods, solo Dragonflies and victory/continue work in the district. |
| 6. Local damage | Stable per-building health/state switches only the struck structure to its matching remnants. Update collision/supports/routes/drop courts at the same transition; bound debris/smoke/fire. | One hit does not rebuild/destroy the whole city; reload preserves exact local states. |
| 7. Saves and performance | Persist manifest/version/IDs and plain command/damage state, then reattach runtime queries on load. Chunk/cull distant skyline and cap active effects. | Paused restore, old campaign compatibility and measured High/Light desktop/phone budgets pass. |
| 8. Pilot mode | First/third-person control of an actual drone uses the same collision, altitude, targeting and damage rules. Other squads retain orders; return to RTS is explicit. | Whole district works in command mode first, then pilot handoff and both cameras pass. |

City-specific follow-ups: Skyway needs owner review of high rear land and full support/route
data; Phototextured City needs close materials/alien dressing and batching/chunking; Tidal
citadel needs explicit terrace/bridge connectivity; arcology needs tower/ring clearance and
reachable courts. Preserve all foundation passes. Retain the existing source/license and
Houdini Apprentice provenance for derived terrain and review reuse conditions before exports.

The reusable studio should eventually export an **approved package** containing GLB chunks,
plain manifest, collision/surface/damage metadata, preview images and source/license receipts.
It should never auto-push packages into a game's production map. Stages are import/source,
inspectable, art-reviewed, collision-ready, battle-tested and approved-for-release. An asset
being visible in the lab only completes the inspectable stage.

Next actual gameplay step: author one small district manifest and prove aligned render/surface
queries before changing movement or campaign selection. This task is planned, not implemented.
