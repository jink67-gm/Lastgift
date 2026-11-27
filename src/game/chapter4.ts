// 4장 · 할머니의 트리에 다시 불이 켜지면 — 05c: 담장길 → 정원문 → 할머니네 정원(명세서 §3.2, §4 4장, §5 4장).
//   ?chapter=4        한 기기에서 둘이(협동, 스위치 4초). 1P WASD+E·터치, 2P 방향키+Enter
//   ?chapter=4&solo   1인 연습(정원에서 바로 시작, 스위치 max(12초, 왕복 + 3초)). 저장은 본편과 따로("practice-ch4")
//   발전기·연결판을 트리 앞 자리에 놓고 → 전선 셋을 같은 표시 단자에 → 발전기 손잡이를 길게 눌러 돌리고 →
//   트리 양쪽 스위치를 시간 안에 하나씩. 완료하면 아래 가지부터 꼭대기 별까지 불이 켜진다(기억 4).
//   할머니·아이들·사진 장면은 05d(사람은 임시 모형, 인물 에셋을 받으면 교체).
import * as THREE from 'three';
import { addHaze, createBackdrop } from '../scene/backdrop';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { createChapter4, createPractice, planAction, progressOf, step, timerLeft, CAMERA_YAW, type Ch4Action, type Ch4Event, type Ch4State } from '../core/chapter4';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import type { SewingInput } from '../core/sewing';
import { chapter, type ChapterId, type MemoryId } from '../data/chapters';
import { CH4_BOUNDS, GARDEN, GARDEN_WALL, PADS, SWITCHES, TERMINALS, TREE, TRIPOD, W, WIRES, toLane, type WireColor } from '../data/chapter4';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { boardMesh, createChapter4Scene, generatorMesh, plugMesh, WIRE_HEX } from '../scene/chapter4';
import { createElfAvatar } from '../scene/elfAvatar';
import { createPerson, STAND, type PersonPose, type PersonView } from '../scene/people';
import { PHOTO_LINE, TREE_END, TREE_INTRO, treeEndBeat } from '../core/treePhoto';
import { seg } from '../core/prologue';
import { createEnvelope, createPhotoStack, type Envelope } from '../ui/envelope';
import { createTargetRing } from '../scene/gifts';
import { createHoldTween, placeOnGround, placeOnHands } from '../scene/hold';
import type { Models } from '../scene/models';
import { createOcclusionFader } from '../scene/occlusionFade';
import { createSnowfall } from '../scene/snowfall';
import { createWinterLight, setShadows } from '../scene/winterLight';
import { LocalRun } from '../session/localRun';
import { createPlayMeter } from '../session/playMeter';
import { playSfx, sfxEvent } from '../audio/sfx';
import type { TeamRun } from '../session/mirrorRun';
import { playerBack, playerGone } from '../core/presence';
import { IDLE_INTENT } from '../input/intent';
import type { ActionIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { createOffscreenMarks } from '../ui/offscreen';
import { createSettingsUi } from '../ui/settings';
import { toSewingInput } from './chapter2';
import { storyFor, type StoryOptions } from './story';

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

export function startChapter4(models: Models, opts?: StoryOptions): void {
  const sto = storyFor(opts, 'dev-ch4');
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const params = new URLSearchParams(location.search);
  const net = params.has('solo') ? undefined : opts?.net;
  const guest = net?.role === 'guest';
  const solo = params.has('solo');
  /** 이 시도의 요정들(1인 연습 하나, 한 기기 둘, 여러 기기는 방장이 시작할 때 정한 2~4명) */
  const PLAYERS: readonly string[] = solo ? ['p0'] : net ? net.slots : ['p0', 'p1'];
  /** 이 기기가 움직이는 요정 */
  const ME = net?.me ?? 'p0';
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const space = createChapter4Scene(models, import.meta.env.BASE_URL, low ? 'low' : 'normal');
  setShadows(space.root, true);
  scene.add(space.root);
  // 배경: 밤하늘·달·먼 언덕·숲·이웃집(놀이 공간과 사진기 쪽은 비운다)
  scene.add(createBackdrop(models, { center: W(20, 0), forest: [16, 95], trees: 460, keepOut: (p) => { const l = toLane(p); return l.s > -38 && l.s < 50 && Math.abs(l.t) < 15; } }));
  addHaze(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(60);
  // 기기 설정(동작 줄이기) 또는 게임 설정 「움직임 줄이기」
  const reduceMotion = (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) || loadSettings(browserStorage()).noShake;
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
  const roomId = solo ? 'practice-ch4' : sto.roomId;
  const makeRun = () => new LocalRun(new CheckpointStore(browserStorage()), hud, roomId, 'p0', sto.story ? undefined : chapter4Checkpoint(roomId));
  const run: TeamRun = net ? net.bindRun(hud, makeRun) : makeRun();
  run.attachVisibility(document);
  const fresh = () => (solo ? createPractice('p0') : createChapter4(PLAYERS));
  run.onEffect((e) => {
    if (e.type === 'retry') {
      state = fresh();
      lastProgress = '';
    }
  });
  // 처음 들어온 4장이면 봉투·사진 두 장·할머니 장면 먼저(시계는 그 뒤에 흐른다). 1인 연습은 바로. 시험 모드는 &intro일 때만
  const hadSave = new CheckpointStore(browserStorage()).load(roomId) !== null;
  const begin = () => {
    run.dispatch({ type: 'start', at: performance.now() });
    if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
  };
  const wantIntro = !solo && (sto.story ? !sto.introSeen(run.state.runId, 4) : !hadSave) && (!params.has('test') || params.has('intro'));
  if (wantIntro) sto.markIntro(run.state.runId, 4);
  if (!wantIntro) begin();
  let lastProgress = '';
  // 여러 기기: 끊긴 요정은 멈추고 들던 것을 놓는다(발전기 손잡이도) / 참가자는 방장 사건으로 소리·연출을 시작한다
  // 플레이 기록(장별 조작 시간·FPS·기기) + FPS 표시
  const meter = createPlayMeter({ chapterId: 4, run, players: PLAYERS.length, role: net?.role ?? 'local', quality: () => quality, showFps: (f, q) => settings.setFps(f, q) });
  net?.onPresence((id, on) => (state = on ? playerBack(state, id) : playerGone(state, id)));
  net?.onEvents((evs) => {
    for (const e of evs as Ch4Event[]) onEvent(e);
  });

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
  const endCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 700);
  let endFrom: THREE.Vector3 | null = null;

  // ── 사람(임시 모형: 인물 에셋을 받으면 createPerson 안만 바꾼다) ──
  const grandma = createPerson(models, 'grandma');
  const kids = (['kidA', 'kidB', 'kidC'] as const).map((r) => createPerson(models, r));
  for (const v of [grandma, ...kids]) {
    v.root.visible = false;
    setShadows(v.root, true, false);
    scene.add(v.root);
  }
  const lane = (s0: number, t0: number) => ({ s: s0, t: t0 });
  const yawTo = (a: { s: number; t: number }, b: { s: number; t: number }) => {
    const pa = W(a.s, a.t), pb = W(b.s, b.t);
    return Math.atan2(pb.x - pa.x, pb.z - pa.z);
  };
  const putPerson = (v: PersonView, p: { s: number; t: number }, yaw: number, pose: PersonPose, t: number) => {
    const w = W(p.s, p.t);
    v.root.position.set(w.x, 0, w.z);
    v.root.rotation.set(0, yaw, 0);
    v.pose(pose, t);
  };
  const mixL = (a: { s: number; t: number }, b: { s: number; t: number }, k: number) => lane(a.s + (b.s - a.s) * k, a.t + (b.t - a.t) * k);
  const ezf = (x: number) => {
    const k = Math.min(1, Math.max(0, x));
    return k * k * (3 - 2 * k);
  };
  const TRIPOD_L = lane(TRIPOD.s, TRIPOD.t);
  /** 사진 속 자리: 아이들(비워 주기 전·후), 할머니 */
  const kidSpot = (i: number, after: number) => lane(PHOTO_LINE.s, PHOTO_LINE.before[i]! + (PHOTO_LINE.after[i]! - PHOTO_LINE.before[i]!) * after);
  const grandmaSpot = lane(PHOTO_LINE.s, PHOTO_LINE.grandma);
  /** 사진 찍는 자리: 모두 사진기 쪽을 보고 양손 브이 */
  const posePhotoPeople = (t: number) => {
    const v: PersonPose = { ...STAND, armL: 'vsign', armR: 'vsign' };
    kids.forEach((k, i) => putPerson(k, kidSpot(i, 1), yawTo(kidSpot(i, 1), TRIPOD_L), v, t));
    putPerson(grandma, grandmaSpot, yawTo(grandmaSpot, TRIPOD_L), v, t);
  };

  // ── 할머니 사진기 구도(봉투 속 두 사진, 마지막 사진이 같은 구도) ──
  const photoCam = new THREE.PerspectiveCamera(66, 4 / 3, 0.1, 700);
  {
    const tw = W(TREE.s, TREE.t);
    const dir = new THREE.Vector3(tw.x - space.tripod.x, 0, tw.z - space.tripod.z).normalize();
    photoCam.position.copy(space.tripod).addScaledVector(dir, 0.45).add(new THREE.Vector3(0, 0.05, 0));
    photoCam.lookAt(tw.x, 4.5, tw.z);
  }
  const PHOTO_W = 800, PHOTO_H = 600;
  const blankPhoto = () => {
    const c = document.createElement('canvas');
    c.width = PHOTO_W;
    c.height = PHOTO_H;
    return c;
  };
  const photos = { lastYear: blankPhoto(), thisYear: blankPhoto() };
  let photosReady = false;
  /** 장면을 할머니 사진기 구도로 찍어 into에 그린다. 놀이 물건·요정은 빼고(마지막 사진은 지금 그대로) */
  function capture(kind: 'lastYear' | 'thisYear' | 'final', into: HTMLCanvasElement, litAfter: number): void {
    const hide: THREE.Object3D[] = kind === 'final' ? elves.map((e) => e.root) : [...elves.map((e) => e.root), gen.group, board, ...Object.values(plugs), ...Object.values(cables), genCable, ...pickRings, socketRing];
    const was = hide.map((o) => o.visible);
    const peopleWas = [grandma, ...kids].map((v) => v.root.visible);
    hide.forEach((o) => (o.visible = false));
    if (kind === 'lastYear') {
      space.tree.setLit(1);
      posePhotoPeople(0.5);
      [grandma, ...kids].forEach((v) => (v.root.visible = true));
    } else if (kind === 'thisYear') {
      space.tree.setLit(0);
      [grandma, ...kids].forEach((v) => (v.root.visible = false));
    }
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(PHOTO_W, PHOTO_H, false);
    photoCam.aspect = PHOTO_W / PHOTO_H;
    photoCam.updateProjectionMatrix();
    renderer.render(scene, photoCam);
    const g = into.getContext('2d')!;
    g.drawImage(renderer.domElement, 0, 0, PHOTO_W, PHOTO_H);
    if (kind === 'lastYear') {
      // 작년 사진: 조금 따뜻하게 바랜 색
      g.fillStyle = 'rgba(255, 196, 120, 0.13)';
      g.fillRect(0, 0, PHOTO_W, PHOTO_H);
    }
    if (kind === 'thisYear') {
      // 할머니가 노란 색연필로 전구마다 그린 작은 불빛
      const v = new THREE.Vector3();
      space.tree.bulbs().forEach((b, i) => {
        v.copy(b).project(photoCam);
        if (v.z > 1) return;
        const x = ((v.x + 1) / 2) * PHOTO_W, y = ((1 - v.y) / 2) * PHOTO_H;
        const r = 4.5 + ((i * 37) % 5) * 0.4;
        g.fillStyle = 'rgba(255, 214, 64, 0.9)';
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255, 200, 40, 0.8)';
        g.lineWidth = 1.6;
        g.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const a = k * (Math.PI / 2) + (i % 3) * 0.3;
          g.beginPath();
          g.moveTo(x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2));
          g.lineTo(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6));
          g.stroke();
        }
      });
    }
    renderer.setPixelRatio(pr);
    renderer.setSize(size.x, size.y, false);
    hide.forEach((o, i) => (o.visible = was[i]!));
    [grandma, ...kids].forEach((v, i) => (v.root.visible = peopleWas[i]!));
    space.tree.setLit(litAfter);
  }
  const makePhotos = () => {
    if (photosReady) return;
    photosReady = true;
    capture('lastYear', photos.lastYear, 0);
    capture('thisYear', photos.thisYear, 0);
  };

  // ── 시작 장면: 봉투 → 사진을 내리면 같은 구도의 마당 → 할머니가 스위치를 눌러 보고 아이들을 데리러 나간다 ──
  let envelope: Envelope | null = wantIntro ? createEnvelope(document, photos) : null;
  /** 봉투 뒤 3D 장면 시각(-1: 아직 봉투) */
  let introT = wantIntro ? -1 : -2;
  let introSkip: HTMLButtonElement | null = null;
  const introCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 700);
  const endIntro = () => {
    envelope?.dispose();
    envelope = null;
    introSkip?.remove();
    introSkip = null;
    introT = -2;
    grandma.root.visible = false;
    for (const e of elves) e.root.visible = true;
    space.tree.setString('red', 0);
    space.tree.setString('blue', 0);
    space.tree.setString('yellow', 0);
    document.body.classList.remove('cutscene');
    begin();
    establish = reduceMotion ? 0 : start.sec;
    snapCamera = true;
  };
  function updateIntro(frame: number): void {
    for (const e of elves) e.root.visible = false;
    if (envelope) {
      if (envelope.stage >= 1) makePhotos();
      const done = envelope.update(frame);
      // 봉투 뒤: 할머니 사진기 구도의 마당(사진을 내리면 그대로 이어진다), 할머니는 사진기 옆
      grandma.root.visible = true;
      putPerson(grandma, lane(TRIPOD.s - 0.3, TRIPOD.t + 1.1), yawTo(lane(TRIPOD.s - 0.3, TRIPOD.t + 1.1), TRIPOD_L), { ...STAND, armL: 'reach', armR: 'reach' }, elapsed);
      renderIntro(photoCam, 4 / 3);
      if (done && envelope.skipped) {
        endIntro();
        return;
      }
      if (done) {
        envelope.dispose();
        envelope = null;
        introT = 0;
        introSkip = document.createElement('button');
        introSkip.id = 'env-skip';
        introSkip.type = 'button';
        introSkip.textContent = '건너뛰기 ▶▶';
        introSkip.addEventListener('click', endIntro);
        document.body.appendChild(introSkip);
      }
      return;
    }
    introT += frame;
    const t = introT;
    const I = TREE_INTRO;
    const G0 = lane(TRIPOD.s - 0.3, TRIPOD.t + 1.1);
    const SW = lane(SWITCHES.A.s - 1.1, SWITCHES.A.t + 0.4);
    const treeL = lane(TREE.s, TREE.t);
    let pos = G0, yaw = yawTo(G0, TRIPOD_L);
    let pose: PersonPose = { ...STAND, armL: 'reach', armR: 'reach' };
    if (t >= I.setCamera[1] && t < I.toSwitch[1]) {
      const k = ezf(seg(t, I.toSwitch));
      pos = mixL(G0, SW, k);
      yaw = yawTo(G0, SW);
      pose = { ...STAND, walk: elapsed * 1.5 };
    } else if (t >= I.toSwitch[1] && t < I.leave[0]) {
      pos = SW;
      yaw = t < I.shake[0] ? yawTo(SW, lane(SWITCHES.A.s, SWITCHES.A.t)) : yawTo(SW, treeL);
      pose = { ...STAND, armR: t < I.flicker[1] ? 'reach' : 'down', look: t >= I.shake[0] ? -0.6 : 0 };
      if (t >= I.shake[0]) pose.turn = Math.sin((t - I.shake[0]) * 7) * 0.45 * (1 - seg(t, I.shake));
    } else if (t >= I.leave[0]) {
      // 대문 밖으로(사진기가 담장길 쪽으로 바뀐다)
      const k = seg(t, I.leave);
      pos = mixL(lane(GARDEN_WALL.s + 1.2, 0.2), lane(GARDEN_WALL.s - 4.5, 0.6), k);
      yaw = yawTo(lane(GARDEN_WALL.s + 1, 0), lane(0, 0));
      pose = { ...STAND, walk: elapsed * 1.5 };
    }
    grandma.root.visible = true;
    putPerson(grandma, pos, yaw, pose, elapsed);
    // 스위치를 눌러도 전구가 아주 잠깐 깜박이다 만다
    const fl = t >= I.flicker[0] && t < I.flicker[1] ? (Math.sin((t - I.flicker[0]) * 40) > 0.3 ? 0.35 : 0) : 0;
    space.tree.setString('red', fl);
    space.tree.setString('blue', fl);
    space.tree.setString('yellow', fl);
    space.setSwitch('A', t >= I.press[0] + 0.2 && t < I.flicker[1], false);
    // 사진기: 사진 구도 → 스위치 앞의 할머니 → 담장길에서 대문을 나서는 할머니
    if (t < I.press[0] - 0.2) renderIntro(photoCam, 4 / 3); // 걷는 동안은 사진 구도 그대로(사진 속 마당을 가로지른다)
    else {
      const sw = W(SW.s, SW.t);
      const tw = W(TREE.s, TREE.t);
      if (t < I.leave[0]) {
        // 스위치 앞 할머니가 가운데, 뒤로 불 꺼진 트리
        const eye = W(SW.s - 5.0, SW.t + 1.6);
        introCam.position.set(eye.x, 2.5, eye.z);
        introCam.lookAt(sw.x * 0.7 + tw.x * 0.3, 2.8, sw.z * 0.7 + tw.z * 0.3);
      } else {
        const eye = W(GARDEN_WALL.s - 8.5, 1.6);
        const gate = W(GARDEN_WALL.s, 0);
        introCam.position.set(eye.x, 2.4, eye.z);
        introCam.lookAt(gate.x, 2.0, gate.z);
      }
      renderIntro(introCam, aspect);
    }
    space.setGate(t >= I.leave[0] - 0.4 ? Math.min(1, (t - I.leave[0] + 0.4) * 1.5) : 0);
    // 끝: 어두워졌다가 놀이로
    const fo = seg(t, I.fadeOut);
    renderer.domElement.style.filter = fo > 0 ? `brightness(${1 - 0.8 * fo})` : '';
    if (t >= I.end) {
      renderer.domElement.style.filter = '';
      endIntro();
    }
  }
  function renderIntro(cam: THREE.PerspectiveCamera, camAspect: number): void {
    // 사진 구도는 화면 비율과 상관없이 같은 높이로(가로가 넓으면 양옆이 더 보인다)
    cam.aspect = cam === photoCam ? aspect : camAspect;
    cam.updateProjectionMatrix();
    snow.update(1 / 60, cam.position.x, cam.position.z, 24);
    renderer.render(scene, cam);
    cam.aspect = 4 / 3;
  }

  // ── 끝: 마지막 사진 ──
  const finalPhoto = blankPhoto();
  let stack: ReturnType<typeof createPhotoStack> | null = null;
  let endElves: { s: number; t: number }[] | null = null;
  applyQuality();

  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    meter.frame(raw);
    if (auto.feed(raw)) applyQuality();
    const frame = Math.min(raw, 0.25);
    if (introT !== -2) {
      run.frame(now);
      if (guest) {
        net!.sendIntent(IDLE_INTENT);
        state = net!.remote<Ch4State>() ?? state;
      }
      elapsed += frame;
      controls.update('none');
      updateIntro(frame);
      return;
    }
    acc += frame;
    run.frame(now);
    const live = run.canPlay;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    if (guest) {
      // 참가자: 입력만 보내고 방장 상태를 그린다
      net!.sendIntent(live ? i1 : IDLE_INTENT);
      state = net!.remote<Ch4State>() ?? state;
      // 사건을 놓쳤어도(잠깐 끊김) 방장 상태로 끝 장면을 시작한다
      if (state.complete && ending < 0) onEvent({ type: 'complete' } as Ch4Event);
      elapsed += frame;
      acc = 0;
      draw(frame);
      return;
    }
    let inputs: Record<string, SewingInput> = net
      ? net.inputs(i1, live)
      : live
        ? solo
          ? { p0: toSewingInput(i1) }
          : { p0: toSewingInput(i1), p1: toSewingInput(k2.sample()) }
        : { p0: idle, p1: idle };
    while (acc >= SIM_DT) {
      const r = step(state, inputs, SIM_DT);
      state = r.state;
      for (const e of r.events) onEvent(e);
      net?.emit(r.events);
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
    net?.publish(4, state);
    draw(frame);
  });

  function onEvent(e: Ch4Event): void {
    sfxEvent(e);
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
      if (cranking) playSfx('crank'); // 손잡이 돌리는 딸깍 소리(0.12초마다)
      if (cranking) e.act?.('Interact', { speed: 1.6 });
      else e.act?.(null);
      e.root.updateMatrixWorld(true);
      const a = run.canPlay && ending < 0 ? planAction(state, p.id) : ({ kind: 'none' } as const);
      if (p.id === ME) mine = a;
      const pr = pickRings[i]!;
      const tgt = a.kind === 'pick' ? state.items.find((q) => q.id === a.itemId) : null;
      pr.visible = !!tgt;
      if (tgt) pr.position.set(tgt.x, 0.03 + i * 0.005, tgt.z);
      pr.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
      // 전선 끝을 들고 있으면 같은 표시 단자 발밑에 고리(어디에 끼울지)
      const c = held?.id.startsWith('plug-') ? (held.id.slice(5) as WireColor) : null;
      if (c && p.id === ME) {
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

  /**
   * 끝(core/treePhoto.ts TREE_END): 아래 가지부터 꼭대기 별까지 불 → 요정들은 트리 뒤로 숨는다 → 아이들이 대문으로 들어와
   * 트리 앞으로 → 할머니가 사진기 타이머를 누르고 돌아서는 순간 아이들이 가운데를 비워 준다 → 할머니가 그 자리에서 양손 브이 →
   * 찰칵 → 올해 사진이 화면을 채우고 작년 사진이 같은 구도로 포개진다.
   */
  function updateEnding(frame: number): void {
    ending += frame;
    if (ending > TREE_END.end + 0.6) sto.next(); // 이야기 모드: 사진 뒤 5장으로
    const t = ending;
    const E = TREE_END;
    document.body.classList.add('cutscene');
    for (const r of pickRings) r.visible = false;
    socketRing.visible = false;
    if (!photosReady) makePhotos(); // 시작 장면을 건너뛰었으면 지금 작년 사진을 만든다
    space.tree.setLit(ezf(seg(t, E.lights)));
    // 요정들: 트리 뒤로 숨는다
    if (!endElves) endElves = state.players.map((p) => toLane(shown.get(p.id) ?? p));
    elves.forEach((e, i) => {
      const from = endElves![i]!;
      const hide = lane(TREE.s + 3.4 + (i >= 2 ? 0.9 : 0), TREE.t + [-0.9, 0.9, -1.7, 1.7][i % 4]!);
      const k = ezf(seg(t, E.elvesHide));
      const p = mixL(from, hide, k);
      const w = W(p.s, p.t);
      e.root.position.set(w.x, 0, w.z);
      e.root.rotation.y = k < 1 ? yawTo(from, hide) : yawTo(hide, TRIPOD_L);
      e.animate(elapsed, k > 0 && k < 1, { carry: 'none', act: 0, tired: false });
      e.act?.(null);
    });
    // 아이들: 대문으로 들어와 트리 앞 한 줄 → 가운데를 비워 준다 → 브이
    kids.forEach((v, i) => {
      v.root.visible = t >= E.kidsIn[0] - 0.1;
      const door = lane(GARDEN_WALL.s - 0.6, -0.6 + i * 0.6);
      const kIn = ezf(seg(t, [E.kidsIn[0] + i * 0.35, E.kidsIn[1] - (2 - i) * 0.2]));
      const spot = kidSpot(i, ezf(seg(t, E.makeRoom)));
      const p = kIn < 1 ? mixL(door, kidSpot(i, 0), kIn) : spot;
      const moving = (kIn > 0 && kIn < 1) || (t >= E.makeRoom[0] && t < E.makeRoom[1]);
      const pose: PersonPose = { ...STAND, walk: moving ? elapsed * 2.2 : 0, look: -0.1 };
      if (t >= E.vsign[0]) pose.armL = pose.armR = 'vsign';
      else if (!moving && t > E.kidsIn[1]) pose.armR = Math.floor(t * 1.3 + i) % 3 === 0 ? 'wave' : 'down';
      putPerson(v, p, kIn < 1 ? yawTo(door, kidSpot(i, 0)) : yawTo(p, TRIPOD_L), pose, elapsed);
    });
    // 할머니: 뒤따라 들어와 사진기 앞 → 타이머 → 가운데 자리 → 브이
    grandma.root.visible = t >= E.grandmaIn[0] - 0.1;
    const G0 = lane(TRIPOD.s - 0.3, TRIPOD.t + 1.1);
    const door = lane(GARDEN_WALL.s - 0.6, 0);
    let gp = G0, gy = yawTo(G0, TRIPOD_L);
    let gpose: PersonPose = { ...STAND };
    if (t < E.grandmaIn[1]) {
      const k = ezf(seg(t, E.grandmaIn));
      gp = mixL(door, G0, k);
      gy = yawTo(door, G0);
      gpose = { ...STAND, walk: elapsed * 1.4 };
    } else if (t < E.toSpot[0]) {
      gpose = { ...STAND, armR: 'reach', look: 0.3 };
    } else if (t < E.toSpot[1]) {
      const k = ezf(seg(t, E.toSpot));
      gp = mixL(G0, grandmaSpot, k);
      gy = k < 0.85 ? yawTo(G0, grandmaSpot) : yawTo(grandmaSpot, TRIPOD_L);
      gpose = { ...STAND, walk: elapsed * 1.8 };
    } else {
      gp = grandmaSpot;
      gy = yawTo(grandmaSpot, TRIPOD_L);
      gpose = { ...STAND, armL: t >= E.vsign[0] ? 'vsign' : 'down', armR: t >= E.vsign[0] ? 'vsign' : 'down' };
    }
    putPerson(grandma, gp, gy, gpose, elapsed);
    // 타이머 등: 누른 뒤 찰칵까지 깜박(점점 빨리)
    const tl = t >= E.timer[1] && t < E.shutter ? Math.sin((t - E.timer[1]) * (6 + (t - E.timer[1]) * 4)) > 0 : false;
    space.setTimerLamp(tl);
    // 찰칵: 지금 장면을 할머니 사진기 구도로 찍어 화면을 채운다 → 작년 사진이 같은 구도로 포개진다
    if (t >= E.shutter && !stack) {
      playSfx('shutter');
      capture('final', finalPhoto, 1);
      stack = createPhotoStack(document, finalPhoto, photos.lastYear, E.overlay[0] - E.shutter, E.overlay[1] - E.overlay[0]);
    }
    if (stack) stack.update(t - E.shutter);
    // 사진기: 지금 화면 → 할머니 사진기 바로 뒤·위(사진과 같은 쪽에서 본다)
    const k = ezf(t / 2.0);
    const tree = W(TREE.s, TREE.t);
    const back = new THREE.Vector3(space.tripod.x - tree.x, 0, space.tripod.z - tree.z).normalize();
    const eye = space.tripod.clone().addScaledVector(back, 3.2).add(new THREE.Vector3(0, 2.6, 0));
    const from = endFrom ?? (endFrom = camera.position.clone());
    endCam.position.set(from.x + (eye.x - from.x) * k, from.y + (eye.y - from.y) * k, from.z + (eye.z - from.z) * k);
    endCam.lookAt(tree.x, 3.2 + 1.0 * ezf((t - 2) / 3), tree.z);
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
      playLog: () => meter.current(),
      ending: () => ending,
      /** 시험(여러 기기 이어 붙이기): 방장이 이 장을 바로 마친 것으로(사건을 참가자에게도 보낸다) */
      debugWin: () => {
        const e = { type: 'complete' } as Ch4Event;
        state = { ...state, complete: true };
        onEvent(e);
        net?.emit([e]);
      },
      endBeat: () => (ending >= 0 ? treeEndBeat(ending) : null),
      seekEnding: (t: number) => {
        if (ending >= 0) ending = t;
      },
      intro: () => ({ envelope: envelope ? envelope.stage : null, t: introT, photos: photosReady }),
      introNext: () => envelope?.next(),
      skipIntro: () => (envelope ? envelope.skip() : endIntro()),
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
