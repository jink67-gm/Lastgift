// 산타 썰매(직접 만든 모형). 크기 기준: 산타(사람 어른)가 서거나 앉을 수 있게 광장에서 ×1.8.
// 앞코 = +x(눈더미 쪽), 옆면 = ±z. 원점은 썰매 날 바닥 가운데.
// 옆판은 옆모습 선(낮은 앞 → 말려 올라간 앞코 → 움푹한 좌석 → 높게 둥근 등받이)을 얇게 밀어 만들고,
// 금색 테두리·물결 장식·말린 날·받침대·좌석 쿠션으로 "상자" 느낌을 없앤다. 길이는 판정 상자(5.4 m ÷ 1.8) 안.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const HALF_W = 0.62; // 옆판 사이 반폭
const BODY_Y = 0.42; // 몸체 바닥 높이(날 위)

/** 옆모습 바깥 선(x, y): 뒤 아래 → 앞 아래 → 앞코 말림 → 좌석 → 등받이 → 뒤 아래 */
function sideOutline(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1.28, BODY_Y);
  s.lineTo(0.95, BODY_Y);
  // 앞이 둥글게 올라가 바깥으로 말린다
  s.bezierCurveTo(1.32, BODY_Y, 1.5, 0.62, 1.48, 0.95);
  s.bezierCurveTo(1.46, 1.22, 1.2, 1.3, 1.08, 1.14);
  s.bezierCurveTo(0.98, 1.0, 1.12, 0.9, 1.2, 0.98);
  // 앞 가장자리에서 좌석 쪽으로 낮아진다
  s.bezierCurveTo(1.05, 0.98, 0.7, 0.9, 0.35, 0.92);
  s.bezierCurveTo(0.0, 0.94, -0.35, 0.98, -0.6, 1.05);
  // 등받이: 높게 솟아 뒤로 둥글게 넘어간다
  s.bezierCurveTo(-0.85, 1.12, -0.92, 1.62, -1.1, 1.78);
  s.bezierCurveTo(-1.28, 1.92, -1.48, 1.78, -1.44, 1.52);
  s.bezierCurveTo(-1.42, 1.2, -1.3, 0.8, -1.28, BODY_Y);
  return s;
}

/** 옆판 윗선만(금색 테두리 관 경로) */
function rimPath(): THREE.CurvePath<THREE.Vector3> {
  const p = new THREE.CurvePath<THREE.Vector3>();
  const v = (x: number, y: number) => new THREE.Vector3(x, y, 0);
  p.add(new THREE.CubicBezierCurve3(v(1.2, 0.98), v(1.05, 0.98), v(0.7, 0.9), v(0.35, 0.92)));
  p.add(new THREE.CubicBezierCurve3(v(0.35, 0.92), v(0.0, 0.94), v(-0.35, 0.98), v(-0.6, 1.05)));
  p.add(new THREE.CubicBezierCurve3(v(-0.6, 1.05), v(-0.85, 1.12), v(-0.92, 1.62), v(-1.1, 1.78)));
  p.add(new THREE.CubicBezierCurve3(v(-1.1, 1.78), v(-1.28, 1.92), v(-1.48, 1.78), v(-1.44, 1.52)));
  return p;
}

/** 썰매 날: 뒤에서 앞으로 곧게, 앞에서 높이 말려 올라가 안쪽으로 감긴다 */
function runnerPath(): THREE.CatmullRomCurve3 {
  const v = (x: number, y: number) => new THREE.Vector3(x, y, 0);
  return new THREE.CatmullRomCurve3(
    [v(-1.5, 0.12), v(-1.35, 0.04), v(-0.6, 0.03), v(0.4, 0.03), v(1.15, 0.05), v(1.62, 0.22), v(1.82, 0.55), v(1.74, 0.86), v(1.52, 0.9), v(1.44, 0.72), v(1.56, 0.62)],
    false,
    'catmullrom',
    0.4,
  );
}

