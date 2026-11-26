// 5·6장 소품: 산타 얼굴이 수놓인 빨간 양말, 요정들의 배달 가방, 빛으로 그려지는 선물 넷(스케치북·작은 재봉틀·축구공·별 단 트리),
// 스노글로브(유리 안 눈발 + 유나가 스케치북을 펴는 모습, 받침 위 하얀 뼈다귀는 6장 끝에 처음 보인다).
import * as THREE from 'three';

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 수놓은 산타 얼굴(양말 앞면) */
function santaFace(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.fillStyle = '#f1c9a5';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(cx, cy + r * 0.55, r * 1.05, r * 0.75, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = '#d23a3a';
  g.beginPath();
  g.moveTo(cx - r * 1.05, cy - r * 0.35);
  g.quadraticCurveTo(cx, cy - r * 2.3, cx + r * 1.2, cy - r * 0.9);
  g.lineTo(cx + r * 1.05, cy - r * 0.35);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffffff';
  g.fillRect(cx - r * 1.1, cy - r * 0.5, r * 2.2, r * 0.32);
  g.beginPath();
  g.arc(cx + r * 1.25, cy - r * 0.95, r * 0.22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1b1b';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(cx + sx * r * 0.35, cy - r * 0.05, r * 0.11, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#e7967f';
  g.beginPath();
  g.arc(cx, cy + r * 0.18, r * 0.16, 0, Math.PI * 2);
  g.fill();
  // 바느질 땀(수놓은 느낌)
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.setLineDash([4, 4]);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
}

/** 산타 얼굴이 수놓인 빨간 양말(원점 = 바닥, 앞 = +z). setOpen: 입구를 벌려 들여다본다, lift: 들어 올림 */
export function createStocking(): { group: THREE.Group; setOpen(k: number): void } {
  const g = new THREE.Group();
  const red = std('#c42b30', { roughness: 0.95 });
  const face = canvasTex(256, 256, (c) => {
    c.fillStyle = '#c42b30';
    c.fillRect(0, 0, 256, 256);
    santaFace(c, 128, 140, 54);
  });
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.8, 0.22), [red, red, red, red, new THREE.MeshStandardMaterial({ map: face, roughness: 0.95 }), red]);
  leg.position.y = 0.55;
  g.add(leg);
  const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.34, 4, 10), red);
  foot.rotation.z = Math.PI / 2;
  foot.position.set(0.18, 0.15, 0);
  g.add(foot);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.2, 18, 1, true), std('#f6f3ea', { roughness: 1, side: THREE.DoubleSide }));
  cuff.scale.set(1, 1, 0.55);
  cuff.position.y = 1.03;
  g.add(cuff);
  // 입구 안쪽(벌리면 텅 빈 어둠이 보인다)
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.26, 18), new THREE.MeshBasicMaterial({ color: '#2a0d10' }));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 1.1;
  inside.scale.set(1, 0.3, 1);
  g.add(inside);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  g.add(shadow);
  return {
    group: g,
    setOpen(k) {
      const z = 0.55 + 0.6 * k;
      cuff.scale.set(1 + 0.12 * k, 1, z);
      inside.scale.set(1, 0.3 + 0.9 * k, 1);
    },
  };
}

/** 요정들의 배달 가방(갈색 가죽 + 덮개 + 띠). setOpen: 덮개가 젖혀지고 안에서 빛이 샌다 */
export function createBag(): { group: THREE.Group; setOpen(k: number): void; mouth: THREE.Object3D } {
  const g = new THREE.Group();
  const leather = std('#8a5a3a');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.36), leather);
  body.position.y = 0.25;
  g.add(body);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 20, Math.PI), std('#5a3a24'));
  strap.position.y = 0.5;
  g.add(strap);
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.5, -0.18);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.4), std('#7a4a2e'));
  flap.position.set(0, 0, 0.2);
  hinge.add(flap);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), std('#e0b021', { metalness: 0.5, roughness: 0.4 }));
  buckle.position.set(0, -0.04, 0.4);
  hinge.add(buckle);
  g.add(hinge);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.51;
  g.add(glow);
  const mouth = new THREE.Object3D();
  mouth.position.y = 0.55;
  g.add(mouth);
  return {
    group: g,
    mouth,
    setOpen(k) {
      hinge.rotation.x = -k * 2.2;
      glowMat.opacity = 0.9 * k;
    },
  };
}

// ── 선물 모양의 빛 ──────────────────────────────────────

