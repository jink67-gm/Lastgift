// 대상 윤곽: 요정이 지금 행동하면 집거나 잡을 물건의 테두리를 그 요정의 모자 색으로 그린다(뒤집은 껍질 방식).
// 물건 모양 그대로 조금 부풀린 복제를 뒷면만 그려, 앞에서 보면 둘레에 색 띠가 보인다. 판정과 무관.
import * as THREE from 'three';

export interface Outline {
  group: THREE.Group;
  /** color가 null이면 숨긴다 */
  set(color: string | null): void;
}

/** target의 메시들을 본떠 윤곽을 만든다. 윤곽은 target 안에 붙어 같이 움직인다 */
export function createOutline(target: THREE.Object3D, thickness = 0.05): Outline {
  const group = new THREE.Group();
  group.name = 'outline';
  const mat = new THREE.MeshBasicMaterial({ color: '#ffd84a', side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.95 });
  target.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(target.matrixWorld).invert();
  target.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.userData.flat) return;
    const geo = m.geometry.clone();
    geo.computeBoundingBox();
    // 메시 자기 중심에서 부풀린다(바닥이 아니라 가운데 기준으로 고르게)
    const c = geo.boundingBox!.getCenter(new THREE.Vector3());
    const size = geo.boundingBox!.getSize(new THREE.Vector3());
    const s = new THREE.Vector3(1 + (2 * thickness) / Math.max(size.x, 0.05), 1 + (2 * thickness) / Math.max(size.y, 0.05), 1 + (2 * thickness) / Math.max(size.z, 0.05));
    geo.translate(-c.x, -c.y, -c.z);
    geo.scale(s.x, s.y, s.z);
    geo.translate(c.x, c.y, c.z);
    const shell = new THREE.Mesh(geo, mat);
    shell.matrixAutoUpdate = false;
    shell.matrix.copy(inv).multiply(m.matrixWorld); // target 기준 자리
    shell.renderOrder = 3;
    group.add(shell);
  });
  group.visible = false;
  target.add(group);
  return {
    group,
    set(color) {
      group.visible = color !== null;
      if (color) mat.color.set(color);
    },
  };
}
