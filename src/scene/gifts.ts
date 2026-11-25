// 선물 다섯 개와 대상 표시 고리(직접 제작 기본 도형). 원점은 바닥 중심.
import * as THREE from 'three';
import type { GiftKind } from '../data/gifts';

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

function ribbon(w: number, h: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const m = mat('#ffd84a', { roughness: 0.5 });
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.06), m), 0, h / 2, 0));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, h + 0.02, d + 0.02), m), 0, h / 2, 0));
  const bow = at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), m), 0, h + 0.05, 0);
  bow.rotation.x = Math.PI / 2;
  g.add(bow);
  return g;
}

export function createGift(kind: GiftKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'sketchbook': {
      // 납작한 스케치북: 빨간 표지 + 흰 종이 + 위쪽 스프링
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.38), mat('#d23a3a')), 0, 0.03, 0));
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.04, 0.35), mat('#ffffff')), 0, 0.07, 0));
      for (let i = -4; i <= 4; i++) {
        const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 4, 8), mat('#8892a6')), i * 0.05, 0.09, -0.18);
        ring.rotation.y = Math.PI / 2;
        g.add(ring);
      }
      break;
    }
    case 'pencils': {
      // 색연필 통: 원통 + 색연필 끝
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 14), mat('#2f6fd0')), 0, 0.13, 0));
      ['#d23a3a', '#e0b021', '#2f9a4a', '#7a4ad0', '#e07a2a'].forEach((c, i) => {
        const a = (i / 5) * Math.PI * 2;
        g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6), mat(c)), Math.cos(a) * 0.05, 0.31, Math.sin(a) * 0.05));
      });
      break;
    }
    case 'ball': {
      g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat('#ffffff', { flatShading: true })), 0, 0.2, 0));
      const band = at(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.022, 6, 20), mat('#d23a3a')), 0, 0.2, 0);
      g.add(band);
      g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 10), mat('#d23a3a')), 0, 0.43, 0));
      break;
    }
    case 'repair': {
      // 트리 수리 상자: 손잡이 달린 공구 상자
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.3), mat('#2f9a4a')), 0, 0.14, 0));
      const handle = at(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12, Math.PI), mat('#3b3f4a')), 0, 0.28, 0);
      g.add(handle);
      g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat('#ffd84a', { emissive: '#ffcf33', emissiveIntensity: 0.4 })), 0.16, 0.2, 0.16));
      break;
    }
    case 'sewing': {
      // 재봉틀 상자: 길쭉하고 묵직한 나무 상자 + 양끝 손잡이 2개
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.7), mat('#a07a52')), 0, 0.3, 0));
      g.add(ribbon(1.4, 0.6, 0.7));
      for (const sx of [-1, 1]) {
        const h = at(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12, Math.PI), mat('#3b3f4a')), sx * 0.72, 0.38, 0);
        h.rotation.y = Math.PI / 2;
        h.rotation.z = (-sx * Math.PI) / 2;
        g.add(h);
      }
      break;
    }
  }
  return g;
}

/** 가까운 대상을 미리 보여 주는 바닥 고리 */
export function createTargetRing(): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.55, 32),
    new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  return ring;
}
