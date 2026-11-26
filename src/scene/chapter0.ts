// 0장 화면 소품(직접 제작): 배달지 그림 4종, 그림 표지판·놓는 자리, 선물 이름표 카드.
// 그림은 글자 없이 알아보게: 유나네 = 물고기, 수선집 = 단추, 민재네 = 눈사람, 할머니 댁 = 트리 있는 집.
import * as THREE from 'three';
import { MARKERS, type Dest } from '../data/chapter0';

const ACCENT: Record<Dest, string> = { yuna: '#2f6fd0', tailor: '#c8323c', minjae: '#2f9a4a', grandma: '#e0a021' };

/** 배달지 그림을 캔버스에 그린다(가운데 기준, 크기 s) */
export function drawSymbol(g: CanvasRenderingContext2D, dest: Dest, cx: number, cy: number, s: number): void {
  g.save();
  g.translate(cx, cy);
  g.scale(s / 100, s / 100);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 6;
  g.strokeStyle = '#1b2433';
  if (dest === 'yuna') {
    // 물고기: 몸통 + 꼬리 + 눈
    g.fillStyle = '#4a9be8';
    g.beginPath();
    g.ellipse(-6, 0, 30, 19, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(20, 0);
    g.lineTo(42, -18);
    g.lineTo(42, 18);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#1b2433';
    g.beginPath();
    g.arc(-22, -4, 4, 0, 7);
    g.fill();
  } else if (dest === 'tailor') {
    // 단추: 큰 원 + 테두리 + 구멍 넷
    g.fillStyle = '#e0505a';
    g.beginPath();
    g.arc(0, 0, 36, 0, 7);
    g.fill();
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 26, 0, 7);
    g.stroke();
    g.fillStyle = '#1b2433';
    for (const [x, y] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
      g.beginPath();
      g.arc(x!, y!, 5, 0, 7);
      g.fill();
    }
  } else if (dest === 'minjae') {
    // 눈사람: 몸 둘 + 눈 + 코 + 목도리
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 18, 24, 0, 7);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(0, -20, 17, 0, 7);
    g.fill();
    g.stroke();
    g.fillStyle = '#2f9a4a';
    g.fillRect(-18, -6, 36, 8);
    g.fillStyle = '#1b2433';
    for (const x of [-6, 6]) {
      g.beginPath();
      g.arc(x, -23, 3, 0, 7);
      g.fill();
    }
    g.fillStyle = '#f08a24';
    g.beginPath();
    g.moveTo(0, -19);
    g.lineTo(12, -16);
    g.lineTo(0, -14);
    g.fill();
  } else {
    // 트리 있는 집: 지붕 + 벽 + 문 + 옆의 작은 트리
    g.fillStyle = '#d99a4a';
    g.fillRect(-34, -4, 40, 34);
    g.strokeRect(-34, -4, 40, 34);
    g.fillStyle = '#b3402e';
    g.beginPath();
    g.moveTo(-40, -2);
    g.lineTo(-14, -30);
    g.lineTo(12, -2);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#5a3620';
    g.fillRect(-20, 10, 12, 20);
    g.fillStyle = '#2f8a3e';
    g.beginPath();
    g.moveTo(28, -26);
    g.lineTo(44, 14);
    g.lineTo(12, 14);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#ffd84a';
    g.beginPath();
    g.arc(28, -28, 5, 0, 7);
    g.fill();
    g.fillStyle = '#6b4428';
    g.fillRect(25, 14, 6, 14);
  }
  g.restore();
}

