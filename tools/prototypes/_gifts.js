import * as THREE from 'three';
import { createGift } from '/src/scene/gifts.ts';
export default () => {
  const g = new THREE.Group();
  ['sketchbook', 'pencils', 'ball', 'repair', 'sewing'].forEach((k, i) => {
    const v = createGift(k);
    v.position.x = -1.6 + i * 0.75 + (k === 'sewing' ? 0.5 : 0);
    g.add(v);
  });
  return g;
};
