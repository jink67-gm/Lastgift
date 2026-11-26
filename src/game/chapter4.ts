// 4장 · 할머니의 트리에 다시 불이 켜지면 — 05c: 담장길 → 정원문 → 할머니네 정원(명세서 §3.2, §4 4장, §5 4장).
//   ?chapter=4        한 기기에서 둘이(협동, 스위치 4초). 1P WASD+E·터치, 2P 방향키+Enter
//   ?chapter=4&solo   1인 연습(정원에서 바로 시작, 스위치 max(12초, 왕복 + 3초)). 저장은 본편과 따로("practice-ch4")
//   발전기·연결판을 트리 앞 자리에 놓고 → 전선 셋을 같은 표시 단자에 → 발전기 손잡이를 길게 눌러 돌리고 →
//   트리 양쪽 스위치를 시간 안에 하나씩. 완료하면 아래 가지부터 꼭대기 별까지 불이 켜진다(기억 4).
//   할머니·아이들·사진 장면은 05d(사람은 임시 모형, 인물 에셋을 받으면 교체).
import * as THREE from 'three';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { createChapter4, createPractice, planAction, progressOf, step, timerLeft, CAMERA_YAW, type Ch4Action, type Ch4Event, type Ch4State } from '../core/chapter4';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import type { SewingInput } from '../core/sewing';
import { chapter, type ChapterId, type MemoryId } from '../data/chapters';
import { CH4_BOUNDS, GARDEN, PADS, TERMINALS, TREE, W, WIRES, toLane, type WireColor } from '../data/chapter4';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { boardMesh, createChapter4Scene, generatorMesh, plugMesh, WIRE_HEX } from '../scene/chapter4';
import { createElfAvatar } from '../scene/elfAvatar';
import { createTargetRing } from '../scene/gifts';
import { createHoldTween, placeOnGround, placeOnHands } from '../scene/hold';
import type { Models } from '../scene/models';
import { createOcclusionFader } from '../scene/occlusionFade';
import { createSnowfall } from '../scene/snowfall';
import { createWinterLight, setShadows } from '../scene/winterLight';
import { LocalRun } from '../session/localRun';
import type { ActionIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { createOffscreenMarks } from '../ui/offscreen';
import { createSettingsUi } from '../ui/settings';
import { toSewingInput } from './chapter2';

const testParams = new URLSearchParams(location.search);
const CAMERA_PITCH = (testParams.has('test') && testParams.get('pitch') ? Number(testParams.get('pitch')) : 30) * (Math.PI / 180);
const ELF_SCALE = 1.2;
const VIEW_K = 1.0;
const SIM_DT = 1 / 60;
/** 처음 몇 초: 담장길에서 담장 너머 불 꺼진 트리 꼭대기까지 한 화면 */
const ESTABLISH = { ...W(10, 0), viewH: 30, sec: 3.0 };
/** 정원문을 처음 지나면: 사진과 같은 구도(트리 가운데, 뒤에 할머니네 집)를 잠깐 */
const REVEAL = { ...W(TREE.s - 1, TREE.t), viewH: 30, sec: 2.6 };

export function chapter4Checkpoint(roomId: string) {
  return (runId: string, seed: number) => ({
    schemaVersion: 1,
    runId,
    roomId,
    chapterId: 4 as const,
    savedRemainingMs: chapter(4).floorMs,
    completedChapters: [0, 1, 2, 3] as ChapterId[],
    memories: [1, 2, 3] as MemoryId[],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  });
}

function iconOf(a: Ch4Action): ActionIcon {
  switch (a.kind) {
    case 'pick':
      return 'pick';
    case 'drop':
    case 'place':
      return 'drop';
    case 'plug':
      return 'plug';
    case 'crank':
      return 'crank';
    case 'switch':
      return 'switch';
    case 'wrong':
    case 'needPower':
    case 'blocked':
      return 'blocked';
    default:
      return 'none';
  }
}

export function startChapter4(models: Models): void {
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const params = new URLSearchParams(location.search);
  const solo = params.has('solo');
  const PLAYERS = solo ? (['p0'] as const) : (['p0', 'p1'] as const);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const space = createChapter4Scene(models, import.meta.env.BASE_URL, low ? 'low' : 'normal');
  setShadows(space.root, true);
  scene.add(space.root);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(60);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const start = solo ? REVEAL : ESTABLISH;
  const camTarget = new THREE.Vector3(start.x, 0, start.z);
  let viewH = reduceMotion ? 0 : start.viewH;
  let establish = reduceMotion || params.has('noestablish') ? 0 : start.sec;
  let reveal = 0;
  let aspect = 1;
  let snapCamera = false;
  function applyView(): void {
    camera.left = (-viewH * aspect) / 2;
    camera.right = (viewH * aspect) / 2;
    camera.top = viewH / 2;
    camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
  }
  function resize(): void {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    aspect = host.clientWidth / Math.max(host.clientHeight, 1);
    if (viewH === 0) viewH = baseViewH(aspect);
    applyView();
  }
  window.addEventListener('resize', resize);
  resize();

  // 시간 막대(첫 스위치를 누르면 줄어든다): 화면 위 가운데. 글 없이 막대와 스위치 그림만
  const bar = document.createElement('div');
  bar.id = 'switch-timer';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', '스위치 시간');
  bar.style.cssText =
    'position:fixed;left:50%;top:58px;transform:translateX(-50%);width:min(46vw,420px);height:22px;border:4px solid #fff;border-radius:14px;background:rgba(27,36,51,0.55);box-shadow:0 4px 12px rgba(0,0,0,0.35);z-index:14;display:none;overflow:hidden';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;width:100%;background:#ffd84a;border-radius:8px;transition:background 0.2s';
  bar.appendChild(fill);
  document.body.appendChild(bar);

  let state: Ch4State = solo ? createPractice('p0') : createChapter4(PLAYERS);
  const events: Ch4Event[] = [];
  const k1 = new KeyState(KEYMAP_P1);
  const k2 = new KeyState(KEYMAP_P2);
  attachKeyboard(window, k1);
  attachKeyboard(window, k2);
  const controls = createControls(document);
  const hud = createHud(document);
  const kv = browserStorage();
  const settings = createSettingsUi(document, loadSettings(kv));
  const auto = new AutoQuality();
  let quality: Quality = low ? 'low' : effectiveQuality(settings.value.quality, null);
  const snow = createSnowfall(() => renderer.getPixelRatio());
  scene.add(snow.points);
  function applyQuality(): void {
    quality = low ? 'low' : effectiveQuality(settings.value.quality, auto.result);
    renderer.setPixelRatio(quality === 'low' ? 0.5 : Math.min(window.devicePixelRatio, 2));
    resize();
    light.setShadows(quality === 'normal' && !params.has('noshadow'), scene);
    snow.setCount(snowCount(quality, settings.value.reducedSnow));
  }
  settings.onChange((s) => {
    saveSettings(kv, s);
    applyQuality();
  });
  const marks = createOffscreenMarks(document, PLAYERS.length);

  // 1인 연습 저장은 본편과 따로
  const roomId = solo ? 'practice-ch4' : 'dev-ch4';
  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, roomId, 'p0', chapter4Checkpoint(roomId));
  run.attachVisibility(document);
  const fresh = () => (solo ? createPractice('p0') : createChapter4(PLAYERS));
  run.onEffect((e) => {
    if (e.type === 'retry') {
      state = fresh();
      lastProgress = '';
    }
  });
  run.dispatch({ type: 'start', at: performance.now() });
  if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
  let lastProgress = '';

  // 요정
  const elves = PLAYERS.map((_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    e.root.scale.multiplyScalar(ELF_SCALE);
    setShadows(e.root, true, false);
    scene.add(e.root);
    return e;
  });
  // 들 것: 발전기·연결판·전선 끝
  const gen = generatorMesh();
  gen.group.scale.setScalar(ELF_SCALE);
  const board = boardMesh();
  board.scale.setScalar(ELF_SCALE);
  const things = new Map<string, { v: THREE.Object3D; span: number }>([
    ['generator', { v: gen.group, span: 0.7 }],
    ['board', { v: board, span: 0.8 }],
  ]);
  const plugs = {} as Record<WireColor, THREE.Group>;
  for (const w of WIRES) {
    const m = plugMesh(w.color, w.shape);
    m.scale.setScalar(ELF_SCALE);
    plugs[w.color] = m;
    things.set(`plug-${w.color}`, { v: m, span: 0.3 });
  }
  for (const t of things.values()) {
    setShadows(t.v, true);
    scene.add(t.v);
  }
  // 전선(연결판 → 전선 끝): 늘어진 줄. 끝이 움직이면 다시 만든다
  const cables = {} as Record<WireColor, THREE.Mesh>;
  for (const w of WIRES) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: WIRE_HEX[w.color], roughness: 0.6 }));
    m.visible = false;
    scene.add(m);
    cables[w.color] = m;
  }
  const genCable = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#2a2d35', roughness: 0.7 }));
  genCable.visible = false;
  scene.add(genCable);
  const cableEnds = new Map<THREE.Mesh, string>();
  const setCable = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, r = 0.035) => {
    const key = `${a.x.toFixed(2)},${a.y.toFixed(2)},${a.z.toFixed(2)}|${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}`;
    if (cableEnds.get(m) === key) return;
    cableEnds.set(m, key);
    const mid = a.clone().lerp(b, 0.5);
    const sag = Math.min(0.6, a.distanceTo(b) * 0.18);
    mid.y = Math.max(0.04, Math.min(a.y, b.y) - sag);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    m.geometry.dispose();
    m.geometry = new THREE.TubeGeometry(curve, 16, r, 6, false);
  };
  const pickRings = PLAYERS.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });
  // 전선을 들었을 때: 맞는 단자 발밑에 고리
  const socketRing = createTargetRing();
  scene.add(socketRing);

  const holdTween = createHoldTween();
  const cf = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const fader = createOcclusionFader(scene, camera);
  const shown = new Map<string, { x: number; z: number; yaw: number }>();
  const follow = (id: string, x: number, z: number, yaw: number, k: number) => {
    let v = shown.get(id);
    if (!v || Math.hypot(v.x - x, v.z - z) > 3) {
      v = { x, z, yaw };
      shown.set(id, v);
      return v;
    }
    v.x += (x - v.x) * k;
    v.z += (z - v.z) * k;
    const d = Math.atan2(Math.sin(yaw - v.yaw), Math.cos(yaw - v.yaw));
    v.yaw += d * k;
    return v;
  };
  const actAt = new Map<string, number>();
  const flashAt: Record<WireColor, number> = { red: -9, blue: -9, yellow: -9 };
  let wrongAt = -9;
  let gateOpen = solo ? 1 : 0;
  let crankAngle = 0;
  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  /** 끝 장면 시각(초). -1이면 아직 */
  let ending = -1;
  const endCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);
  let endFrom: THREE.Vector3 | null = null;
  applyQuality();

  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    if (auto.feed(raw)) applyQuality();
    const frame = Math.min(raw, 0.25);
    acc += frame;
    run.frame(now);
    const live = run.canPlay;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    const i2 = k2.sample();
    let inputs: Record<string, SewingInput> = live ? (solo ? { p0: toSewingInput(i1) } : { p0: toSewingInput(i1), p1: toSewingInput(i2) }) : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(state, inputs, SIM_DT);
      state = r.state;
      for (const e of r.events) {
        events.push(e);
        if (e.type === 'pick' || e.type === 'drop') actAt.set(e.playerId, elapsed);
        if (e.type === 'plugged') flashAt[e.color] = elapsed;
        if (e.type === 'wrong' || e.type === 'needPower') wrongAt = elapsed;
        if (e.type === 'entered' && !reduceMotion) reveal = REVEAL.sec;
        // 시간 초과: 가벼운 실수(스위치 쌍만 풀린다, 시계·전선·충전 유지)
        if (e.type === 'timeout') run.dispatch({ type: 'lightFail', at: performance.now() });
        if (e.type === 'complete' && ending < 0) {
          run.dispatch({ type: 'completeChapter', at: performance.now(), chapterId: 4 });
          ending = 0;
        }
      }
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    // 팀 시계 진행 기록(바뀐 것만)
    if (run.state.phase === 'play') {
      const prog = progressOf(state);
      const key = JSON.stringify(prog);
      if (key !== lastProgress) {
        lastProgress = key;
        for (const [k, v] of Object.entries(prog)) if (run.state.progress[k] !== v) run.dispatch({ type: 'setProgress', at: performance.now(), key: k, value: v });
      }
    }
    draw(frame);
  });

  function draw(frame: number): void {
    const kf = 1 - Math.exp(-frame * 22);
    let mine: Ch4Action = { kind: 'none' };
    socketRing.visible = false;
    state.players.forEach((p, i) => {
      const e = elves[i]!;
      const ps = follow(p.id, p.x, p.z, p.facing, kf);
      e.root.position.set(ps.x, 0, ps.z);
      e.root.rotation.y = ps.yaw;
      const held = state.items.find((it) => it.carriedBy === p.id);
      const since = elapsed - (actAt.get(p.id) ?? -9);
      const cranking = state.cranking === p.id;
      e.animate(elapsed, p.moving, { carry: held ? 'light' : 'none', act: since >= 0 && since < 0.35 ? since / 0.35 : 0, tired: false, span: held ? things.get(held.id)!.span : undefined });
      if (cranking) e.act?.('Interact', { speed: 1.6 });
      else e.act?.(null);
      e.root.updateMatrixWorld(true);
      const a = run.canPlay && ending < 0 ? planAction(state, p.id) : ({ kind: 'none' } as const);
      if (i === 0) mine = a;
      const pr = pickRings[i]!;
      const tgt = a.kind === 'pick' ? state.items.find((q) => q.id === a.itemId) : null;
      pr.visible = !!tgt;
      if (tgt) pr.position.set(tgt.x, 0.03 + i * 0.005, tgt.z);
      pr.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
      // 전선 끝을 들고 있으면 같은 표시 단자 발밑에 고리(어디에 끼울지)
      const c = held?.id.startsWith('plug-') ? (held.id.slice(5) as WireColor) : null;
      if (c && i === 0) {
        const tp = W(TERMINALS[c].s, TERMINALS[c].t);
        socketRing.visible = true;
        (socketRing.material as THREE.MeshBasicMaterial).color.set(WIRE_HEX[c]);
        socketRing.position.set(tp.x, 0.03, tp.z);
        socketRing.scale.setScalar(1.5 + Math.sin(elapsed * 6) * 0.1);
      }
    });

    // 들 것: 손 위 / 바닥 / 제자리
    for (const [id, t] of things) {
      const it = state.items.find((q) => q.id === id);
      const idx = it?.carriedBy ? state.players.findIndex((q) => q.id === it.carriedBy) : -1;
      t.v.visible = true;
      if (it && idx >= 0) {
        const e = elves[idx]!;
        const ps = shown.get(state.players[idx]!.id)!;
        placeOnHands(t.v, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
      } else if (it) placeOnGround(t.v, it.x, it.z);
      else if (id === 'generator' || id === 'board') {
        if (state.placed[id]) {
          const p = W(PADS[id].s, PADS[id].t);
          t.v.position.set(p.x, 0, p.z);
          t.v.rotation.set(0, Math.PI / 4, 0);
        } else t.v.visible = false;
      } else {
        const c = id.slice(5) as WireColor;
        if (state.plugged[c]) {
          t.v.position.copy(space.socket[c]).add(new THREE.Vector3(0, -0.05, 0));
          t.v.rotation.set(Math.PI, 0, 0); // 꽂혀 있다(머리가 아래로)
        } else t.v.visible = false;
      }
      if (it) holdTween.apply(id, t.v, idx >= 0, elapsed);
    }
    // 전선: 연결판이 붙은 뒤. 끝(들었으면 손, 바닥이면 그 자리, 꽂혔으면 단자)까지
    for (const w of WIRES) {
      const m = cables[w.color];
      m.visible = state.placed.board;
      if (!m.visible) continue;
      const end = plugs[w.color].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0));
      setCable(m, space.boardOut[w.color], end);
      // 끼운 순간 그 전구 줄이 잠깐 빛난다
      const f = elapsed - flashAt[w.color];
      space.tree.setString(w.color, f >= 0 && f < 1.4 ? Math.max(0, 1 - f / 1.4) : 0);
    }
    genCable.visible = state.placed.generator && state.placed.board;
    if (genCable.visible) setCable(genCable, gen.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.2, 0.3, 0)), space.boardOut.yellow.clone().add(new THREE.Vector3(0.1, -0.05, -0.3)), 0.05);
    // 발전기 바늘·손잡이
    gen.setCharge(state.charge);
    if (state.cranking) crankAngle += frame * 9;
    gen.crank.rotation.x = crankAngle;
    // 스위치
    space.setSwitch('A', state.switches.A, state.charged);
    space.setSwitch('B', state.switches.B, state.charged);
    // 정원문: 누가 다가가면 열리고 그대로
    if (state.players.some((p) => toLane(p).s > 11.5)) gateOpen = Math.min(1, gateOpen + frame * 1.6);
    space.setGate(gateOpen);
    // 시간 막대
    const left = timerLeft(state);
    bar.style.display = left === null || ending >= 0 ? 'none' : 'block';
    if (left !== null) {
      fill.style.width = `${(left * 100).toFixed(1)}%`;
      fill.style.background = left < 0.3 ? '#e0342f' : '#ffd84a';
    }
    controls.update(iconOf(mine));
    space.update(elapsed);
    void wrongAt;
    if (ending >= 0) {
      updateEnding(frame);
      return;
    }

    // 카메라: 처음엔 담장길~트리 꼭대기 → 정원문을 지나면 사진 구도 잠깐 → 요정들과 들 것을 함께
    establish = Math.max(0, establish - frame);
    reveal = Math.max(0, reveal - frame);
    let want = { x: start.x, z: start.z, viewH: start.viewH };
    if (reveal > 0) want = { x: REVEAL.x, z: REVEAL.z, viewH: REVEAL.viewH };
    else if (establish === 0) {
      const pts: Pt[] = state.players.filter((p) => p.connected).map((p) => ({ x: p.x, z: p.z }));
      want = frameFor(pts, goalOf(), aspect, CAMERA_YAW, CAMERA_PITCH);
      const held = deadZone(camTarget, want);
      want = { ...want, x: held.x, z: held.z, viewH: want.viewH * VIEW_K };
    }
    const safe = touchDevice ? (0.1 * viewH) / Math.sin(CAMERA_PITCH) / Math.SQRT2 : 0;
    const tx = Math.max(CH4_BOUNDS.minX, Math.min(CH4_BOUNDS.maxX, want.x + safe));
    const tz = Math.max(CH4_BOUNDS.minZ, Math.min(CH4_BOUNDS.maxZ, want.z + safe));
    const k = snapCamera ? 1 : 1 - Math.exp(-frame * 3);
    const kz = snapCamera ? 1 : 1 - Math.exp(-frame * (want.viewH > viewH ? 4 : 1.2));
    snapCamera = false;
    camTarget.x += (tx - camTarget.x) * k;
    camTarget.z += (tz - camTarget.z) * k;
    const nextH = viewH + (want.viewH - viewH) * kz;
    if (Math.abs(nextH - viewH) > 1e-3) {
      viewH = nextH;
      applyView();
    }
    camera.position.copy(camTarget).add(camOffset);
    camera.lookAt(camTarget);
    light.follow(camTarget.x, camTarget.z, viewH * aspect, viewH / Math.sin(CAMERA_PITCH));
    snow.update(frame, camTarget.x, camTarget.z, viewH * 1.3);
    marks.update(
      state.players.map((p, i) => {
        const ps = shown.get(p.id) ?? p;
        const v = new THREE.Vector3(ps.x, 0.7 * ELF_SCALE, ps.z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight, color: ELF_LOOKS[i]!.hat };
      }),
      host.clientWidth,
      host.clientHeight,
    );
    const pts: THREE.Vector3[] = [];
    for (const p of state.players) if (p.connected) pts.push(new THREE.Vector3(p.x, 0.5 * ELF_SCALE, p.z), new THREE.Vector3(p.x, 1.05 * ELF_SCALE, p.z));
    fader.update(pts, frame);
    renderer.render(scene, camera);
  }

  /** 끝(05c): 아래 가지부터 꼭대기 별까지 불이 켜진다. 할머니 사진기 자리에서 트리를 본다(05d에서 아이들·할머니·사진) */
  function updateEnding(frame: number): void {
    ending += frame;
    const t = ending;
    const ez = (x: number) => x * x * (3 - 2 * x);
    document.body.classList.add('cutscene');
    for (const r of pickRings) r.visible = false;
    space.tree.setLit(Math.min(1, Math.max(0, (t - 0.8) / 3.6)));
    const k = ez(Math.min(1, t / 2.0));
    // 할머니 사진기 바로 뒤·조금 위(사진기 몸통 안으로 들어가지 않게)
    const tree = W(TREE.s, TREE.t);
    const back = new THREE.Vector3(space.tripod.x - tree.x, 0, space.tripod.z - tree.z).normalize();
    const eye = space.tripod.clone().addScaledVector(back, 3.2).add(new THREE.Vector3(0, 1.3, 0));
    const from = endFrom ?? (endFrom = camera.position.clone());
    endCam.position.set(from.x + (eye.x - from.x) * k, from.y + (eye.y - from.y) * k, from.z + (eye.z - from.z) * k);
    endCam.lookAt(tree.x, 3.8 + 1.4 * ez(Math.min(1, Math.max(0, (t - 2) / 3))), tree.z);
    endCam.aspect = aspect;
    endCam.updateProjectionMatrix();
    snow.update(frame, tree.x, tree.z, 24);
    renderer.render(scene, endCam);
  }

  /** 앞세워 보여 줄 곳: 정원에 들어서기 전엔 정원문, 들어선 뒤엔 트리 */
  function goalOf(): Pt | null {
    if (!state.entered) return W(GARDEN.front + 2, 0);
    return W(TREE.s - 2, TREE.t);
  }

  if (import.meta.env.DEV || params.has('test')) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      ch4: () => JSON.parse(JSON.stringify(state)) as Ch4State,
      ch4Events: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state }),
      ending: () => ending,
      timer: () => (bar.style.display === 'none' ? null : timerLeft(state)),
      lane: (x: number, z: number) => toLane({ x, z }),
      world: (s: number, t: number) => W(s, t),
      debugPlace: (id: string, s: number, t: number, facing = Math.PI * 1.25) => {
        const p = W(s, t);
        state = {
          ...state,
          players: state.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z, facing } : q)),
          items: state.items.map((i) => (i.carriedBy === id ? { ...i, x: p.x, z: p.z } : i)),
        };
        snapCamera = true;
        establish = 0;
        reveal = 0;
      },
      /** 시험용: 단계 건너뛰기(placed: 발전기·연결판 제자리, wired: 전선 셋, charged: 충전) */
      debugStage: (stage: 'placed' | 'wired' | 'charged') => {
        let s = state;
        if (!s.placed.board) s = { ...createPractice('p0'), mode: s.mode, players: s.players, window: s.window, entered: true };
        if (stage !== 'placed') s = { ...s, items: s.items.filter((i) => !i.id.startsWith('plug-')), plugged: { red: true, blue: true, yellow: true } };
        if (stage === 'charged') s = { ...s, charge: 1, charged: true };
        state = s;
      },
      toScreen: (x: number, z: number, y = 0) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
    };
  }
}
