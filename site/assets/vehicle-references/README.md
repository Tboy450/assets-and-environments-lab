# Vehicle reference media

Credit: Johns Hopkins Applied Physics Laboratory. These are reference visualizations,
not live simulator output or verified as-built flight CAD. No endorsement implied.

Source: [APL Spacecraft and Science Payload](https://dragonfly.jhuapl.edu/What-Is-Dragonfly/Spacecraft-and-Science-Payload.php).
Original files and SHA-256 hashes are preserved in
[`research/apl-spacecraft-models`](../../../research/apl-spacecraft-models/README.md).
NASA also credits NASA/Johns Hopkins APL for the corresponding rotating CAD and
payload animations in its [multimedia gallery](https://science.nasa.gov/mission/dragonfly/multimedia/).

| File | Preparation |
|---|---|
| `payload-cutaway.webp` | Full 1649 x 1001 PNG converted to WebP, quality 92. No crop, recoloring or redrawing. Source revision date not stated. |
| `cad-poster.webp` | First decoded frame, resized to 960 x 540. |
| `cad-rotation.mp4` | Complete 2024-named source movie, resized to 960 x 540 at 24 fps, H.264 CRF 25, fast-start. Timing retained; no added audio. |

These compact copies support the owner's requested educational reference viewer.
Original links and visible credit remain in the UI. The APL page does not specify an
asset-specific permissive license; these assets retain their owners' rights and are
not relicensed as project code or represented as public domain.

Reproduce with `research/prepare-vehicle-references.py --ffmpeg <ffmpeg-path>`.
No PDF, STL or slicer project is distributed by the app. The NASA print-model links
credit Gary Allen Backus / Backus Creative Imaging separately.