function canvasTexture(draw: (g: CanvasRenderingContext2D, n: number) => void, n = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d')!, n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 흰 카드 + 색 테두리 + 그림(이름표·표지판에 같이 쓴다) */
export function symbolCard(dest: Dest): THREE.CanvasTexture {
  return canvasTexture((g, n) => {
    g.fillStyle = '#fffdf6';
    g.strokeStyle = ACCENT[dest];
    g.lineWidth = n * 0.06;
    const r = n * 0.14;
    const m = n * 0.06;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(m, m, n - 2 * m, n - 2 * m, r);
    else g.rect(m, m, n - 2 * m, n - 2 * m); // 오래된 브라우저
    g.fill();
    g.stroke();
    drawSymbol(g, dest, n / 2, n / 2, n * 0.62);
  });
}

export interface MarkerView {
  root: THREE.Group;
  /** 맞게 놓았으면 초록, 틀렸으면 빨강으로 잠깐 빛난다 */
  flash(dest: Dest, ok: boolean): void;
  update(dt: number): void;
}

export function createMarkers(): MarkerView {
  const root = new THREE.Group();
  const rings = new Map<Dest, { mat: THREE.MeshBasicMaterial; t: number; ok: boolean }>();
  for (const m of MARKERS) {
    // 바닥 놓는 자리: 연한 원 + 가운데 그림
    const floorTex = canvasTexture((g, n) => {
      g.fillStyle = 'rgba(255,255,255,0.0)';
      g.fillRect(0, 0, n, n);
      g.strokeStyle = ACCENT[m.dest];
      g.lineWidth = n * 0.05;
      g.setLineDash([n * 0.08, n * 0.05]);
      g.beginPath();
      g.arc(n / 2, n / 2, n * 0.44, 0, 7);
      g.stroke();
      g.globalAlpha = 0.85;
      drawSymbol(g, m.dest, n / 2, n / 2, n * 0.5);
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(m.r, 40), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.rotation.z = Math.PI / 4; // 카메라(대각선) 쪽에서 똑바로 보이게
    disc.position.set(m.x, 0.015, m.z);
    root.add(disc);
    const glow = new THREE.MeshBasicMaterial({ color: '#5fd36a', transparent: true, opacity: 0, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(m.r * 0.92, m.r * 1.08, 40), glow);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(m.x, 0.02, m.z);
    root.add(ring);
    rings.set(m.dest, { mat: glow, t: 0, ok: true });
    // 표지판: 기둥 + 그림판(항상 카메라 쪽을 향하는 카드)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.9, 8), new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.9 }));
    pole.position.set(m.signX, 0.95, m.signZ);
    root.add(pole);
    const board = new THREE.Sprite(new THREE.SpriteMaterial({ map: symbolCard(m.dest) }));
    board.scale.set(1.15, 1.15, 1);
    board.position.set(m.signX, 2.25, m.signZ);
    root.add(board);
  }
  return {
    root,
    flash(dest, ok) {
      const r = rings.get(dest)!;
      r.t = 1.2;
      r.ok = ok;
      r.mat.color.set(ok ? '#5fd36a' : '#e0505a');
    },
    update(dt) {
      for (const r of rings.values()) {
        r.t = Math.max(0, r.t - dt);
        r.mat.opacity = r.t > 0 ? 0.35 + 0.45 * Math.abs(Math.sin(r.t * 8)) : 0;
      }
    },
  };
}

/** 선물 위에 떠 있는 그림 이름표 */
export function createTag(dest: Dest): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: symbolCard(dest), depthTest: false }));
  s.scale.set(0.72, 0.72, 1);
  s.renderOrder = 5;
  return s;
}

/**
 * 썰매에서 떨어진 물건이 눈 위를 튕기며 미끄러진 자국(연출 가이드 §4·§7).
 * 썰매 쪽은 깊게 파였다가 물건 쪽으로 갈수록 얕아진다 → 자국 끝을 보면 주울 물건이 있다.
 */
export function createSkidTrails(from: { x: number; z: number }, to: readonly { x: number; z: number }[]): THREE.Group {
  const root = new THREE.Group();
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const g = c.getContext('2d')!;
    // 가로 = 자국 길이(왼쪽 = 썰매 쪽). 튕긴 자리(타원 홈) 사이를 가는 긁힌 줄이 잇는다
    for (let i = 0; i < 7; i++) {
      const u = 14 + i * 34 + (i % 2) * 6;
      const a = 0.85 - i * 0.09;
      g.fillStyle = `rgba(120,140,175,${a.toFixed(2)})`;
      g.beginPath();
      g.ellipse(u, 16 + ((i * 5) % 7) - 3, 11 - i * 0.8, 7 - i * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(120,140,175,0.45)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(8, 14);
    g.lineTo(250, 17);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  for (const p of to) {
    const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz);
    const start = 1.8; // 썰매 몸체 밑에서 시작하지 않게
    const len = d - start - 0.6;
    if (len < 1) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.5), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(dz, dx); // 평면의 +x를 (dx, dz) 쪽으로
    const mid = start + len / 2;
    m.position.set(from.x + (dx / d) * mid, 0.008, from.z + (dz / d) * mid);
    m.userData.flat = true;
    root.add(m);
  }
  return root;
}
