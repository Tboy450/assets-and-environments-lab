// Bake an imported transform while preserving front faces after a mirrored transform.
export function bakeSourceGeometry(object) {
  const source = object.geometry.clone().applyMatrix4(object.matrixWorld);
  const geometry = source.index ? source.toNonIndexed() : source;
  for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
  if (object.matrixWorld.determinant() < 0) {
    for (const attribute of Object.values(geometry.attributes)) for (let i = 0; i < attribute.count; i += 3) for (let component = 0; component < attribute.itemSize; component++) {
      const first = i * attribute.itemSize + component, third = (i + 2) * attribute.itemSize + component;
      const value = attribute.array[first];attribute.array[first] = attribute.array[third];attribute.array[third] = value;
    }
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  return geometry;
}
