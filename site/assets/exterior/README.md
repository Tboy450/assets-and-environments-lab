# Exterior imagery and credits

These files are served locally with the app. No generative-image service was used.

## A: Titan dune panorama

- Credit: **NASA / Johns Hopkins Applied Physics Laboratory**.
- [NASA Dragonfly multimedia](https://science.nasa.gov/mission/dragonfly/multimedia/).
- [Soaring Over the Dunes of Titan](https://science.nasa.gov/video-detail/amf-c9168d26-1787-49f8-b576-638a9d12591e/).
- [Original animation](https://assets.science.nasa.gov/content/dam/science/missions/dragonfly/dragonfly-videos/Dragonfly_landscape.mp4).
- `titan-dunes.jpg`: frame at 9 seconds, cropped to the left 2520 x 1080 pixels to exclude
  the animated vehicle, then encoded as JPEG. The app crops this still to fit without stretching.
- This is NASA/APL's **artist's concept**, not a photograph returned from Titan and not a
  surveyed reconstruction of the exact Dragonfly landing site. The live vehicle remains a
  separate interactive model.

## C: Cassini portrait

- `saturn-cassini.jpg`: [Jewel of the Solar System, PIA17474](https://www.jpl.nasa.gov/images/pia17474-jewel-of-the-solar-system/).
  Credit: **NASA / JPL-Caltech / SSI / Cornell**. Cassini natural-color mosaic.
  Resized from 3600 x 2700 to 1800 x 1350; display gamma 0.72 lifts faint ring detail.
  The full image and all rings remain inside the canvas.
- `titan-halo.jpg`: [The Halo, PIA17180](https://science.nasa.gov/photojournal/the-halo/).
  Credit: **NASA / JPL-Caltech / Space Science Institute**. Cassini natural-color photograph.
  Empty black margins cropped to a 286 x 286 square; the whole moon and atmospheric rim remain.
- The two photographs are arranged separately over a restrained illustrative star field.
  This is an editorial composite, **not to scale**, not one Cassini exposure, and not the view
  through Titan's opaque surface haze. Stars are decorative, not a positional sky map.

## B: Assembly room

An original procedural illustration, not a photograph of an actual NASA/APL facility.
The floor, purge cart, tools, lighting and equipment are illustrative. The corrected gentle
floor projection is retained, with projected rectangular light reflections, perforation edge
highlights, fine epoxy grain, brushed metal highlights and equipment contact shadows.

## Reproduction

Original downloads and the extracted frame are in `research/backdrop-sources/` in the repository.
`research/prepare-exterior-assets.py` uses Pillow and NumPy to produce the three image files.
Extract the still with FFmpeg:

```sh
ffmpeg -ss 9 -i research/backdrop-sources/dragonfly-landscape.mp4 -frames:v 1 research/backdrop-sources/landscape-frame-9.png
python research/prepare-exterior-assets.py
```

Public NASA imagery is credited as above. Its use does not imply NASA endorsement of this app.