export function createSleigh(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'sleighModel';
  const red = new THREE.MeshStandardMaterial({ color: '#b3262e', roughness: 0.5, metalness: 0.05 });
  const inner = new THREE.MeshStandardMaterial({ color: '#7a1820', roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b64e', roughness: 0.3, metalness: 0.75 });
  const velvet = new THREE.MeshStandardMaterial({ color: '#1f5a3a', roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.8 });

  // 옆판 두 장
  const sideGeo = new THREE.ExtrudeGeometry(sideOutline(), { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 18 });
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(sideGeo, red);
    side.position.z = s > 0 ? HALF_W - 0.04 : -HALF_W - 0.04;
    g.add(side);
    // 윗선 금테 + 옆판 가운데 금색 소용돌이 장식
    const rim = new THREE.Mesh(new THREE.TubeGeometry(rimPath(), 60, 0.035, 6, false), gold);
    rim.position.z = s * (HALF_W + 0.07);
    g.add(rim);
    // 옆판 가운데 금색 물결 장식
    const wave: THREE.Vector3[] = [];
    for (let i = 0; i <= 48; i++) {
      const u = i / 48;
      wave.push(new THREE.Vector3(-0.95 + u * 1.75, 0.68 + Math.sin(u * Math.PI * 5) * 0.06 * Math.sin(u * Math.PI), 0));
    }
    const swirl = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wave), 96, 0.022, 5, false), gold);
    swirl.position.z = s * (HALF_W + 0.075);
    g.add(swirl);
    for (const x of [-1.02, 0.87]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), gold);
      dot.position.set(x, 0.68, s * (HALF_W + 0.075));
      g.add(dot);
    }
    // 아래 금띠
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 0.03), gold);
    band.position.set(-0.15, BODY_Y + 0.09, s * (HALF_W + 0.07));
    g.add(band);
  }

  // 바닥·앞판·등판(안쪽은 어두운 빨강)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, HALF_W * 2), inner);
  floor.position.set(-0.15, BODY_Y + 0.05, 0);
  g.add(floor);
  // 앞판: 앞으로 비스듬히 누운 판(옆판 앞 말림 사이)
  const dash = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.62, HALF_W * 2, 3, 0.03), red);
  dash.position.set(1.1, 0.72, 0);
  dash.rotation.z = -0.55;
  g.add(dash);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.2, HALF_W * 2, 3, 0.06), red);
  back.position.set(-1.28, 1.08, 0);
  back.rotation.z = -0.12;
  g.add(back);

  // 좌석 쿠션 + 등 쿠션(초록 벨벳)과 단추
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.2, HALF_W * 2 - 0.06, 4, 0.08), velvet);
  seat.position.set(-0.72, 0.62, 0);
  g.add(seat);
  const backPad = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.72, HALF_W * 2 - 0.1, 4, 0.07), velvet);
  backPad.position.set(-1.12, 1.04, 0);
  backPad.rotation.z = -0.12;
  g.add(backPad);
  for (const z of [-0.3, 0, 0.3]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), gold);
    b.position.set(-1.03, 1.08, z);
    g.add(b);
  }
  // 날 두 줄 + 몸체를 받치는 받침대(앞·가운데·뒤)
  const runnerGeo = new THREE.TubeGeometry(runnerPath(), 80, 0.05, 8, false);
  for (const s of [-1, 1]) {
    const runner = new THREE.Mesh(runnerGeo, gold);
    runner.position.z = s * (HALF_W - 0.02);
    g.add(runner);
    for (const x of [-1.0, -0.2, 0.7]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, BODY_Y - 0.03, 6), gold);
      post.position.set(x, (BODY_Y + 0.03) / 2, s * (HALF_W - 0.02));
      g.add(post);
    }
  }
  for (const x of [-1.0, 0.7]) {
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, HALF_W * 2, 6), wood);
    cross.rotation.x = Math.PI / 2;
    cross.position.set(x, 0.2, 0);
    g.add(cross);
  }

  // 앞쪽 발 놓는 곳 양 구석에 실려 있던 작은 선물 둘(뒤에 짐칸을 달면 판정 상자 5.4 m보다 길어져 요정이 짐을 통과했다)
  const box = (w: number, h: number, d: number, c: string, rib: string, x: number, z: number, rot: number) => {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })));
    const rm = new THREE.MeshStandardMaterial({ color: rib, roughness: 0.5 });
    b.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, h + 0.01, 0.05), rm), new THREE.Mesh(new THREE.BoxGeometry(0.05, h + 0.01, d + 0.01), rm));
    b.position.set(x, BODY_Y + 0.1 + h / 2, z);
    b.rotation.y = rot;
    g.add(b);
  };
  box(0.26, 0.22, 0.26, '#2f7a4f', '#f0d060', 0.72, -0.36, 0.3);
  box(0.22, 0.18, 0.22, '#f3f0e8', '#c0303a', 0.78, 0.38, -0.4);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
