// 3장 · 축구공 주위를 맴도는 콩이 — 05a: 공방 옆문 → 울타리 샛길 → 민재네 마당(명세서 §3.2, §5 3장).
//   ?chapter=3  한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter).
//   빈손 요정이 행동 버튼으로 손을 들면, 공을 든 요정이 행동 버튼으로 그 손에 던진다(울타리 너머로도).
//   쪽문은 두 손으로 빗장을 들어야 열려 공을 든 요정은 지나가지 못한다. 콩이는 리본을 따라 울타리 밑으로 쫓아온다.
//   대문 안쪽 자리에 공을 내려놓으면 3장 완료(기억 3). 민재·식구의 입양 장면은 05b(사람은 사용자 에셋).
import * as THREE from 'three';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { createChapter3, planAction, step, CAMERA_YAW, type Ch3Action, type Ch3Event, type Ch3State } from '../core/chapter3';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import type { SewingInput } from '../core/sewing';
import type { ChapterId, MemoryId } from '../data/chapters';
import { chapter } from '../data/chapters';
import { BALL_SPOT, CH3_BOUNDS, W, nearGate, toLane, GATES } from '../data/chapter3';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { createChapter3Scene } from '../scene/chapter3';
import { createKongi } from '../scene/characters';
import { createElfAvatar } from '../scene/elfAvatar';
import { createGift, createTargetRing } from '../scene/gifts';
import { createHoldTween, giftScale, holdSpan, placeOnGround, placeOnHands } from '../scene/hold';
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
/** 3장 화면 넓이 배율: 울타리 양쪽(던질 사람과 받을 사람)이 한 화면에 들어오게 */
const VIEW_K = 1.15;
const SIM_DT = 1 / 60;
const PLAYERS = ['p0', 'p1'] as const;
/** 처음 몇 초: 공방 옆문에서 민재네 대문까지 한 화면 */
const ESTABLISH = { ...W(17, 0), viewH: 34, sec: 3.2 };
/** 던진 공의 높이: 손 높이에서 출발해 거리에 비례해 솟는다 */
const HAND_Y = 0.95 * ELF_SCALE;

export function chapter3Checkpoint(roomId: string) {
  return (runId: string, seed: number) => ({
    schemaVersion: 1,
    runId,
    roomId,
    chapterId: 3 as const,
    savedRemainingMs: chapter(3).floorMs,
    completedChapters: [0, 1, 2] as ChapterId[],
    memories: [1, 2] as MemoryId[],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  });
}

function iconOf(a: Ch3Action): ActionIcon {
  if (a.kind === 'pick') return 'pick';
  if (a.kind === 'drop' || a.kind === 'place') return 'drop';
  if (a.kind === 'throw') return 'throw';
  if (a.kind === 'signal') return a.up ? 'signal' : 'none';
  if (a.kind === 'blocked' || a.kind === 'held') return 'blocked';
  return 'none';
}

