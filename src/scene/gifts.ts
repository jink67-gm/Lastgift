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

/** 스케치북 표지 그림(해·파도·고래 꼬리): 멀리서도 "그림책"으로 보이게 */
let coverTex: THREE.CanvasTexture | null = null;
function sketchCover(): THREE.CanvasTexture {
  if (coverTex) return coverTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d23a3a';
  g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#fff6e0';
  g.fillRect(14, 16, 100, 66);
  g.fillStyle = '#ffcc33';
  g.beginPath();
  g.arc(92, 34, 11, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2f6fd0';
  g.lineWidth = 5;
  g.beginPath();
  for (let x = 18; x <= 110; x += 2) g.lineTo(x, 66 + Math.sin(x / 7) * 4);
  g.stroke();
  g.fillStyle = '#2f6fd0';
  g.beginPath();
  g.moveTo(40, 58);
  g.quadraticCurveTo(30, 40, 22, 44);
  g.quadraticCurveTo(34, 48, 40, 58);
  g.quadraticCurveTo(46, 40, 58, 42);
  g.quadraticCurveTo(46, 48, 40, 58);
  g.fill();
  coverTex = new THREE.CanvasTexture(c);
  coverTex.colorSpace = THREE.SRGBColorSpace;
  return coverTex;
}

export function createGift(kind: GiftKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'sketchbook': {
      // 스케치북: 뒤표지(갈색 판지) + 종이 묶음(옆면이 보이게) + 그림 있는 빨간 앞표지 + 위쪽 흰 스프링
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.025, 0.4), mat('#8a6a4a')), 0, 0.0125, 0));
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.38), mat('#fbf8f0')), 0, 0.05, 0.005));
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.02, 0.4), [mat('#c23232'), mat('#c23232'), new THREE.MeshStandardMaterial({ map: sketchCover(), roughness: 0.8 }), mat('#c23232'), mat('#c23232'), mat('#c23232')]);
      g.add(at(cover, 0, 0.085, 0));
      for (let i = -5; i <= 5; i++) {
        const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 5, 10), mat('#e8ecf2', { metalness: 0.5, roughness: 0.4 })), i * 0.045, 0.06, -0.2);
        ring.rotation.y = Math.PI / 2;
        g.add(ring);
      }
      break;
    }
    case 'pencils': {
      // 색연필 통: 남색 통 + 금띠 + 리본, 깎은 색연필 일곱 자루(나무 끝 + 심 색)
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.22, 16), mat('#2a4f9a')), 0, 0.11, 0));
      g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.03, 16), mat('#e0b64e', { metalness: 0.5, roughness: 0.4 })), 0, 0.17, 0));
      const bow = at(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 5, 10), mat('#d23a3a')), 0, 0.17, 0.115);
      g.add(bow);
      const wood = mat('#e8c99a');
      ['#d23a3a', '#e0b021', '#2f9a4a', '#2f6fd0', '#7a4ad0', '#e07a2a', '#2f6fd0'].forEach((c, i) => {
        const a = (i / 7) * Math.PI * 2;
        const r = i === 6 ? 0 : 0.055;
        const p = new THREE.Group();
        p.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.26, 6), mat(c)), 0, 0, 0));
        p.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.045, 6), wood), 0, 0.152, 0));
        p.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.018, 6), mat(c)), 0, 0.184, 0));
        p.position.set(Math.cos(a) * r, 0.25 + (i % 3) * 0.02, Math.sin(a) * r);
        p.rotation.set(Math.sin(a) * 0.18 * (r ? 1 : 0), 0, -Math.cos(a) * 0.18 * (r ? 1 : 0));
        g.add(p);
      });
      break;
    }
    case 'ball': {
      // 축구공(흰 바탕 + 검은 오각형 열둘) + 빨간 리본 십자 + 위 나비 매듭
      const R = 0.2;
      g.add(at(new THREE.Mesh(new THREE.IcosahedronGeometry(R, 2), mat('#fbfbf8', { roughness: 0.5 })), 0, R, 0));
      const ico = new THREE.IcosahedronGeometry(1, 0);
      const pos = ico.attributes.position as THREE.BufferAttribute;
      const seen: THREE.Vector3[] = [];
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
        if (seen.some((u) => u.distanceTo(v) < 1e-3)) continue;
        seen.push(v);
        const patch = new THREE.Mesh(new THREE.CircleGeometry(0.062, 5), mat('#22252c', { roughness: 0.6 }));
        patch.position.copy(v).multiplyScalar(R + 0.002).add(new THREE.Vector3(0, R, 0));
        patch.lookAt(v.clone().multiplyScalar(2).add(new THREE.Vector3(0, R, 0)));
        g.add(patch);
      }
      const red = mat('#d23a3a', { roughness: 0.5 });
      for (const rot of [0, Math.PI / 2]) {
        const band = at(new THREE.Mesh(new THREE.TorusGeometry(R + 0.006, 0.016, 5, 28), red), 0, R, 0);
        band.rotation.y = rot;
        g.add(band);
      }
      for (const sx of [-1, 1]) {
        const loop = at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 5, 12), red), sx * 0.05, R * 2 + 0.03, 0);
        loop.rotation.y = Math.PI / 2;
        loop.rotation.x = sx * 0.5;
        g.add(loop);
      }
      g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), red), 0, R * 2 + 0.012, 0));
      break;
    }
    case 'repair': {
      // 트리 수리 상자: 초록 공구 상자(진한 뚜껑·쇠 걸쇠·손잡이) + 뚜껑 위에 감긴 전구 줄
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), mat('#2f8a46')), 0, 0.1, 0));
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.32), mat('#236b37')), 0, 0.24, 0));
      for (const x of [-0.15, 0.15]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.02), mat('#c8ccd4', { metalness: 0.7, roughness: 0.3 })), x, 0.2, 0.16));
      const handle = at(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 12, Math.PI), mat('#3b3f4a')), 0, 0.28, 0);
      g.add(handle);
      const cols = ['#ffd36b', '#ff6b5e', '#7fc8ff', '#a6f08a'];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4]! }));
        b.position.set(Math.cos(a) * 0.13, 0.295, Math.sin(a) * 0.08);
        g.add(b);
      }
      const wire = at(new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 4, 24), mat('#2c4a32')), 0, 0.285, 0);
      wire.scale.set(0.13, 0.13, 0.08);
      wire.rotation.x = Math.PI / 2;
      g.add(wire);
      break;
    }
    case 'sewing': {
      // 재봉틀 상자: 나무판을 이어 붙인 상자(판 사이 홈) + 쇠 모서리 + 양끝 손잡이 막대 + 노란 끈
      const W = 1.4, H = 0.6, D = 0.7;
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat('#a8804f')), 0, H / 2, 0));
      const groove = mat('#6e4f2f');
      for (const y of [0.15, 0.3, 0.45]) {
        g.add(at(new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, 0.012, D + 0.004), groove), 0, y, 0));
      }
      const iron = mat('#4a4f5a', { metalness: 0.6, roughness: 0.4 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.04, H - 0.04]) {
        g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.1), iron), sx * (W / 2 - 0.04), y, sz * (D / 2 - 0.04)));
      }
      g.add(ribbon(W, H, D));
      for (const sx of [-1, 1]) {
        const bar = at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, D * 0.6, 8), mat('#3b3f4a')), sx * (W / 2 + 0.09), 0.4, 0);
        bar.rotation.x = Math.PI / 2;
        g.add(bar);
        for (const sz of [-1, 1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), mat('#3b3f4a')), sx * (W / 2 + 0.05), 0.4, sz * D * 0.28));
      }
      break;
    }
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
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
