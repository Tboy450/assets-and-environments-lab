# three.js

Existing bundled renderer: r180. License: [MIT](LICENSE).

Environment Lab adds these unchanged files from the official npm `three@0.180.0` package:

- `addons/loaders/GLTFLoader.js`
- `addons/utils/BufferGeometryUtils.js`
- `addons/controls/OrbitControls.js`

Source: https://github.com/mrdoob/three.js/tree/r180/examples/jsm
Package: https://registry.npmjs.org/three/-/three-0.180.0.tgz

The gallery import map resolves bare `three` imports to this existing local renderer. The
simulator and campaign retain their existing imports. Original downloaded package remains
in local research; no package installation or remote runtime/CDN dependency is required.