/** 둥근 표지(캔버스) */
function badge(draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function disc(g: CanvasRenderingContext2D, fill: string): void {
  g.fillStyle = fill;
  g.strokeStyle = '#fff';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}
function handGlyph(g: CanvasRenderingContext2D, x = 0, y = 0, k = 1): void {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(42, 58, 44, 40, 12);
  g.fill();
  for (const [hx, h] of [[44, 30], [55, 38], [66, 36], [77, 28]] as const) {
    g.beginPath();
    g.roundRect(hx, 64 - h, 9, h + 6, 4.5);
    g.fill();
  }
  g.beginPath();
  g.roundRect(30, 66, 18, 9, 4.5);
  g.fill();
  g.restore();
}

export function startChapter3(models: Models): void {
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const params = new URLSearchParams(location.search);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const space = createChapter3Scene(models, import.meta.env.BASE_URL, low ? 'low' : 'normal');
  setShadows(space.root, true);
  scene.add(space.root);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(60);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const camTarget = new THREE.Vector3(ESTABLISH.x, 0, ESTABLISH.z);
  let viewH = reduceMotion ? 0 : ESTABLISH.viewH;
  let establish = reduceMotion || params.has('noestablish') ? 0 : ESTABLISH.sec;
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

  // 표지: 받을 요정 머리 위 초록 손, 쪽문 앞 "두 손이 필요해요"(공 + 빗금), 콩이가 깰 때 노란 "!"
  const handTex = badge((g) => {
    disc(g, '#2f9a4a');
    handGlyph(g);
  });
  const gateTex = badge((g) => {
    disc(g, '#1b2433');
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(52, 70, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d23a3a';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(52, 70, 22, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(30, 70);
    g.lineTo(74, 70);
    g.stroke();
    // 빗장(노란 막대) 위로 두 손
    g.fillStyle = '#e0b021';
    g.fillRect(70, 34, 40, 10);
    g.strokeStyle = '#e0342f';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(26, 26);
    g.lineTo(102, 102);
    g.stroke();
  });
  const wakeTex = badge((g) => {
    disc(g, '#e0a321');
    g.fillStyle = '#fff';
    g.fillRect(56, 24, 16, 52);
    g.beginPath();
    g.arc(64, 94, 9, 0, Math.PI * 2);
    g.fill();
  });
  const sprite = (tex: THREE.Texture, size: number) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.setScalar(size);
    sp.renderOrder = 30;
    sp.visible = false;
    scene.add(sp);
    return sp;
  };
  const hands = PLAYERS.map(() => sprite(handTex, 1.1));
  const gateSigns = GATES.map(() => sprite(gateTex, 1.3));
  const wakeSign = sprite(wakeTex, 1.0);

  let state: Ch3State = createChapter3(PLAYERS);
  const events: Ch3Event[] = [];
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

  const run = new LocalRun(new CheckpointStore(browserStorage()), hud, 'dev-ch3', 'p0', chapter3Checkpoint('dev-ch3'));
  run.attachVisibility(document);
  run.onEffect((e) => {
    if (e.type === 'retry') state = createChapter3(PLAYERS, run.state.seed);
  });
  run.dispatch({ type: 'start', at: performance.now() });
  if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
  state = createChapter3(PLAYERS, run.state.seed);

  // 요정·공·콩이
  const elves = PLAYERS.map((_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    e.root.scale.multiplyScalar(ELF_SCALE);
    setShadows(e.root, true, false);
    scene.add(e.root);
    return e;
  });
  const ball = createGift('ball');
  const ballScale = giftScale('ball', ELF_SCALE);
  ball.scale.setScalar(ballScale);
  setShadows(ball, true);
  scene.add(ball);
  const ballSpan = holdSpan(ball, ELF_SCALE);
  // 리본 끈: 콩이가 물면 공에서 콩이 입까지 팽팽하게
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 1), new THREE.MeshStandardMaterial({ color: '#e8403a', emissive: '#7a1410', emissiveIntensity: 0.4 }));
  ribbon.visible = false;
  scene.add(ribbon);
  // 공 그림자(날아갈 때 바닥 위치를 읽게)
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: '#1b2433', transparent: true, opacity: 0.3, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.visible = false;
  scene.add(ballShadow);
  const kongi = createKongi(models);
  setShadows(kongi.root, true, false);
  scene.add(kongi.root);
  // 던질 수 있을 때: 받을 요정 발밑에 던지는 요정의 모자 색 고리
  const catchRing = createTargetRing();
  scene.add(catchRing);
  const pickRings = PLAYERS.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });

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
  const gateOpen = GATES.map(() => 0);
  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  let wokeAt = -9;
  let bittenAt = -9;
  /** 끝 장면 시각(초). -1이면 아직 */
  let ending = -1;
  const endCam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
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
    let inputs: Record<string, SewingInput> = live ? { p0: toSewingInput(i1), p1: toSewingInput(i2) } : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(state, inputs, SIM_DT);
      state = r.state;
      for (const e of r.events) {
        events.push(e);
        if (e.type === 'pick' || e.type === 'drop' || e.type === 'throw') actAt.set(e.playerId, elapsed);
        if (e.type === 'catch') actAt.set(e.playerId, elapsed);
        if (e.type === 'wake') wokeAt = elapsed;
        if (e.type === 'bite') {
          bittenAt = elapsed;
          const i = PLAYERS.indexOf(e.playerId as (typeof PLAYERS)[number]);
          elves[i]?.act?.('HitRecieve', { once: true });
        }
        if (e.type === 'complete' && ending < 0) {
          run.dispatch({ type: 'completeChapter', at: performance.now(), chapterId: 3 });
          ending = 0;
        }
      }
      inputs = Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, { ...v, actionDown: false }]));
      acc -= SIM_DT;
      elapsed += SIM_DT;
    }
    draw(frame);
  });

  function draw(frame: number): void {
    const kf = 1 - Math.exp(-frame * 22);
    let mine: Ch3Action = { kind: 'none' };
    catchRing.visible = false;
    state.players.forEach((p, i) => {
      const e = elves[i]!;
      const ps = follow(p.id, p.x, p.z, p.facing, kf);
      e.root.position.set(ps.x, 0, ps.z);
      e.root.rotation.y = ps.yaw;
      const holding = state.ball.carriedBy === p.id;
      const since = elapsed - (actAt.get(p.id) ?? -9);
      e.animate(elapsed, p.moving, { carry: holding ? 'light' : 'none', act: since >= 0 && since < 0.35 ? since / 0.35 : 0, tired: false, span: holding ? ballSpan : undefined });
      e.root.updateMatrixWorld(true);
      // 받으려고 든 손: 손 흔들기 + 머리 위 초록 손
      const hs = hands[i]!;
      hs.visible = p.handUp && ending < 0;
      hs.position.set(ps.x, 2.25 * ELF_SCALE + Math.sin(elapsed * 6) * 0.05, ps.z);
      if (p.handUp) e.act?.('Wave');
      else if (elapsed - bittenAt > 0.7 || state.kongi.biting !== p.id) e.act?.(null);
      const a = run.canPlay ? planAction(state, p.id) : ({ kind: 'none' } as const);
      if (i === 0) mine = a;
      const pr = pickRings[i]!;
      pr.visible = a.kind === 'pick';
      if (pr.visible) pr.position.set(state.ball.x, 0.03 + i * 0.005, state.ball.z);
      pr.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
      if (a.kind === 'throw') {
        const to = state.players.find((q) => q.id === a.to)!;
        catchRing.visible = true;
        (catchRing.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
        catchRing.position.set(to.x, 0.035, to.z);
        catchRing.scale.setScalar(1.6 + Math.sin(elapsed * 8) * 0.12);
      }
    });

    // 공: 손 위 / 포물선 / 땅
    const b = state.ball;
    const idx = b.carriedBy ? state.players.findIndex((q) => q.id === b.carriedBy) : -1;
    ballShadow.visible = !!b.flight;
    if (idx >= 0) {
      const e = elves[idx]!;
      const ps = shown.get(state.players[idx]!.id)!;
      placeOnHands(ball, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
    } else if (b.flight) {
      const f = b.flight;
      const k = Math.min(1, f.t / f.dur);
      const d = Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
      const apex = 1.2 + d * 0.16;
      ball.position.set(b.x, HAND_Y + 4 * apex * k * (1 - k), b.z);
      ball.rotation.set(k * 9, 0, k * 4);
      ballShadow.position.set(b.x, 0.02, b.z);
    } else {
      placeOnGround(ball, b.x, b.z);
    }
    holdTween.apply('ball', ball, idx >= 0, elapsed);

    // 콩이
    const kg = state.kongi;
    const ks = follow('kongi', kg.x, kg.z, kg.facing, kf);
    kongi.root.position.set(ks.x, 0, ks.z);
    kongi.root.rotation.y = ks.yaw;
    if (kg.mode === 'sleep') kongi.play('Idle_2_HeadLow');
    else if (kg.mode === 'bite') kongi.play('Eating', { speed: 1.4 });
    else if (kg.moving) kongi.play(kg.mode === 'circle' ? 'Walk' : 'Gallop', { speed: kg.mode === 'circle' ? 1.6 : 1.2 });
    else kongi.play('Idle');
    kongi.wag(kg.mode === 'sleep' ? 0 : kg.mode === 'bite' ? 0.4 : 1);
    kongi.nose(kg.mode === 'chase' && kg.moving ? 0.5 : 0);
    kongi.update(frame);
    // 리본: 문 동안 공에서 콩이 입까지
    ribbon.visible = kg.mode === 'bite';
    if (ribbon.visible) {
      const mouth = new THREE.Vector3(ks.x + Math.sin(ks.yaw) * 0.42, 0.45, ks.z + Math.cos(ks.yaw) * 0.42);
      const from = ball.getWorldPosition(new THREE.Vector3());
      const mid = from.clone().add(mouth).multiplyScalar(0.5);
      ribbon.position.copy(mid);
      ribbon.lookAt(mouth);
      ribbon.scale.set(1, 1, Math.max(0.05, from.distanceTo(mouth)));
    }
    const wk = elapsed - wokeAt;
    wakeSign.visible = wk >= 0 && wk < 1.2;
    if (wakeSign.visible) wakeSign.position.set(ks.x, 1.4 + Math.sin(wk * 12) * 0.06, ks.z);

    // 쪽문: 빈손 요정이 다가가면 열리고, 공을 든 요정이 다가가면 "두 손이 필요해요"
    GATES.forEach((g, gi) => {
      const c = space.gateCenters[gi]!;
      const near = state.players.filter((p) => p.connected && Math.hypot(p.x - c.x, p.z - c.z) < 1.4);
      const opener = near.some((p) => state.ball.carriedBy !== p.id);
      gateOpen[gi] = gateOpen[gi]! + ((opener ? 1 : 0) - gateOpen[gi]!) * Math.min(1, frame * 8);
      const carrierNear = state.players.find((p) => state.ball.carriedBy === p.id && nearGate(p, 1.9)?.id === g.id);
      const sg = gateSigns[gi]!;
      sg.visible = !!carrierNear && ending < 0;
      sg.position.set(c.x, 2.6 + Math.sin(elapsed * 5) * 0.06, c.z);
    });
    space.setGates(gateOpen);
    space.spot.visible = !state.complete;

    controls.update(iconOf(mine));
    space.update(elapsed);
    if (ending >= 0 && updateEnding(frame)) return;

    // 카메라: 처음엔 공방~대문 한 화면 → 요정 둘과 공을 함께
    establish = Math.max(0, establish - frame);
    let want = { x: ESTABLISH.x, z: ESTABLISH.z, viewH: ESTABLISH.viewH };
    if (establish === 0) {
      const pts: Pt[] = state.players.filter((p) => p.connected).map((p) => ({ x: p.x, z: p.z }));
      const f = state.ball.flight;
      pts.push(f ? { x: f.x1, z: f.z1 } : { x: state.ball.x, z: state.ball.z });
      want = frameFor(pts, goalOf(), aspect, CAMERA_YAW, CAMERA_PITCH);
      const held = deadZone(camTarget, want);
      want = { ...want, x: held.x, z: held.z, viewH: want.viewH * VIEW_K };
    }
    const safe = touchDevice ? (0.1 * viewH) / Math.sin(CAMERA_PITCH) / Math.SQRT2 : 0;
    const tx = Math.max(CH3_BOUNDS.minX, Math.min(CH3_BOUNDS.maxX, want.x + safe));
    const tz = Math.max(CH3_BOUNDS.minZ, Math.min(CH3_BOUNDS.maxZ, want.z + safe));
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
    pts.push(new THREE.Vector3(kg.x, 0.4, kg.z));
    fader.update(pts, frame);
    renderer.render(scene, camera);
  }

  /**
   * 끝(05a): 대문 안쪽에 공을 내려놓으면 사진기가 마당으로 다가가 공 둘레를 빙빙 도는 콩이를 비춘다.
   * 민재가 현관으로 나오는 입양 장면은 05b에서 이어 붙인다.
   */
  function updateEnding(frame: number): boolean {
    ending += frame;
    const t = ending;
    const ez = (x: number) => x * x * (3 - 2 * x);
    const k = ez(Math.min(1, t / 2.2));
    for (const h of hands) h.visible = false;
    for (const s of gateSigns) s.visible = false;
    catchRing.visible = false;
    document.body.classList.add('cutscene');
    const spot = W(BALL_SPOT.s, BALL_SPOT.t);
    // 대문 바로 안쪽에서 현관 쪽을 본다: 공 자리(콩이)와 그 뒤 민재네 현관이 함께(05b에서 민재가 나온다)
    const eye = W(33.7, -0.6);
    const look = W(BALL_SPOT.s + 1.6, BALL_SPOT.t - 0.4);
    const from = camera.position;
    endCam.position.set(from.x + (eye.x - from.x) * k, from.y + (2.2 - from.y) * k, from.z + (eye.z - from.z) * k);
    endCam.lookAt(spot.x + (look.x - spot.x) * k, 0.9 + 0.3 * (1 - k), spot.z + (look.z - spot.z) * k);
    endCam.aspect = aspect;
    endCam.updateProjectionMatrix();
    snow.update(frame, spot.x, spot.z, 20);
    renderer.render(scene, endCam);
    return true;
  }

  /** 앞세워 보여 줄 곳: 오른쪽 줄·마당에 들어서면 대문 안쪽 공 자리 */
  function goalOf(): Pt | null {
    const far = Math.max(...state.players.map((p) => toLane(p).s), toLane(state.ball).s);
    return far > 24 ? W(BALL_SPOT.s, BALL_SPOT.t) : null;
  }

  if (import.meta.env.DEV || params.has('test')) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      ch3: () => JSON.parse(JSON.stringify(state)) as Ch3State,
      ch3Events: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state }),
      ending: () => ending,
      lane: (x: number, z: number) => toLane({ x, z }),
      world: (s: number, t: number) => W(s, t),
      gateSigns: () => gateSigns.map((s) => s.visible),
      debugPlace: (id: string, s: number, t: number, facing = 0) => {
        const p = W(s, t);
        state = {
          ...state,
          players: state.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z, facing, handUp: false } : q)),
          ball: state.ball.carriedBy === id ? { ...state.ball, x: p.x, z: p.z } : state.ball,
        };
        snapCamera = true;
        establish = 0;
      },
      debugKongi: (s: number, t: number, mode: Ch3State['kongi']['mode'] = 'sleep') => {
        const p = W(s, t);
        state = { ...state, kongi: { ...state.kongi, x: p.x, z: p.z, mode, biting: null, left: 0 } };
      },
      toScreen: (x: number, z: number, y = 0) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
      camera: () => ({ target: { x: camTarget.x, z: camTarget.z }, viewH, aspect }),
    };
  }
}
