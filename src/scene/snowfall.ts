// 눈 내리기: 화면 둘레 상자 안에서 천천히 내려오는 눈송이(점 하나 = 눈송이 하나). 카메라를 따라 상자가 움직인다.
// 작고 옅게, 바람에 살짝 흔들리며. 눈발 줄이기·낮은 품질이면 수를 줄인다(setCount). 판정과 무관.
import * as THREE from 'three';

const MAX = 600;

export interface Snowfall {
  points: THREE.Points;
  /** 보일 눈송이 수(0이면 끔) */
  setCount(n: number): void;
  /** 화면 중심(땅 위 x, z)과 화면 크기에 맞춰 눈송이를 움직인다 */
  update(dt: number, cx: number, cz: number, radius: number): void;
  /** 눈보라(0~1): 눈송이가 커지고 바람에 옆으로 날린다(프롤로그) */
  setStorm(k: number): void;
}

let flakeTex: THREE.CanvasTexture | null = null;
function flake(): THREE.CanvasTexture {
  if (flakeTex) return flakeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  flakeTex = new THREE.CanvasTexture(c);
  return flakeTex;
}

export function createSnowfall(pixelRatio: () => number): Snowfall {
  const pos = new Float32Array(MAX * 3);
  const seed = new Float32Array(MAX); // 흔들림 위상
  const speed = new Float32Array(MAX);
  let rnd = 12345;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const TOP = 14;
  for (let i = 0; i < MAX; i++) {
    pos[i * 3] = (rand() - 0.5) * 40;
    pos[i * 3 + 1] = rand() * TOP;
    pos[i * 3 + 2] = (rand() - 0.5) * 40;
    seed[i] = rand() * Math.PI * 2;
    speed[i] = 0.7 + rand() * 0.7; // 초당 0.7~1.4 내려온다
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({ map: flake(), size: 6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, color: '#ffffff' });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  let count = 0;
  let t = 0;
  let storm = 0;
  return {
    points,
    setCount(n) {
      count = Math.max(0, Math.min(MAX, Math.round(n)));
      geo.setDrawRange(0, count);
      points.visible = count > 0;
    },
    setStorm(k) {
      storm = Math.min(1, Math.max(0, k));
    },
    update(dt, cx, cz, radius) {
      if (!count) return;
      t += dt;
      mat.size = (5 + 4 * storm) * pixelRatio();
      const wind = 0.12 + 3.2 * storm;
      const fall = 1 + 0.8 * storm;
      const span = radius * 2;
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        pos[k + 1] = pos[k + 1]! - speed[i]! * fall * dt;
        pos[k] = pos[k]! + Math.sin(t * 0.9 + seed[i]!) * 0.25 * dt + wind * dt; // 살짝 흔들리며 바람 쪽(+x)으로
        // 화면 둘레 상자를 벗어나면 반대쪽으로 되감는다(카메라를 따라간다)
        if (pos[k + 1]! < 0) pos[k + 1] = TOP;
        let dx = pos[k]! - cx, dz = pos[k + 2]! - cz;
        if (dx > radius) dx -= span;
        else if (dx < -radius) dx += span;
        if (dz > radius) dz -= span;
        else if (dz < -radius) dz += span;
        pos[k] = cx + dx;
        pos[k + 2] = cz + dz;
      }
      geo.attributes.position!.needsUpdate = true;
    },
  };
}
