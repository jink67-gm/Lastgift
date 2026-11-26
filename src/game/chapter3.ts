// 3장 · 축구공 주위를 맴도는 콩이 — 05a: 공방 옆문 → 울타리 샛길 → 민재네 마당(명세서 §3.2, §5 3장).
//   ?chapter=3  한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter).
//   빈손 요정이 행동 버튼으로 손을 들면, 공을 든 요정이 행동 버튼으로 그 손에 던진다(울타리 너머로도).
//   쪽문은 두 손으로 빗장을 들어야 열려 공을 든 요정은 지나가지 못한다. 콩이는 리본을 따라 울타리 밑으로 쫓아온다.
//   대문 안쪽 자리에 공을 내려놓으면 3장 완료(기억 3). 민재·식구의 입양 장면은 05b(사람은 사용자 에셋).
import * as THREE from 'three';
import { addHaze, createBackdrop } from '../scene/backdrop';
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
import { createPerson, STAND, type PersonPose } from '../scene/people';
import { ADOPTION, adoptionBeat, at } from '../core/adoption';
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
/** 사진기 쪽(길 뒤쪽)을 보는 각 */
const YAW_BACK = Math.PI / 4;
/** 민재네 현관 계단 윗면 높이(문간에 놓는 담요·물그릇·공) */
const PORCH_Y = 0.5;

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
  // 배경: 밤하늘·달·먼 언덕·숲·이웃집(놀이 공간과 사진기 쪽은 비운다)
  scene.add(createBackdrop(models, { center: W(20, 0), forest: [16, 95], trees: 460, keepOut: (p) => { const l = toLane(p); return l.s > -40 && l.s < 56 && Math.abs(l.t) < 12; } }));
  addHaze(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
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
  const endCam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 700);
  /** 끝 장면 시작 때 기억한 것(요정 자리·공 자리·장갑을 내밀 요정) */
  let scene0: { elves: { s: number; t: number }[]; ball: { s: number; t: number }; glove: number; from: THREE.Vector3 } | null = null;
  // 민재네 식구(인물 에셋이 오기 전까지 임시 모형): 문 안쪽에 숨어 있다가 나온다
  const minjae = createPerson(models, 'minjae');
  const mom = createPerson(models, 'mom');
  const dad = createPerson(models, 'dad');
  for (const v of [minjae, mom, dad]) {
    v.root.visible = false;
    scene.add(v.root);
  }
  // 담요(접힌 채 엄마 팔에 → 문간에 펴진다)·물그릇
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.1), new THREE.MeshStandardMaterial({ color: '#7a9ad4', roughness: 1 }));
  blanket.visible = false;
  scene.add(blanket);
  const bowl = new THREE.Group();
  const bowlBody = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.16, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#e0342f', side: THREE.DoubleSide }));
  bowlBody.position.y = 0.08;
  bowl.add(bowlBody);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.23, 18), new THREE.MeshStandardMaterial({ color: '#9fd3f0', roughness: 0.2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.12;
  bowl.add(water);
  bowl.visible = false;
  scene.add(bowl);
  const tmpV = new THREE.Vector3();
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
    if (ending >= 0) {
      controls.update('none');
      space.spot.visible = false;
      updateEnding(frame);
      return;
    }
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
   * 끝: 콩이가 민재네 식구가 되는 장면(core/adoption.ts 시간표). 대사·글 없이 행동과 소품으로만.
   * 사람(민재·엄마·아빠)은 인물 에셋이 오기 전까지 임시 모형(scene/people.ts).
   */
  function updateEnding(frame: number): boolean {
    ending += frame;
    const t = ending;
    const A = ADOPTION;
    for (const h of hands) h.visible = false;
    for (const s of gateSigns) s.visible = false;
    for (const r of pickRings) r.visible = false;
    catchRing.visible = false;
    wakeSign.visible = false;
    ribbon.visible = false;
    ballShadow.visible = false;
    document.body.classList.add('cutscene');
    if (!scene0) {
      // 처음 한 번: 요정들이 서 있던 자리, 공 자리, 덮개 요정(공을 내려놓은 요정)을 기억
      const placer = [...events].reverse().find((e) => e.type === 'drop');
      scene0 = {
        elves: state.players.map((p) => ({ ...toLane(shown.get(p.id) ?? p) })),
        ball: toLane(state.ball),
        glove: Math.max(0, PLAYERS.indexOf((placer && 'playerId' in placer ? placer.playerId : 'p0') as (typeof PLAYERS)[number])),
        from: camera.position.clone(),
      };
    }
    const S0 = scene0;
    const D = space.doorLane;
    const B0 = S0.ball;
    const L = (s0: number, t0: number) => ({ s: s0, t: t0 });
    const mix = (a: { s: number; t: number }, b: { s: number; t: number }, k: number) => L(a.s + (b.s - a.s) * k, a.t + (b.t - a.t) * k);
    const yawTo = (a: { s: number; t: number }, b: { s: number; t: number }) => {
      const pa = W(a.s, a.t), pb = W(b.s, b.t);
      return Math.atan2(pb.x - pa.x, pb.z - pa.z);
    };
    const put = (o: THREE.Object3D, p: { s: number; t: number }, yaw: number, y = 0) => {
      const w = W(p.s, p.t);
      o.position.set(w.x, y, w.z);
      o.rotation.set(0, yaw, 0); // 앞으로 숙이기(rotateX)가 프레임마다 쌓이지 않게 새로 놓는다
    };
    const ez = (x: number) => x * x * (3 - 2 * x);
    const k = (s: readonly [number, number]) => ez(at(t, s));
    const inSpan = (s: readonly [number, number]) => t >= s[0] && t < s[1];

    // 자리(길 좌표)
    const doorOut = L(D.s - 1.1, D.t);
    const M = L(B0.s + 1.15, B0.t); // 민재: 공 앞(집 쪽)
    const K = L(B0.s - 1.35, B0.t); // 콩이: 공 건너편
    const BR = L(B0.s - 0.7, B0.t); // 민재가 굴린 공
    const nearDoor = L(D.s - 1.5, D.t - 1.2); // 문 옆(민재가 문을 잡아 주는 자리)
    const bowlAt = L(D.s - 0.25, D.t - 0.55);
    const blanketAt = L(D.s - 0.3, D.t + 0.25);
    const ballDoor = L(D.s - 0.15, D.t + 0.3);
    const dadAt = L(B0.s - 1.5, B0.t - 1.35);
    const momAt = L(B0.s - 1.2, B0.t + 1.45);
    const dadEnd = L(D.s - 1.2, D.t + 3.0);
    const momEnd = L(D.s - 0.9, D.t + 1.3);
    const E = [L(32.3, 2.0), L(32.1, 3.6)]; // 요정이 물러선 자리(열린 대문 바로 밖: 떠나려는 참)
    const gi = S0.glove;
    const glove = E[gi]!;
    const kongiAtElf = L(glove.s + 1.02, glove.t + (gi === 0 ? 0.15 : -0.15));

    // ── 요정: 대문 쪽으로 물러섰다가, 콩이가 공을 밀어 넣으면 떠나려고 돌아선다 ──
    elves.forEach((e, i) => {
      const from = S0.elves[i]!;
      const kb = k(A.elvesBack);
      let pos = mix(from, E[i]!, kb);
      let walking = inSpan(A.elvesBack);
      // 장갑을 내밀지 않는 요정은 먼저 몇 걸음 떠났다가(골목 쪽) 콩이가 안기면 돌아본다
      const away = L(E[i]!.s - 2.4, E[i]!.t);
      if (i !== gi && t >= A.turnBack[0]) {
        pos = mix(E[i]!, away, k([A.turnBack[0], A.toElf[1]]));
        walking = t < A.toElf[1];
      }
      // 떠나려 돌아선다(대문 쪽) → 장갑 요정은 콩이가 오면 다시 돌아본다
      const leaving = t >= A.turnBack[0];
      const backTo = i === gi && t >= A.toElf[1] - 0.3 && t < A.toMinjae[0] + 0.4;
      let yaw = walking ? yawTo(from, E[i]!) : yawTo(E[i]!, L(D.s, D.t));
      if (leaving && !backTo) yaw = yawTo(E[i]!, L(28, E[i]!.t));
      if (backTo) yaw = yawTo(glove, kongiAtElf);
      if (t >= A.hug[0]) yaw = yawTo(pos, nearDoor); // 손 흔드는 민재를 본다
      put(e.root, pos, yaw);
      const rubbing = i === gi && (inSpan(A.rub) || inSpan(A.scratch));
      e.animate(elapsed, walking, { carry: rubbing && inSpan(A.rub) ? 'light' : 'none', act: 0, tired: false, span: 0.3 });
      if (i === gi && inSpan(A.scratch)) e.act?.('Interact');
      else if (t >= A.wave[0] + 0.4) e.act?.('Wave');
      else e.act?.(null);
    });

    // ── 현관문·사람 ──
    space.setDoor(t < A.ballIn[1] + 6 ? k(A.door) : 1);
    const ph = (sp: number) => elapsed * sp;
    // 민재
    let mPos = doorOut;
    let mYaw = yawTo(D, B0);
    let mPose: PersonPose = { ...STAND };
    if (t < A.minjaeOut[0]) mPos = L(D.s + 0.6, D.t);
    else if (t < A.minjaeOut[1]) {
      mPos = mix(L(D.s + 0.4, D.t), M, k(A.minjaeOut));
      mPose = { ...STAND, walk: ph(1.6) };
    } else if (t < A.beckon[1]) {
      mPos = M;
      mYaw = yawTo(M, K);
      const lookDown = t < A.lookUp[1] ? 0.35 + 0.2 * k(A.lookUp) : 0.4;
      const cr = t < A.crouch[0] ? 0 : t < A.nudge[1] ? k(A.crouch) : 1 - k([A.nudge[1], A.beckon[0]]);
      mPose = { ...STAND, crouch: cr * 0.9, look: lookDown, armR: inSpan(A.roll) || (t >= A.crouch[1] && t < A.roll[0]) ? 'reach' : 'down' };
      if (inSpan(A.beckon)) {
        mYaw = yawTo(M, D);
        mPose = { ...STAND, armR: 'beckon', look: 0 };
      }
    } else if (t < A.bowlPlace[0]) {
      // 문 옆으로 가서 엄마에게 물그릇을 받는다
      const kk = k([A.beckon[1], A.familyOut[1]]);
      mPos = mix(M, nearDoor, kk);
      mYaw = kk < 1 ? yawTo(M, nearDoor) : yawTo(nearDoor, B0);
      mPose = { ...STAND, walk: kk > 0 && kk < 1 ? ph(1.6) : 0, armR: t >= A.bowlGive[0] + 0.3 ? 'hold' : 'down' };
      if (inSpan(A.bowlGive)) mPose.armR = 'reach';
    } else if (t < A.bowlPlace[1]) {
      // 물그릇을 문 안쪽에 놓고 문 옆에 선다
      const kk = at(t, A.bowlPlace);
      const down = Math.sin(Math.min(1, kk * 1.4) * Math.PI);
      mPos = mix(nearDoor, L(bowlAt.s - 0.7, bowlAt.t - 0.2), Math.sin(kk * Math.PI));
      mYaw = yawTo(mPos, bowlAt);
      mPose = { ...STAND, crouch: down, look: 0.5 * down, armR: 'reach' };
    } else if (t < A.hug[0]) {
      mPos = nearDoor;
      mYaw = yawTo(nearDoor, L(D.s, D.t + 1));
      mPose = { ...STAND, armL: 'reach' }; // 문을 잡아 준다
      if (t >= A.turnBack[0]) mYaw = yawTo(nearDoor, glove); // 콩이를 기다린다
    } else {
      mPos = nearDoor;
      mYaw = yawTo(nearDoor, glove);
      mPose = { ...STAND, crouch: 0.75 * k(A.hug), armL: 'hug', armR: t >= A.wave[0] ? 'wave' : 'down', look: -0.15 };
    }
    minjae.root.visible = t >= A.minjaeOut[0] - 0.2;
    put(minjae.root, mPos, mYaw);
    minjae.pose(mPose, elapsed);

    // 아빠·엄마
    const famVisible = t >= A.familyOut[0] - 0.2;
    dad.root.visible = mom.root.visible = famVisible;
    let dPos = dadAt, dYaw = yawTo(dadAt, K);
    let dPose: PersonPose = { ...STAND };
    if (t < A.familyOut[1]) {
      const kk = k(A.familyOut);
      dPos = mix(L(D.s + 0.5, D.t - 0.3), dadAt, kk);
      dYaw = yawTo(D, dadAt);
      dPose = { ...STAND, walk: ph(1.4) };
    } else if (t < A.ballIn[0]) {
      dPose = { ...STAND, crouch: k(A.familyCrouch), look: 0.5, armR: t > A.familyCrouch[1] ? 'pet' : 'down' };
    } else {
      const kk = k([A.ballIn[0], A.ballIn[0] + 2.2]);
      dPos = mix(dadAt, dadEnd, kk);
      dYaw = kk < 1 ? yawTo(dadAt, dadEnd) : yawTo(dadEnd, glove);
      dPose = { ...STAND, walk: kk > 0 && kk < 1 ? ph(1.4) : 0, crouch: 1 - Math.min(1, kk * 3) };
    }
    put(dad.root, dPos, dYaw);
    dad.pose(dPose, elapsed);

    let oPos = momAt, oYaw = yawTo(momAt, K);
    let oPose: PersonPose = { ...STAND };
    let momHas = false;
    mom.root.visible = famVisible;
    if (t < A.familyOut[1]) {
      const kk = k(A.familyOut);
      oPos = mix(L(D.s + 0.5, D.t + 0.4), momAt, kk);
      oYaw = yawTo(D, momAt);
      oPose = { ...STAND, walk: ph(1.5) };
    } else if (t < A.momIn[0]) {
      oPose = { ...STAND, crouch: k(A.familyCrouch), look: 0.5 };
    } else if (t < A.momIn[1]) {
      const kk = k(A.momIn);
      oPos = mix(momAt, L(D.s + 0.6, D.t + 0.2), kk);
      oYaw = yawTo(momAt, D);
      oPose = { ...STAND, walk: ph(1.5) };
    } else if (t < A.momBack[0]) {
      mom.root.visible = false; // 집 안
    } else if (t < A.blanket[1]) {
      const kk = k(A.momBack);
      oPos = mix(L(D.s + 0.6, D.t + 0.2), L(D.s - 0.9, D.t + 0.6), kk);
      oYaw = kk < 1 ? yawTo(D, B0) : yawTo(oPos, blanketAt);
      momHas = true;
      oPose = { ...STAND, walk: kk > 0 && kk < 1 ? ph(1.5) : 0, armL: 'hold', armR: 'hold' };
      if (inSpan(A.blanket)) oPose = { ...STAND, crouch: Math.sin(at(t, A.blanket) * Math.PI), look: 0.6, armL: 'reach', armR: 'hold' };
    } else if (t < A.bowlGive[1]) {
      oPos = L(D.s - 0.9, D.t + 0.6);
      oYaw = yawTo(oPos, nearDoor);
      oPose = { ...STAND, armR: 'reach' };
    } else {
      const kk = k([A.bowlGive[1], A.bowlGive[1] + 1.6]);
      oPos = mix(L(D.s - 0.9, D.t + 0.6), momEnd, kk);
      oYaw = yawTo(oPos, glove);
      oPose = { ...STAND, walk: kk > 0 && kk < 1 ? ph(1.5) : 0, armL: t >= A.wave[0] + 0.8 ? 'wave' : 'down' };
    }
    put(mom.root, oPos, oYaw);
    mom.pose(oPose, elapsed);

    // 담요: 엄마 팔에 접혀 있다가 문간에 펴진다
    const spread = k(A.blanket);
    blanket.visible = (momHas && t >= A.momBack[0]) || t >= A.blanket[0];
    if (t < A.blanket[0]) {
      mom.hand('L', tmpV);
      blanket.position.copy(tmpV).add(new THREE.Vector3(0, 0.1, 0));
      blanket.scale.set(0.45, 6, 0.45);
    } else {
      const w = W(blanketAt.s, blanketAt.t);
      blanket.position.set(w.x, PORCH_Y + 0.03, w.z);
      blanket.rotation.y = YAW_BACK;
      blanket.scale.set(0.45 + 0.55 * spread, 1, 0.45 + 0.55 * spread);
    }
    // 물그릇: 엄마 손 → 민재 손 → 문간 바닥
    bowl.visible = t >= A.momBack[0];
    if (t < A.bowlGive[0] + 0.4) bowl.position.copy(mom.hand('R', tmpV)).add(new THREE.Vector3(0, -0.05, 0));
    else if (t < A.bowlPlace[0] + (A.bowlPlace[1] - A.bowlPlace[0]) * 0.55) bowl.position.copy(minjae.hand('R', tmpV)).add(new THREE.Vector3(0, -0.05, 0));
    else {
      const w = W(bowlAt.s, bowlAt.t);
      bowl.position.set(w.x, PORCH_Y, w.z);
    }

    // ── 공 ──
    let bPos = B0;
    if (inSpan(A.roll)) bPos = mix(B0, BR, ez(at(t, A.roll)));
    else if (t >= A.roll[1] && t < A.nudge[0]) bPos = BR;
    else if (inSpan(A.nudge)) bPos = mix(BR, B0, ez(Math.max(0, (at(t, A.nudge) - 0.35) / 0.65)));
    else if (t >= A.ballIn[0]) bPos = mix(B0, ballDoor, ez(at(t, A.ballIn)));
    const rolled = t >= A.roll[0] ? Math.hypot(bPos.s - B0.s, bPos.t - B0.t) : 0;
    {
      const w = W(bPos.s, bPos.t);
      placeOnGround(ball, w.x, w.z);
      if (t >= A.ballIn[0]) ball.position.y += PORCH_Y * ez(Math.max(0, (at(t, A.ballIn) - 0.6) / 0.4)); // 계단 위로
      ball.rotation.set(rolled * 3 + (t >= A.ballIn[0] ? at(t, A.ballIn) * 12 : 0), 0, 0);
      ball.visible = t < A.ballIn[1] + 0.6;
    }

    // ── 콩이 ──
    let kPos = K, kYaw = yawTo(K, M);
    let clip = 'Idle', kSpeed = 1, wag = 1, hd = 0, side = 0, pitch = 0;
    if (t < A.bow[0]) {
      // 공 둘레를 빙빙 → 돌기를 멈추고 민재 쪽 자리로
      const spin = elapsed * 1.6;
      const around = L(B0.s + Math.cos(spin) * 1.1, B0.t + Math.sin(spin) * 1.1);
      const kk = k([A.minjaeOut[1] - 1.2, A.bow[0]]);
      kPos = mix(around, K, kk);
      kYaw = kk > 0.5 ? yawTo(kPos, M) : yawTo(around, L(B0.s + Math.cos(spin + 0.3) * 1.1, B0.t + Math.sin(spin + 0.3) * 1.1));
      clip = kk > 0.95 ? 'Idle' : 'Walk';
      kSpeed = 1.6;
    } else if (t < A.crouch[0]) {
      // 앞발을 쭉 뻗고(몸 앞을 낮춘다) → 얼굴을 올려다본다
      const bow = Math.sin(at(t, A.bow) * Math.PI);
      pitch = 0.5 * bow;
      hd = t < A.lookUp[0] ? 0.2 * bow : -1 * k(A.lookUp);
      clip = 'Idle';
    } else if (t < A.ballIn[0]) {
      // 공을 받아(코로 밀어) 돌려준다, 식구들에게 둘러싸여 꼬리를 흔든다
      hd = -0.6;
      if (inSpan(A.nudge)) {
        const kk = at(t, A.nudge);
        kPos = mix(K, L(BR.s - 0.5, BR.t), Math.sin(Math.min(1, kk * 1.6) * Math.PI));
        hd = 0.9 * Math.sin(kk * Math.PI);
      }
      if (t >= A.familyCrouch[1]) {
        hd = -0.3;
        side = 0.4 * Math.sin(elapsed * 2.2);
      }
    } else if (t < A.turnBack[0]) {
      // 공을 코로 밀며 문 안으로
      const behind = L(bPos.s - 0.6, bPos.t);
      kPos = mix(K, behind, Math.min(1, at(t, [A.ballIn[0] - 0.4, A.ballIn[0] + 0.6])));
      if (t > A.ballIn[0] + 0.6) kPos = behind;
      kYaw = yawTo(kPos, ballDoor);
      clip = 'Walk';
      kSpeed = 1.2;
      hd = 0.9;
    } else if (t < A.toElf[0]) {
      // 문간에서 돌아선다
      const stop = L(ballDoor.s - 0.6, ballDoor.t);
      kPos = stop;
      kYaw = yawTo(ballDoor, stop) * (1 - k(A.turnBack)) + yawTo(stop, kongiAtElf) * k(A.turnBack);
      hd = 0;
    } else if (t < A.rub[0]) {
      const stop = L(ballDoor.s - 0.6, ballDoor.t);
      kPos = mix(stop, kongiAtElf, k(A.toElf));
      kYaw = yawTo(stop, kongiAtElf);
      clip = 'Gallop';
      kSpeed = 1.1;
    } else if (t < A.toMinjae[0]) {
      // 장갑에 볼을 한 번 꾹 비빈다 → 귀 뒤를 긁어 주자 눈을 감듯 고개를 기울인다
      kPos = kongiAtElf;
      kYaw = yawTo(kongiAtElf, glove) + (inSpan(A.rub) ? 0.22 * Math.sin(at(t, A.rub) * Math.PI) : 0);
      if (inSpan(A.rub)) {
        const r = Math.sin(at(t, A.rub) * Math.PI);
        side = (gi === 0 ? 1 : -1) * 0.9 * r;
        hd = -0.4 * r;
        pitch = 0.08 * r;
      } else {
        side = (gi === 0 ? -1 : 1) * 0.55;
        hd = -0.2;
      }
      wag = 1;
    } else {
      // 민재에게 달려가 안긴다
      const by = L(nearDoor.s - 0.35, nearDoor.t + 0.65);
      kPos = mix(kongiAtElf, by, k(A.toMinjae));
      kYaw = t < A.toMinjae[1] ? yawTo(kongiAtElf, by) : yawTo(by, glove);
      clip = t < A.toMinjae[1] ? 'Gallop' : 'Idle';
      hd = t >= A.hug[0] ? -0.5 : 0;
    }
    put(kongi.root, kPos, kYaw);
    kongi.root.rotateX(pitch);
    kongi.play(clip, { speed: kSpeed });
    kongi.wag(wag);
    kongi.nose(0);
    kongi.head?.(hd, side);
    kongi.update(frame);

    // ── 사진기 ──
    const cam = shotAt(t, { D, B0, glove, nearDoor, gi });
    endCam.position.copy(cam.p);
    endCam.lookAt(cam.q);
    endCam.fov = cam.fov;
    endCam.aspect = aspect;
    endCam.updateProjectionMatrix();
    snow.update(frame, cam.q.x, cam.q.z, 24);
    renderer.render(scene, endCam);
    return true;
  }

  type Shot = { p: THREE.Vector3; q: THREE.Vector3; fov: number };
  type ShotCtx = { D: { s: number; t: number }; B0: { s: number; t: number }; glove: { s: number; t: number }; nearDoor: { s: number; t: number }; gi: number };
  const V3 = (s: number, t: number, y: number) => {
    const w = W(s, t);
    return new THREE.Vector3(w.x, y, w.z);
  };
  /** 장면마다 사진기 자리(앞 장면에서 0.9초 동안 부드럽게 넘어간다) */
  const SHOTS: { at: number; get: (c: ShotCtx) => Shot }[] = [
    // 대문 바로 안쪽에서 현관 쪽: 공 둘레를 도는 콩이, 문이 열리고 민재가 나온다
    { at: 0, get: (c) => ({ p: V3(33.8, c.B0.t - 4.6, 3.0), q: V3(c.B0.s + 3.0, c.B0.t - 0.6, 1.4), fov: 46 }) },
    // 옆에서 낮게: 엎드려 인사·올려다보기·공 주고받기
    { at: ADOPTION.bow[0] - 0.4, get: (c) => ({ p: V3(c.B0.s - 0.3, c.B0.t - 5.6, 1.5), q: V3(c.B0.s, c.B0.t, 1.1), fov: 38 }) },
    // 마당에서 현관 쪽 넓게: 손짓·식구·담요·물그릇
    { at: ADOPTION.beckon[0], get: (c) => ({ p: V3(c.D.s - 10.5, c.D.t - 2.4, 3.4), q: V3(c.D.s - 2.6, c.D.t, 1.6), fov: 44 }) },
    // 공이 문 안으로
    { at: ADOPTION.ballIn[0], get: (c) => ({ p: V3(c.D.s - 7.6, c.D.t - 0.6, 4.0), q: V3(c.D.s - 1.0, c.D.t + 0.4, 0.9), fov: 46 }) },
    // 장갑에 볼 비비기: 요정 눈높이에서 가까이
    { at: ADOPTION.toElf[0] + 0.2, get: (c) => ({ p: V3(c.glove.s - 0.6, c.glove.t + (c.gi === 0 ? 2.9 : -2.9), 1.1), q: V3(c.glove.s + 0.55, c.glove.t, 0.6), fov: 42 }) },
    // 요정들 뒤에서: 콩이를 안고 손을 흔드는 민재
    { at: ADOPTION.toMinjae[0], get: (c) => ({ p: V3(29.9, 2.8, 1.7), q: V3(c.nearDoor.s - 0.4, c.nearDoor.t + 0.3, 1.8), fov: 40 }) },
  ];
  function shotAt(t: number, c: ShotCtx): Shot {
    let i = 0;
    while (i + 1 < SHOTS.length && t >= SHOTS[i + 1]!.at) i++;
    const cur = SHOTS[i]!.get(c);
    // 첫 장면은 놀이 화면 사진기에서 내려온다
    const prev = i === 0 ? { p: scene0!.from.clone(), q: cur.q.clone().setY(0), fov: 42 } : SHOTS[i - 1]!.get(c);
    const kk = Math.min(1, (t - SHOTS[i]!.at) / (i === 0 ? 2.2 : 0.9));
    const e = kk * kk * (3 - 2 * kk);
    return { p: prev.p.lerp(cur.p, e), q: prev.q.lerp(cur.q, e), fov: prev.fov + (cur.fov - prev.fov) * e };
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
      adoption: () => ({ t: ending, beat: ending >= 0 ? adoptionBeat(ending) : null }),
      seekEnding: (t: number) => {
        if (ending >= 0) ending = t;
      },
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