const lightMat = () =>
  new THREE.LineBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });

/** 도형의 모서리를 빛 선으로(그려지는 진행은 drawRange) */
function edges(geo: THREE.BufferGeometry, m: THREE.LineBasicMaterial, at?: THREE.Vector3, rot?: THREE.Euler): THREE.LineSegments {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), m);
  if (at) l.position.copy(at);
  if (rot) l.rotation.copy(rot);
  return l;
}

export type GiftLightKind = 'sketchbook' | 'sewing' | 'ball' | 'tree';

export interface GiftLight {
  group: THREE.Group;
  /** 그려지는 진행(0~1) */
  setDraw(k: number): void;
  /** 밝기(0~1) */
  setGlow(k: number): void;
  /** 스케치북 책장 넘기기(시간) */
  flip(t: number): void;
}

export function createGiftLight(kind: GiftLightKind): GiftLight {
  const g = new THREE.Group();
  const m = lightMat();
  const lines: THREE.LineSegments[] = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  let page: THREE.Object3D | null = null;
  if (kind === 'sketchbook') {
    lines.push(edges(new THREE.BoxGeometry(0.5, 0.03, 0.36), m, V(-0.26, 0, 0)));
    lines.push(edges(new THREE.BoxGeometry(0.5, 0.03, 0.36), m, V(0.26, 0, 0)));
    // 넘어가는 책장(가운데 등을 축으로)
    const hinge = new THREE.Group();
    const leaf = edges(new THREE.PlaneGeometry(0.48, 0.34), m, V(0.25, 0.02, 0), new THREE.Euler(-Math.PI / 2, 0, 0));
    hinge.add(leaf);
    g.add(hinge);
    page = hinge;
    // 고래 낙서(작은 곡선)
    const curve = new THREE.EllipseCurve(0, 0, 0.12, 0.06, 0, Math.PI * 1.7, false, 0);
    const pts = curve.getPoints(24).map((p) => V(-0.26 + p.x, 0.03, p.y));
    lines.push(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.flatMap((p, i) => (i ? [pts[i - 1]!, p] : []))), m));
  } else if (kind === 'sewing') {
    lines.push(edges(new THREE.BoxGeometry(0.6, 0.1, 0.3), m, V(0, 0.05, 0)));
    lines.push(edges(new THREE.BoxGeometry(0.12, 0.34, 0.2), m, V(0.2, 0.27, 0)));
    lines.push(edges(new THREE.BoxGeometry(0.46, 0.1, 0.18), m, V(0.02, 0.44, 0)));
    lines.push(edges(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), m, V(-0.18, 0.31, 0)));
    lines.push(edges(new THREE.TorusGeometry(0.09, 0.012, 4, 14), m, V(0.29, 0.32, 0), new THREE.Euler(0, Math.PI / 2, 0)));
  } else if (kind === 'ball') {
    lines.push(edges(new THREE.IcosahedronGeometry(0.24, 1), m, V(0, 0.24, 0)));
    lines.push(edges(new THREE.TorusGeometry(0.25, 0.01, 4, 24), m, V(0, 0.24, 0), new THREE.Euler(Math.PI / 2, 0, 0)));
  } else {
    for (const [y, r, h] of [[0.1, 0.32, 0.36], [0.32, 0.25, 0.32], [0.52, 0.17, 0.28]] as const) lines.push(edges(new THREE.ConeGeometry(r, h, 8), m, V(0, y + h / 2, 0)));
    lines.push(edges(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 6), m, V(0, 0.05, 0)));
    // 꼭대기 별
    const star: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.04 : 0.09;
      star.push(V(Math.cos(a) * r, 0.86 + Math.sin(a) * r, 0));
    }
    lines.push(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(star.flatMap((p, i) => (i ? [star[i - 1]!, p] : []))), m));
  }
  for (const l of lines) g.add(l);
  // 반짝이 가루
  const dots: number[] = [];
  for (let i = 0; i < 40; i++) dots.push((Math.random() - 0.5) * 0.8, Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  const pm = new THREE.PointsMaterial({ color: '#fff6c8', size: 0.05, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  g.add(new THREE.Points(pg, pm));
  const counts = lines.map((l) => l.geometry.attributes.position!.count);
  return {
    group: g,
    setDraw(k) {
      lines.forEach((l, i) => l.geometry.setDrawRange(0, Math.floor(counts[i]! * Math.min(1, Math.max(0, k)))));
      if (page) page.visible = k > 0.95;
    },
    setGlow(k) {
      m.opacity = k;
      pm.opacity = 0.8 * k;
    },
    flip(t) {
      if (page) page.rotation.z = Math.PI * (0.5 - 0.5 * Math.cos(t * 5.5)) * 0.95;
    },
  };
}

// ── 스노글로브 ──────────────────────────────────────────

export interface Snowglobe {
  group: THREE.Group;
  /** 유리 안 눈(시간), 유나 모습 보이기(0~1) */
  update(t: number, glimpse: number): void;
  /** 받침 위 하얀 뼈다귀(6장 끝에 처음 보인다) */
  bone: THREE.Object3D;
  /** 유리 안 그림 바꾸기(6장 회상): 그리는 함수 */
  setInside(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): void;
}

/** 손바닥 크기 스노글로브(원점 = 받침 바닥, 키 약 0.42) */
export function createSnowglobe(): Snowglobe {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.1, 24), std('#7a4a2e', { roughness: 0.6 }));
  base.position.y = 0.05;
  g.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 6, 24), std('#e0b021', { metalness: 0.6, roughness: 0.35 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.1;
  g.add(rim);
  // 유리 안 그림(바라보는 쪽을 향한다)
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
  inside.position.y = 0.26;
  g.add(inside);
  const snowCount = 60;
  const sp: number[] = [];
  for (let i = 0; i < snowCount; i++) sp.push(0, 0, 0);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.018, transparent: true, opacity: 0.95, depthWrite: false }));
  snow.position.y = 0.26;
  g.add(snow);
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#dff0ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  );
  glass.position.y = 0.26;
  g.add(glass);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
  shine.position.set(-0.07, 0.35, 0.11);
  g.add(shine);
  // 받침 위 하얀 뼈다귀(처음엔 숨김)
  const bone = new THREE.Group();
  const white = std('#f6f3ea', { roughness: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), white);
  shaft.rotation.z = Math.PI / 2;
  bone.add(shaft);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), white);
      knob.position.set(sx * 0.042, 0, sz * 0.01);
      bone.add(knob);
    }
  bone.position.set(0.09, 0.115, 0.1);
  bone.rotation.y = 0.6;
  bone.visible = false;
  g.add(bone);
  let drawn = false;
  const r = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  return {
    group: g,
    bone,
    setInside(draw) {
      const c = cv.getContext('2d')!;
      c.clearRect(0, 0, 256, 256);
      draw(c, 256, 256);
      tex.needsUpdate = true;
      drawn = true;
    },
    update(t, glimpse) {
      const p = sg.attributes.position! as THREE.BufferAttribute;
      for (let i = 0; i < snowCount; i++) {
        const fall = (r(i) * 0.3 - t * (0.04 + r(i + 7) * 0.04)) % 0.3;
        const y = 0.13 - ((fall + 0.3) % 0.3);
        const a = r(i + 3) * Math.PI * 2 + t * 0.4;
        const rr = r(i + 5) * 0.13;
        p.setXYZ(i, Math.cos(a) * rr, y + 0.02, Math.sin(a) * rr);
      }
      p.needsUpdate = true;
      (inside.material as THREE.MeshBasicMaterial).opacity = drawn ? glimpse : 0;
    },
  };
}

/** 유리 안: 눈 내리는 창가에서 유나가 스케치북을 펴는 모습(노란 소매, 사람 에셋이 오기 전 그림) */
export function drawYunaGlimpse(g: CanvasRenderingContext2D, w: number, h: number, open: number): void {
  const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,236,190,0.95)');
  grd.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // 유나(동그란 얼굴·노란 소매)
  g.fillStyle = '#f1c9a5';
  g.beginPath();
  g.arc(w * 0.5, h * 0.36, w * 0.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2418';
  g.beginPath();
  g.arc(w * 0.5, h * 0.33, w * 0.105, Math.PI, 0);
  g.fill();
  g.fillStyle = '#f0c020';
  g.fillRect(w * 0.36, h * 0.47, w * 0.28, h * 0.22);
  // 스케치북(펼쳐진다)
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#d23a3a';
  g.lineWidth = 4;
  const bw = w * 0.2;
  g.fillRect(w * 0.5 - bw * open, h * 0.6, bw * open, h * 0.14);
  g.fillRect(w * 0.5, h * 0.6, bw, h * 0.14);
  g.strokeRect(w * 0.5 - bw * open, h * 0.6, bw * (1 + open), h * 0.14);
}
