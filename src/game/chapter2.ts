// 2장 수선집: 뒤뜰 → 덧문 → 반입 통로 → 작업실 → 작업대 (명세서 §3.2, §5).
// 지금은 한 기기에서 두 사람이 키보드를 나눠 잡는다(1P WASD+E · 터치, 2P 방향키+Enter).
// 두 기기 연결(WebRTC)은 STEP 03-2에서 같은 core를 방장 시뮬레이션으로 돌린다.
import * as THREE from 'three';
import { gripPos, needsSwap, planAction, step, createSewing, type SewingEvent, type SewingInput, type SewingState } from '../core/sewing';
import { chapter } from '../data/chapters';
import { CH2 } from '../data/chapter2';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import type { Intent } from '../input/intent';
import { browserStorage, CheckpointStore } from '../save/store';
import { createChapter2, createStaminaBar, createSwapSign } from '../scene/chapter2';
import { createElf } from '../scene/elf';
import { createGift, createTargetRing } from '../scene/gifts';
import { LocalRun } from '../session/localRun';
import { sewingIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';

const CAMERA_YAW = Math.PI / 4;
const CAMERA_PITCH = Math.atan(1 / Math.SQRT2);
/** 화면 세로에 담는 월드 길이(m). 광장(16 m)보다 가까이 둬서 손잡이·문을 크게 본다 */
const VIEW_HEIGHT = 12;
const SIM_DT = 1 / 60;
const PLAYERS = ['p0', 'p1'] as const;

export function startChapter2(): void {
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b2433');
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a4660', 1.5));
  const moon = new THREE.DirectionalLight('#ffffff', 1.2);
  moon.position.set(-8, 16, 6);
  scene.add(moon);
  const view = createChapter2();
  scene.add(view.root);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const camOffset = new THREE.Vector3(
    Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
    Math.sin(CAMERA_PITCH),
    Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH),
  ).multiplyScalar(40);
  const camTarget = new THREE.Vector3(2.5, 0, 9);

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    const viewH = aspect >= 1 ? VIEW_HEIGHT : VIEW_HEIGHT / Math.max(aspect, 0.6);
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ── 상태 ──
  let sewing: SewingState = createSewing(PLAYERS);
  const events: SewingEvent[] = [];

  // ── 입력: 1P(WASD+E, 터치), 2P(방향키+Enter) ──
  const k1 = new KeyState(KEYMAP_P1);
  const k2 = new KeyState(KEYMAP_P2);
  attachKeyboard(window, k1);
  attachKeyboard(window, k2);
  const controls = createControls(document);
  const hud = createHud(document);

  // ── 팀 시도: 2장 최초 체크포인트에서 시작(개발용 바로 열기). 방이 따로라 0장 기록과 섞이지 않는다 ──
  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, 'dev-ch2', 'p0', (runId, seed) => ({
    schemaVersion: 1,
    runId,
    roomId: 'dev-ch2',
    chapterId: 2,
    savedRemainingMs: chapter(2).floorMs,
    completedChapters: [0, 1],
    memories: [1],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  }));
  run.attachVisibility(document);
  // 0초 → 재시도: 이 장의 임시 진행(상자 위치·문·공간)을 처음으로
  run.onEffect((e) => {
    if (e.type === 'retry') sewing = createSewing(PLAYERS);
  });
  run.dispatch({ type: 'start', at: performance.now() });

  // ── 모델 ──
  const elves = PLAYERS.map((_, i) => {
    const e = createElf(ELF_LOOKS[i]!);
    scene.add(e.root);
    return e;
  });
  const bars = PLAYERS.map(() => {
    const b = createStaminaBar();
    scene.add(b.group);
    return b;
  });
  const swapSigns = PLAYERS.map(() => {
    const s = createSwapSign();
    scene.add(s);
    return s;
  });
  const rings = PLAYERS.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });
  const crate = createGift('sewing');
  scene.add(crate);

  const toInput = (i: Intent): SewingInput => ({ move: i.move, actionDown: i.action.down, actionHeld: i.action.held });
  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };

  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  renderer.setAnimationLoop((now) => {
    const frame = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += frame;
    run.frame(now);
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    const i2 = k2.sample();
    const live = run.canPlay && !sewing.delivered;
    let inputs: Record<string, SewingInput> = live ? { p0: toInput(i1), p1: toInput(i2) } : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(sewing, inputs, SIM_DT);
      sewing = r.state;
      for (const e of r.events) {
        events.push(e);
        // 작업대에 바르게 내려놓으면 2장 완료(기억 2). 문·공간 이동은 체크포인트를 건드리지 않는다.
        if (e.type === 'delivered') run.dispatch({ type: 'completeChapter', at: now, chapterId: 2 });
      }
      // 행동은 첫 틱에서만 쓴다(같은 입력을 두 번 쓰지 않는다)
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    draw(frame);
  });

  function draw(frame: number): void {
    const c = sewing.crate;
    crate.position.set(c.x, c.lifted ? 0.35 : c.place === 'stand' ? 0.47 : c.place === 'bench' ? 0.77 : 0, c.z);
    crate.rotation.y = c.yaw - Math.PI / 2;

    sewing.players.forEach((p, i) => {
      const e = elves[i]!;
      e.root.visible = p.connected;
      e.root.position.set(p.x, 0, p.z);
      e.root.rotation.y = p.facing;
      e.animate(elapsed, p.moving);
      const showBar = p.connected && (p.holding !== null || p.stamina < 100);
      bars[i]!.group.position.set(p.x, 1.75, p.z);
      bars[i]!.group.quaternion.copy(camera.quaternion);
      bars[i]!.set(p.stamina, needsSwap(sewing, p), showBar);
      const sw = swapSigns[i]!;
      sw.visible = needsSwap(sewing, p);
      if (p.holding !== null) {
        const g = gripPos(c, p.holding);
        sw.position.set(g.x, 2.15 + Math.sin(elapsed * 6) * 0.05, g.z);
      }
      // 미리보기 고리: 지금 행동하면 무엇을 하는지 그 대상에 표시
      const a = run.canPlay ? planAction(sewing, p.id) : { kind: 'none' as const };
      const ring = rings[i]!;
      ring.visible = a.kind !== 'none' && a.kind !== 'release';
      if (a.kind === 'grab' || a.kind === 'handover') {
        const g = gripPos(c, a.handle);
        ring.position.set(g.x, 0.03 + i * 0.005, g.z);
      } else if (a.kind === 'latch') ring.position.set(CH2.latch.x, 0.03, CH2.latch.z);
      else if (a.kind === 'door') ring.position.set(CH2.door.x, 0.03, CH2.door.z + 0.4);
      ring.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
      if (i === 0) controls.update(sewingIcon(a.kind));
    });

    const reveal = sewing.space === 'workshop' ? 'open' : sewing.door.open ? 'glimpse' : 'hidden';
    // 팀원이나 재봉틀이 통로·작업실 입구에 있으면 앞을 가리는 벽을 반투명하게(뒤의 친구도 계속 보인다)
    const inPassage = (z: number) => z < CH2.door.z + 0.7 && z > CH2.boundaryZ - 2;
    const seeThrough = sewing.players.some((p) => p.connected && inPassage(p.z)) || inPassage(c.z);
    view.update(frame, { doorOpen: sewing.door.open, latched: sewing.door.latched, reveal, delivered: sewing.delivered, timeSec: elapsed, seeThrough });

    // 카메라: 연결된 팀원 중심을 따라가되, 확정된 공간의 범위 안으로 자른다(뒤의 친구도 화면에 남는다)
    const live = sewing.players.filter((p) => p.connected);
    const cx = live.reduce((s, p) => s + p.x, 0) / Math.max(1, live.length);
    const cz = live.reduce((s, p) => s + p.z, 0) / Math.max(1, live.length);
    const b = CH2.camera[sewing.space];
    const tx = Math.max(b.minX, Math.min(b.maxX, cx));
    const tz = Math.max(b.minZ, Math.min(b.maxZ, cz));
    const k = 1 - Math.exp(-frame * 4);
    camTarget.x += (tx - camTarget.x) * k;
    camTarget.z += (tz - camTarget.z) * k;
    camera.position.copy(camTarget).add(camOffset);
    camera.lookAt(camTarget);
    renderer.render(scene, camera);
  }

  // 자동 검사용 창구(?test)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) {
    const v = new THREE.Vector3();
    (window as unknown as Record<string, unknown>).__lastgift = {
      sewing: () => JSON.parse(JSON.stringify(sewing)) as SewingState,
      sewingEvents: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state }),
      runEffects: () => run.log.map((e) => e.type),
      savedCheckpoint: () => localStorage.getItem('lastgift.cp.v1.dev-ch2'),
      toScreen: (x: number, z: number) => {
        v.set(x, 0, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
    };
  }
}
