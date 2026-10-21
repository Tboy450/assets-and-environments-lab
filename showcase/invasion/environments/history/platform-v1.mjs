// Original visual foundation [EST], fitted to low points of the imported architecture.
// This is rendering geometry; it does not establish collision or real structural engineering.
import * as THREE from "../../../vendor/three/three.module.min.js";

export function convexHull(points) {
  const sorted = [...new Map(points.filter(p => p.every(Number.isFinite)).map(p => [p.join(','), p])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = values => {
    const result = [];
    for (const p of values) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export function lowFootprint(root, height) {
  root.updateMatrixWorld(true);
  const points = [], v = new THREE.Vector3();
  root.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      v.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (v.y <= height * .23 + 1) points.push([Math.round(v.x), Math.round(v.z)]);
    }
  });
  return convexHull(points);
}

function expand(points, margin) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cz = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map(([x, z]) => {
    const length = Math.hypot(x - cx, z - cz) || 1;
    return [x + (x - cx) * margin / length, z + (z - cz) * margin / length];
  });
}

function shape(points) { return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z))); }
function material(color, metalness = 0, roughness = .8) { return new THREE.MeshStandardMaterial({ color, metalness, roughness }); }
function add(group, geometry, mat, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.fromArray(position);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function slab(group, polygon, top, depth, mat, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(shape(polygon), { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  return add(group, geometry, mat, [0, top - depth, 0]);
}
const noise = (x, z) => Math.sin(x * .0017) * Math.cos(z * .0023) * .5 + Math.sin(x * .006 + z * .004) * .25;

function bedrock(group, footprint) {
  const samples = [];
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i], b = footprint[(i + 1) % footprint.length], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 45));
    for (let j = 0; j < count; j++) samples.push([a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count]);
  }
  const rings = [[20, -28], [65, -75], [140, -145], [235, -215], [310, -266]].map(([margin, y], layer) =>
    expand(samples, margin).map(([x, z], i) => [x + Math.sin(i * 2.2 + layer) * 13 * layer, y + noise(x, z) * 12, z + Math.cos(i * 1.7 + layer) * 13 * layer]));
  const positions = [], colors = [], color = new THREE.Color();
  for (let layer = 0; layer < rings.length - 1; layer++) for (let i = 0; i < samples.length; i++) {
    const j = (i + 1) % samples.length;
    for (const p of [rings[layer][i], rings[layer + 1][i], rings[layer][j], rings[layer][j], rings[layer + 1][i], rings[layer + 1][j]]) {
      positions.push(...p);
      color.setHex(layer % 2 ? 0x495b62 : 0x344852).multiplyScalar(.91 + Math.sin(i * 3.4 + layer) * .09);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  add(group, geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, side: THREE.DoubleSide }));
}

function terrain(group) {
  const geometry = new THREE.PlaneGeometry(12500, 12500, 110, 110).rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position, colors = [], color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), distance = Math.hypot(x, z);
    const blend = THREE.MathUtils.smoothstep(distance, 1700, 2900);
    const height = -266 + blend * (noise(x, z) * 135 + Math.sin(distance * .003) * 40);
    positions.setY(i, height);
    color.setHex(0x51636a).lerp(new THREE.Color(0x74847d), (noise(x, z) + .8) * .4);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = add(group, geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.castShadow = false;
}

function accessRamp(group, a, b, edge, materials) {
  const midpoint = new THREE.Vector3((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
  const outward = new THREE.Vector3(b[1] - a[1], 0, a[0] - b[0]).normalize();
  const sideways = new THREE.Vector3(-outward.z, 0, outward.x);
  const curve = new THREE.CatmullRomCurve3([
    midpoint.clone(), midpoint.clone().addScaledVector(outward, 160).add(new THREE.Vector3(0, -28, 0)),
    midpoint.clone().addScaledVector(outward, 410).addScaledVector(sideways, edge % 2 ? 100 : -100).add(new THREE.Vector3(0, -145, 0)),
    midpoint.clone().addScaledVector(outward, 800).add(new THREE.Vector3(0, -264, 0))
  ]);
  const positions = [], indices = [], rails = [[], []];
  for (let i = 0; i <= 48; i++) {
    const point = curve.getPoint(i / 48), tangent = curve.getTangent(i / 48), normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (let side = 0; side < 2; side++) {
      const p = point.clone().addScaledVector(normal, side ? 15 : -15);
      positions.push(p.x, p.y, p.z); rails[side].push(p.clone().add(new THREE.Vector3(0, 3.5, 0)));
    }
    if (i < 48) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    if (i > 0 && i < 46 && i % 7 === 0) {
      const height = point.y + 266;
      add(group, new THREE.CylinderGeometry(5, 8, height, 8), materials.structure, [point.x, -266 + height / 2, point.z]);
      add(group, new THREE.CylinderGeometry(17, 20, 6, 12), materials.structure, [point.x, -264, point.z]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));geometry.setIndex(indices);geometry.computeVertexNormals();
  add(group, geometry, materials.road);
  for (const points of rails) add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 1.25, 6, false), materials.trim);
}

export function createCityFoundation(footprint) {
  if (footprint.length < 3) throw new Error('City foundation needs a non-degenerate footprint');
  const group = new THREE.Group();group.name = 'Skyway fitted foundation';
  const materials = { structure: material(0x4d626b, .3), deck: material(0x83928f, .2), trim: material(0xa7b9b7, .5, .45), road: material(0x34464c, .15) };
  terrain(group);bedrock(group, footprint);
  const deck = expand(footprint, 55), retaining = expand(footprint, 86);
  slab(group, deck, -2, 34, materials.deck, 3);
  slab(group, retaining, -34, 18, materials.structure, 2);
  // Hollow retaining skirt fits the footprint and preserves the visible rock beneath it.
  const skirtShape = shape(retaining);skirtShape.holes.push(new THREE.Path(shape(expand(footprint, 70)).getPoints().reverse()));
  const skirt = new THREE.ExtrudeGeometry(skirtShape, { depth: 75, bevelEnabled: false, steps: 1 }).rotateX(-Math.PI / 2);
  add(group, skirt, materials.structure, [0, -108, 0]);
  const matrices = [], dummy = new THREE.Object3D(), edges = [];
  for (let i = 0; i < deck.length; i++) {
    const a = deck[i], b = deck[(i + 1) % deck.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]), angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    edges.push({ a, b, length });
    const rail = add(group, new THREE.BoxGeometry(length, 3, 2), materials.trim, [(a[0] + b[0]) / 2, 1.5, (a[1] + b[1]) / 2]);rail.rotation.y = angle;
    for (let j = 0; j < Math.floor(length / 45); j++) {
      const t = (j + .5) / Math.floor(length / 45);
      dummy.position.set(a[0] + (b[0] - a[0]) * t, -68, a[1] + (b[1] - a[1]) * t);dummy.rotation.set(0, angle, 0);dummy.scale.set(4, 92, 13);dummy.updateMatrix();matrices.push(dummy.matrix.clone());
    }
  }
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.trim, matrices.length);
  matrices.forEach((m, i) => ribs.setMatrixAt(i, m));ribs.castShadow = ribs.receiveShadow = true;group.add(ribs);
  edges.sort((a, b) => b.length - a.length).slice(0, 4).forEach(({ a, b }, i) => accessRamp(group, a, b, i, materials));
  group.userData = { fittedFootprint: footprint, deckElevation: 0, groundElevation: -266, accessRamps: Math.min(4, edges.length) };
  return group;
}

