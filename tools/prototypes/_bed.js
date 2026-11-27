import * as THREE from 'three';
import { Models } from '/src/scene/models.ts';
import { createPlaza } from '/src/scene/plaza.ts';
// 광장 전체에서 트리·화단·썰매만 남겨 본다
export default async () => {
  const models = await Models.load(undefined, '/');
  const plaza = createPlaza(models);
  const keep = new Set(['tree', 'treeBed']);
  const g = new THREE.Group();
  for (const c of [...plaza.children]) if (keep.has(c.name)) g.add(c);
  return g;
};
