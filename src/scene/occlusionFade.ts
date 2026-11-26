// 가림 흐리기: 사람 크기의 집·나무·울타리가 요정(과 들고 있는 짐)을 가리면 그 물체만 잠시 흐리게 한다.
// 카메라에서 요정 쪽으로 광선을 쏘아 요정보다 앞에서 맞는 물체만 고른다(뒤에 있는 집은 그대로).
// 판정·충돌과는 무관한 화면 처리다. 흐릴 물체는 userData.fadeable = true로 표시한다.
import * as THREE from 'three';

interface Fadeable {
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  /** 깊이만 쓰는 가림막(흐릴 때만 켠다): 여러 조각이 겹친 집도 맨 앞 한 겹만 비친다 */
  masks: THREE.Mesh[];
  mats: THREE.Material[];
  /** 원래 투명 설정(빛 웅덩이처럼 처음부터 투명한 재질은 되돌릴 때 그대로) */
  orig: { transparent: boolean; opacity: number; depthWrite: boolean }[];
  opacity: number;
  hit: boolean;
}

const FADED = 0.3;
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true });

export interface OcclusionFader {
  /** points: 가려지면 안 되는 땅 위 점(요정 머리·몸통, 짐) */
  update(points: readonly THREE.Vector3[], dt: number): void;
  /** 시험용: 지금 흐려진 물체 이름 */
  faded(): string[];
}

export function createOcclusionFader(scene: THREE.Object3D, camera: THREE.Camera): OcclusionFader {
  const items: Fadeable[] = [];
  scene.traverse((o) => {
    if (!o.userData.fadeable) return;
    const meshes: THREE.Mesh[] = [];
    const mats: THREE.Material[] = [];
    o.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      // 모델 복제본은 재질을 나눠 쓰므로, 이 물체만 흐려지게 재질을 따로 만든다
      const own = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((x) => x.clone());
      mesh.material = Array.isArray(mesh.material) ? own : own[0]!;
      mats.push(...own);
      meshes.push(mesh);
    });
    const orig = mats.map((m) => ({ transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }));
    // 원래 불투명한 조각마다 같은 모양의 깊이 가림막을 붙인다(투명 차례 맨 앞에 그려 깊이만 남긴다)
    const masks: THREE.Mesh[] = [];
    for (const mesh of meshes) {
      const m0 = Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;
      if (m0.transparent) continue;
      const mask = new THREE.Mesh(mesh.geometry, DEPTH_ONLY);
      mask.renderOrder = -1;
      mask.visible = false;
      mask.raycast = () => {};
      mesh.add(mask);
      masks.push(mask);
    }
    if (meshes.length) items.push({ root: o, meshes, masks, mats, orig, opacity: 1, hit: false });
  });
  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3();
  const from = new THREE.Vector3();
  return {
    update(points, dt) {
      camera.getWorldDirection(dir);
      for (const it of items) it.hit = false;
      for (const p of points) {
        // 정사영 카메라: 요정 점에서 카메라 쪽으로 멀리 물러난 곳에서 요정을 향해 쏜다
        from.copy(p).addScaledVector(dir, -80);
        ray.set(from, dir);
        ray.far = 80 - 0.25;
        for (const it of items) {
          if (it.hit) continue;
          if (ray.intersectObjects(it.meshes, false).length) it.hit = true;
        }
      }
      const k = 1 - Math.exp(-dt * 8);
      for (const it of items) {
        const target = it.hit ? FADED : 1;
        if (Math.abs(it.opacity - target) < 0.005) continue;
        it.opacity += (target - it.opacity) * k;
        if (Math.abs(it.opacity - target) < 0.01) it.opacity = target;
        const see = it.opacity < 0.999;
        for (const k of it.masks) k.visible = see;
        it.mats.forEach((m, i) => {
          const o = it.orig[i]!;
          m.transparent = see || o.transparent;
          m.opacity = o.opacity * it.opacity;
          m.depthWrite = see ? false : o.depthWrite;
          m.needsUpdate = true;
        });
        // 흐린 조각은 가림막 다음에 그려 맨 앞면만 남긴다
        for (const mesh of it.meshes) mesh.renderOrder = see ? 1 : 0;
      }
    },
    faded: () => items.filter((i) => i.opacity < 0.999).map((i) => i.root.name || 'fadeable'),
  };
}
