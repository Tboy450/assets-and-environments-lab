# Standalone studio change log

## 2026-10-22 — Review follow-ups: safer saves, one entry per file, light GIF previews

- **Signed:** Claude (Anthropic).
- Catalog saves flush to disk before the atomic rename, so a crash leaves the old or new
  catalog rather than a zero-filled file; imported files are flushed before they are renamed.
- Unchanged catalogs are no longer rewritten, so restarts and no-op scans stop adding history
  copies. Existing history is retained.
- All collections lists each file once: Swarmfall's nine byte-identical copies of archived Kenney
  models are hidden there (Models 228 -> 219); the Swarmfall collection still shows them.
- New scripts/make-gif-thumbnails.py makes 320 px animated WebP previews for public GIFs. Lists
  and Grid use them; the preview and download still use the original GIF. Nine GIFs: 43.1 MB -> 2.2 MB.
- 17 tests pass (two new: unchanged-catalog restart, All collections dedupe).

## 2026-10-19 — Initial independent local asset/environment studio

- **Signed:** Codex (OpenAI).
- Copied 184 tracked runtime/asset files (71,140,060 bytes) from Swarmfall `7ab195e` into a
  new local project. No upstream workflow/remote, public deployment, original source writes,
  source-archive moves or asset deletion. Hashes verify all 184 original files unchanged.
- Added project collections, project-name/filename branding, native-source import batches,
  folder sidecars, SHA-256 receipts for uploaded bytes, catalog history and repeatable inbox
  scans. Existing source-library catalog/files are referenced read-only with original notes.
- Reused the copied five environments/eighteen asset entries and Scout history selector;
  added standard GLB/glTF/image inspection and native Blender/archive retention/downloads.
  Models' external remote dependencies are disabled; no native-file execution or auto-unzip.
- Seeded three projects/30 entries, including a real imported CC0 Kenney GLB demo. Initial
  source receipts/checksums are copied metadata, not a new hash verification of 1.84 GB.
- Added a staged gameplay-integration plan: a small Metropolis district, shared transforms/
  surfaces/collision, authored courts, local damage, compatible saves, measured graphics,
  then pilot handoff. No playable city integration is claimed.
- **Checks:** 7 local tests pass; actual handler in-process checks exercise imports/download
  bytes, native retention, duplicate protection, paths, history, read-only links, partial
  files and text branding. Node syntax checks pass. Local server started and startup log/PID
  checked. Native HTTP/browser/GPU/phone acceptance remains open: sandbox denied an outbound
  loopback connection, and previously restricted browser automation was not retried.
- **Location:** separate allowed visualization workspace. The preferred Game Asset Library
  folder is outside current write roots; approval review failed on Git fetch with an account
  usage-limit error, not a finding that copying assets was unsafe. No alternate route was used
  to perform the denied operation. Transfer instructions are in README; no transfer claimed.
- **Next:** browser acceptance, long-term folder transfer when authorized/access available,
  optional Blender conversion, metadata/readiness editing and reviewed game-package export.

## October 19, 2026 — Workspace expansion

Moved the independent studio into the assets and environments lab workspace, created the All Local Device Assets collection and project indexes, and made verified private source snapshots. Added Houdini formats, image/GIF/audio/video previews, thumbnails, search and pagination. Linked Rocket Run to its verified public GitHub source branch and supplied a separate local game copy. Added Windows atomic-write retry handling and repaired the inherited demo texture sidecar. Original Swarmfall and game checkouts were not modified.
