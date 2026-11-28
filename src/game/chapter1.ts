// 1장 · 유나의 첫 스케치북 — 04-4a: 돌 아치 → 우편함 골목 → 유나네 앞마당 찾기(명세서 §3.2, §5 1장).
//   ?chapter=1  한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter).
//   두 선물(스케치북·색연필 통)을 나눠 들고, 빈손 요정은 지우의 그림 지도를 펴서(E) 생김새를 비교한다.
//   유나네 앞마당(낮은 담 안)에 들어서면 "찾았다". 망보기·현관 배달·유나 장면은 04-4b.
//   사람(유나·지우)은 사용자가 줄 에셋으로 넣는다(지금은 창가에 실루엣 자리).
import * as THREE from 'three';
import { isAdmin } from '../ui/admin';
import { addHaze, createBackdrop } from '../scene/backdrop';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { createChapter1, gazeAt, lookoutAt, planAction, step, CAMERA_YAW, SACK, type Ch1Action, type Ch1Event, type Ch1State } from '../core/chapter1';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import type { SewingInput } from '../core/sewing';
import { chapter } from '../data/chapters';
import { CH1_BOUNDS, CH1_START, W, YARD, toLane } from '../data/chapter1';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { createChapter1Scene, FROST_LAYER } from '../scene/chapter1';
import { createElfAvatar } from '../scene/elfAvatar';
import { createGift, createTargetRing } from '../scene/gifts';
import { createSack } from '../scene/chapter0';
import { createHoldTween, giftScale, holdSpan, placeOnGround, placeOnHands } from '../scene/hold';
import type { Models } from '../scene/models';
import { createOcclusionFader } from '../scene/occlusionFade';
import { createOutline } from '../scene/outline';
import { createSnowfall } from '../scene/snowfall';
import { createWinterLight, setShadows } from '../scene/winterLight';
import { LocalRun } from '../session/localRun';
import { createPlayMeter } from '../session/playMeter';
import { sfxEvent } from '../audio/sfx';
import type { TeamRun } from '../session/mirrorRun';
import { playerBack, playerGone } from '../core/presence';
import { IDLE_INTENT } from '../input/intent';
import type { ActionIcon } from '../ui/actionIcons';
import { createControls } from '../ui/controls';
import { createHud } from '../ui/hud';
import { createMapView } from '../ui/mapView';
import { createOffscreenMarks } from '../ui/offscreen';
import { createSettingsUi } from '../ui/settings';
import { createStorybook, drawWhale, type Storybook } from '../ui/storybook';
import { toSewingInput } from './chapter2';
import { storyFor, type StoryOptions } from './story';

const testParams = new URLSearchParams(location.search);
const CAMERA_PITCH = (testParams.has('test') && testParams.get('pitch') ? Number(testParams.get('pitch')) : 30) * (Math.PI / 180);
const ELF_SCALE = 1.2;
/** 1장 화면 넓이 배율(광장 기준 구도 대비) */
const VIEW_K = 1.3;
const SIM_DT = 1 / 60;
/** 처음 몇 초: 갈림길 동네 전체를 한 화면(어느 집인지는 지도를 보고 가까이 가서 고른다) */
const ESTABLISH = { ...W(19, -2), viewH: 52, sec: 3.6 };

export function chapter1Checkpoint(roomId: string) {
  return (runId: string, seed: number) => ({
    schemaVersion: 1,
    runId,
    roomId,
    chapterId: 1 as const,
    savedRemainingMs: chapter(1).floorMs,
    completedChapters: [0] as 0[],
    memories: [] as never[],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  });
}

function iconOf(a: Ch1Action): ActionIcon {
  if (a.kind === 'pick') return 'pick';
  if (a.kind === 'drop' || a.kind === 'place') return 'drop';
  if (a.kind === 'signal') return a.up ? 'signal' : 'none';
  if (a.kind === 'blocked') return 'blocked';
  if (a.kind === 'map') return a.open ? 'map' : 'mapClose';
  if (a.kind === 'gate') return 'latch'; // 유나네든 가짜 집이든 같은 그림(열어 봐야 안다)
  return 'none';
}

export function startChapter1(models: Models, opts?: StoryOptions): void {
  const sto = storyFor(opts, 'dev-ch1');
  const net = opts?.net;
  const guest = net?.role === 'guest';
  /** 이 시도의 요정들(한 기기 둘, 여러 기기는 방장이 시작할 때 정한 2~4명) */
  const PLAYERS: readonly string[] = net ? net.slots : ['p0', 'p1'];
  /** 이 기기가 움직이는 요정 */
  const ME = net?.me ?? 'p0';
  const host = document.getElementById('game')!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const params = new URLSearchParams(location.search);
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const low = params.get('quality') === 'low';
  const light = createWinterLight(scene, renderer, { shadows: !low && !params.has('noshadow'), mapSize: touchDevice ? 1024 : 2048 });
  const space = createChapter1Scene(models, import.meta.env.BASE_URL, low ? 'low' : 'normal');
  setShadows(space.root, true);
  scene.add(space.root);
  // 배경: 밤하늘·달·먼 언덕·숲·이웃집(놀이 공간과 사진기 쪽은 비운다)
  scene.add(createBackdrop(models, { center: W(25, 0), forest: [16, 95], trees: 460, keepOut: (p) => { const l = toLane(p); return l.s > -48 && l.s < 75 && l.t > -40 && l.t < 36; } })); // 갈림길 동네 전체(먼 집·숲이 길을 덮지 않게)
  addHaze(scene);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  camera.layers.enable(FROST_LAYER); // 큰 화면은 창 성에가 보인다(유나가 어디를 보는지 모른다)
  // 망보는 자리에서 창을 들여다보는 작은 화면(성에 층을 빼고 그린다)
  const peekCam = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 700);
  const peekFrame = document.createElement('div');
  peekFrame.id = 'peek';
  peekFrame.style.cssText =
    'position:fixed;z-index:14;pointer-events:none;display:none;border:5px solid #fff;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,0.45);box-sizing:border-box';
  peekFrame.innerHTML =
    '<svg viewBox="0 0 64 40" style="position:absolute;left:-14px;top:-14px;width:44px;height:28px;background:#1b2433;border-radius:14px;border:3px solid #fff;padding:2px"><ellipse cx="32" cy="20" rx="26" ry="14" fill="#fff"/><circle cx="32" cy="20" r="8" fill="#1b2433"/></svg>';
  document.body.appendChild(peekFrame);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(60);
  // 기기 설정(동작 줄이기) 또는 게임 설정 「움직임 줄이기」
  const reduceMotion = (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) || loadSettings(browserStorage()).noShake;
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

  let state: Ch1State = createChapter1(PLAYERS);
  // 손 신호(망보는 요정 머리 위 초록 손)·들킴 표시(창 위 빨간 느낌표)
  const signTex = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const handTex = signTex((g) => {
    g.fillStyle = '#2f9a4a';
    g.strokeStyle = '#fff';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    // 손바닥 + 손가락 넷 + 엄지
    g.beginPath();
    g.roundRect(42, 58, 44, 40, 12);
    g.fill();
    for (const [x, h] of [[44, 30], [55, 38], [66, 36], [77, 28]] as const) {
      g.beginPath();
      g.roundRect(x, 64 - h, 9, h + 6, 4.5);
      g.fill();
    }
    g.beginPath();
    g.roundRect(30, 66, 18, 9, 4.5);
    g.fill();
  });
  const hands = PLAYERS.map(() => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: handTex, depthTest: false }));
    sp.scale.setScalar(1.1);
    sp.renderOrder = 30;
    sp.visible = false;
    return sp;
  });
  const bangTex = signTex((g) => {
    g.fillStyle = '#e0342f';
    g.strokeStyle = '#fff';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.fillRect(56, 24, 16, 52);
    g.beginPath();
    g.arc(64, 94, 9, 0, Math.PI * 2);
    g.fill();
  });
  const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false }));
  bang.scale.setScalar(1.6);
  bang.renderOrder = 30;
  bang.visible = false;
  let caughtAt = -9;
  /** 끝 장면 시각(초). -1이면 아직 */
  let ending = -1;
  const endCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 700);
  // 유나의 새 스케치북(펼친 두 쪽): 오른쪽 쪽에 고래가 꼬리까지 그려진다
  const bookCanvas = document.createElement('canvas');
  bookCanvas.width = 512;
  bookCanvas.height = 256;
  const bookTex = new THREE.CanvasTexture(bookCanvas);
  bookTex.colorSpace = THREE.SRGBColorSpace;
  const book = new THREE.Group();
  const pages = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: bookTex, side: THREE.DoubleSide }));
  book.add(pages);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.9, 0.03), new THREE.MeshStandardMaterial({ color: '#d23a3a' }));
  cover.position.z = -0.03;
  book.add(cover);
  book.visible = false;
  let drawn = -1;
  const drawBook = (p: number) => {
    const g = bookCanvas.getContext('2d');
    if (!g || Math.abs(p - drawn) < 0.01) return;
    drawn = p;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#e8e8e8';
    g.fillRect(254, 0, 4, 256);
    g.fillStyle = '#888';
    for (let i = 0; i < 9; i++) g.fillRect(252, 14 + i * 27, 8, 8);
    drawWhale(g, 372, 150, 1.0, p, '#1f57c0', true, 9);
    bookTex.needsUpdate = true;
  };
  let caughtWho = -1;
  const events: Ch1Event[] = [];
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
  const maps = createMapView(document, PLAYERS.length);

  // 처음 들어온 1장이면 지우 카드 그림책 먼저(시계는 그림책이 끝난 뒤 흐른다). 시험 모드는 &story일 때만
  const hadSave = new CheckpointStore(browserStorage()).load(sto.roomId) !== null;
  const makeRun = () => new LocalRun(new CheckpointStore(browserStorage()), hud, sto.roomId, 'p0', sto.story ? undefined : chapter1Checkpoint(sto.roomId));
  const run: TeamRun = net ? net.bindRun(hud, makeRun) : makeRun();
  run.attachVisibility(document);
  run.onEffect((e) => {
    if (e.type === 'retry') state = createChapter1(PLAYERS, run.state.seed);
  });
  // 이야기 모드는 이 시도에서 1장에 처음 들어올 때만(시험은 &intro일 때만)
  const wantStory = sto.story ? !sto.introSeen(run.state.runId, 1) && (!params.has('test') || params.has('intro')) : !hadSave && (!params.has('test') || params.has('story'));
  let story: Storybook | null = wantStory ? createStorybook(document) : null;
  if (story) sto.markIntro(run.state.runId, 1);
  const begin = () => {
    run.dispatch({ type: 'start', at: performance.now() });
    if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
  };
  if (!story) begin();
  state = createChapter1(PLAYERS, run.state.seed);
  // 여러 기기: 끊긴 요정은 멈추고 선물을 그 자리에 놓는다 / 참가자는 방장 사건으로 소리·연출을 시작한다
  // 플레이 기록(장별 조작 시간·FPS·기기) + FPS 표시
  const meter = createPlayMeter({ chapterId: 1, run, players: PLAYERS.length, role: net?.role ?? 'local', quality: () => quality, showFps: (f, q) => settings.setFps(f, q) });
  net?.onPresence((id, on) => (state = on ? playerBack(state, id) : playerGone(state, id)));
  net?.onEvents((evs) => {
    for (const e of evs as Ch1Event[]) onEvent(e);
  });
  for (const h of hands) scene.add(h);
  scene.add(bang);
  space.yunaPlaceholder.parent?.add(book);

  // 요정·선물
  const elves = PLAYERS.map((_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    e.root.scale.multiplyScalar(ELF_SCALE);
    setShadows(e.root, true, false);
    scene.add(e.root);
    return e;
  });
  const rings = PLAYERS.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });
  // 물고기 자루(0장에서 나눠 담은 것): 메면 등에(자루 목을 어깨에), 내려놓으면 땅에. 꺼낸 뒤에는 납작한 빈 자루
  const sackRoot = new THREE.Group();
  const sackBody = createSack('#2f6fd0', 1);
  sackRoot.add(sackBody);
  setShadows(sackRoot, true);
  scene.add(sackRoot);
  let sackOn = -1; // 자루를 멘 요정 번호(-1 = 땅)
  const gifts = new Map(
    CH1_START.items.map((g) => {
      const v = createGift(g.kind);
      v.scale.setScalar(giftScale(g.kind, ELF_SCALE));
      v.userData.baseScale = giftScale(g.kind, ELF_SCALE);
      setShadows(v, true);
      scene.add(v);
      const span = holdSpan(v, ELF_SCALE);
      return [g.id, { v, span, outline: createOutline(v, 0.035) }] as const;
    }),
  );  gifts.set(SACK, { v: sackRoot, span: 0.5, outline: createOutline(sackBody, 0.035) });

  // 지도를 편 요정의 손에 든 종이 지도(작게 접힌 종이 + 빨간 길)
  const paperMaps = PLAYERS.map(() => {
    const g = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.36), new THREE.MeshStandardMaterial({ color: '#fffdf3', roughness: 1 }));
    sheet.position.y = 0.006;
    g.add(sheet);
    const road = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.3), new THREE.MeshBasicMaterial({ color: '#e0342f' }));
    road.position.y = 0.014;
    road.rotation.y = 0.5;
    g.add(road);
    g.rotation.x = -0.6;
    g.visible = false;
    scene.add(g);
    return g;
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
  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
  let last = performance.now();
  let acc = 0;
  let elapsed = 0;
  let foundAt = -1;
  let gateK = 0;
  const rattles = new Map<string, number>();
  applyQuality();

  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    meter.frame(raw);
    const fq = auto.feed(raw);
    if (fq) applyQuality();
    const frame = Math.min(raw, 0.25);
    if (story) {
      run.frame(now);
      if (guest) {
        net!.sendIntent(IDLE_INTENT);
        state = net!.remote<Ch1State>() ?? state;
      }
      if (story.update(frame)) {
        story.dispose();
        story = null;
        begin();
        establish = reduceMotion ? 0 : ESTABLISH.sec;
        snapCamera = true;
      }
      draw(frame);
      return;
    }
    acc += frame;
    run.frame(now);
    const live = run.canPlay;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    if (guest) {
      // 참가자: 입력만 보내고 방장 상태를 그린다
      net!.sendIntent(live ? i1 : IDLE_INTENT);
      state = net!.remote<Ch1State>() ?? state;
      // 사건을 놓쳤어도(잠깐 끊김) 방장 상태로 끝 장면을 시작한다
      if (state.complete && ending < 0) onEvent({ type: 'complete' } as Ch1Event);
      elapsed += frame;
      acc = 0;
      draw(frame);
      return;
    }
    let inputs: Record<string, SewingInput> = net
      ? net.inputs(i1, live)
      : live
        ? { p0: toSewingInput(i1), p1: toSewingInput(k2.sample()) }
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
    net?.publish(1, state);
    draw(frame);
  });

  function onEvent(e: Ch1Event): void {
    sfxEvent(e);
    events.push(e);
    if (e.type === 'pick' || e.type === 'drop') actAt.set(e.playerId, elapsed);
    if (e.type === 'found') foundAt = elapsed;
    if (e.type === 'gateLocked') rattles.set(e.gateId, elapsed);
    if (e.type === 'gateOpened' || e.type === 'gateLocked') {
      const i = PLAYERS.indexOf(e.playerId);
      elves[i]?.act?.('Interact', { once: true });
    }
    if (e.type === 'complete' && ending < 0) {
      run.dispatch({ type: 'completeChapter', at: performance.now(), chapterId: 1 });
      ending = 0;
    }
    if (e.type === 'caught') {
      caughtAt = elapsed;
      const i = PLAYERS.indexOf(e.playerId);
      caughtWho = i;
      elves[i]?.act?.('HitRecieve', { once: true });
      shown.delete(e.playerId); // 마지막 엄폐물 뒤로 바로
    }
  }

  function draw(frame: number): void {
    const kf = 1 - Math.exp(-frame * 22);
    let mine: Ch1Action = { kind: 'none' };
    state.players.forEach((p, i) => {
      const e = elves[i]!;
      const ps = follow(p.id, p.x, p.z, p.facing, kf);
      e.root.position.set(ps.x, 0, ps.z);
      e.root.rotation.y = ps.yaw;
      const held = state.items.find((it) => it.carriedBy === p.id);
      const since = elapsed - (actAt.get(p.id) ?? -9);
      e.animate(elapsed, p.moving, {
        carry: (held && held.id !== SACK) || p.mapOpen ? 'light' : 'none',
        act: since >= 0 && since < 0.35 ? since / 0.35 : 0,
        tired: false,
        span: held && held.id !== SACK ? gifts.get(held.id)!.span : p.mapOpen ? 0.42 / ELF_SCALE : undefined,
      });
      e.root.updateMatrixWorld(true);
      // 지도: 편 요정 손 위 종이 + 화면 아래 모서리 그림
      const pm = paperMaps[i]!;
      pm.visible = p.mapOpen;
      if (p.mapOpen) {
        placeOnHands(pm, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
        pm.rotateX(-0.6);
      }
      maps.set(i, p.mapOpen && (!net || p.id === ME), ELF_LOOKS[i]!.hat); // 여러 기기: 내 지도만 내 화면에
      // 손 신호: 망보는 요정이 손을 흔들어 든다 + 머리 위 초록 손
      const hs = hands[i]!;
      hs.visible = p.handUp;
      hs.position.set(ps.x, 2.25 * ELF_SCALE + Math.sin(elapsed * 6) * 0.05, ps.z);
      if (p.handUp) e.act?.('Wave');
      else if (elapsed - caughtAt > 0.7 || i !== caughtWho) e.act?.(null);
      const a = run.canPlay ? planAction(state, p.id) : ({ kind: 'none' } as const);
      if (p.id === ME) mine = a;
      const ring = rings[i]!;
      const tgt = a.kind === 'pick' ? state.items.find((q) => q.id === a.itemId)! : null;
      ring.visible = tgt !== null;
      if (tgt) ring.position.set(tgt.x, 0.03 + i * 0.005, tgt.z);
      ring.scale.setScalar(0.8 + Math.sin(elapsed * 6) * 0.05);
    });
    for (const it of state.items) {
      const g = gifts.get(it.id)!;
      const idx = it.carriedBy ? state.players.findIndex((q) => q.id === it.carriedBy) : -1;
      if (it.id === SACK) {
        // 자루: 멘 요정이 바뀌면 그 요정 등으로(내려놓으면 땅으로). 꺼낸 뒤에는 납작한 빈 자루
        if (idx !== sackOn) {
          if (sackOn >= 0) elves[sackOn]!.backpack?.(null);
          if (idx >= 0 && elves[idx]!.backpack?.(sackRoot) !== false) sackOn = idx;
          else {
            sackOn = -1;
            scene.add(sackRoot);
            sackRoot.quaternion.identity();
            sackRoot.scale.setScalar(1);
          }
        }
        if (sackOn < 0) placeOnGround(sackRoot, it.x, it.z);
        sackBody.scale.set(state.packed ? 1 : 1.1, state.packed ? 1 : 0.5, state.packed ? 1 : 1.1);
        continue;
      }
      g.v.visible = !state.packed; // 자루 속 선물은 꺼내기 전까지 보이지 않는다
      if (idx >= 0) {
        const e = elves[idx]!;
        const ps = shown.get(state.players[idx]!.id)!;
        placeOnHands(g.v, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
      } else placeOnGround(g.v, it.x, it.z);
      holdTween.apply(it.id, g.v, idx >= 0, elapsed);
    }
    controls.update(iconOf(mine));
    space.update(elapsed);
    // 유나네 대문: 열리면 0.7초에 걸쳐 안쪽으로 활짝. 가짜 집 대문은 덜컹
    gateK = state.gateOpen ? Math.min(1, gateK + frame / 0.7) : 0;
    space.setGateOpen(gateK * gateK * (3 - 2 * gateK));
    for (const [id, at0] of rattles) {
      const rk = (elapsed - at0) / 0.5;
      space.rattleGate(id, Math.min(1, rk));
      if (rk >= 1) rattles.delete(id);
    }
    const gz = gazeAt(state.time, state.seed);
    if (ending < 0) space.setGaze(gz.phase, gz.k, elapsed);
    else if (updateEnding(frame)) return;
    // 들킴: 창 위 빨간 느낌표
    const bk = elapsed - caughtAt;
    bang.visible = bk >= 0 && bk < 1.3;
    if (bang.visible) bang.position.copy(space.windowCenter).add(new THREE.Vector3(0, 2.0 + Math.sin(bk * 12) * 0.08, 0));
    // 찾았을 때: 유나네 창가가 따뜻하게 한 번 숨쉰다
    if (foundAt >= 0) {
      const k = Math.max(0, 1 - (elapsed - foundAt) / 1.6);
      space.yunaPlaceholder.scale.setScalar(1 + 0.08 * Math.sin(k * Math.PI * 3) * k);
    }

    // 카메라: 처음엔 아치~유나네 한 화면 → 두 요정을 함께, 골목 끝(유나네) 쪽을 조금 앞세운다
    establish = Math.max(0, establish - frame);
    let want = { x: ESTABLISH.x, z: ESTABLISH.z, viewH: ESTABLISH.viewH };
    if (establish === 0) {
      want = frameFor(state.players.filter((p) => p.connected), goalOf(), aspect, CAMERA_YAW, CAMERA_PITCH);
      const held = deadZone(camTarget, want);
      // 사람 크기 집 사이 골목: 광장보다 조금 넓게 보여 둘레(우편함·화분)가 함께 들어오게
      want = { ...want, x: held.x, z: held.z, viewH: want.viewH * VIEW_K };
    }
    const safe = touchDevice ? (0.1 * viewH) / Math.sin(CAMERA_PITCH) / Math.SQRT2 : 0;
    const tx = Math.max(CH1_BOUNDS.minX, Math.min(CH1_BOUNDS.maxX, want.x + safe));
    const tz = Math.max(CH1_BOUNDS.minZ, Math.min(CH1_BOUNDS.maxZ, want.z + safe));
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
    for (const g of gifts.values()) g.outline.set(null);
    state.players.forEach((p, i) => {
      if (!run.canPlay || !p.connected) return;
      const a = planAction(state, p.id);
      if (a.kind === 'pick') {
        const o = gifts.get(a.itemId)!.outline;
        if (!o.group.visible) o.set(ELF_LOOKS[i]!.hat);
      }
    });
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
    // 망보는 자리에 선 요정이 있으면: 그 자리에서 창을 들여다본 작은 화면(화면 위쪽 가운데)
    const lookIdx = state.players.findIndex((p) => p.connected && lookoutAt(p));
    if (lookIdx >= 0) {
      const p = state.players[lookIdx]!;
      const W0 = host.clientWidth, H0 = host.clientHeight;
      const w = Math.round(Math.min(W0 * 0.34, 360));
      const h = Math.round(w * 0.72);
      const x = W0 - w - 14;
      const top = 76;
      const spot = lookoutAt(p)!;
      const eye = W(spot.peek.s, spot.peek.t);
      peekCam.aspect = w / h;
      peekCam.position.set(eye.x, spot.peek.y, eye.z);
      peekCam.lookAt(space.windowCenter);
      peekCam.updateProjectionMatrix();
      renderer.setScissorTest(true);
      renderer.setScissor(x, H0 - top - h, w, h);
      renderer.setViewport(x, H0 - top - h, w, h);
      renderer.render(scene, peekCam);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W0, H0);
      peekFrame.style.display = 'block';
      Object.assign(peekFrame.style, { left: `${x}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, borderColor: ELF_LOOKS[lookIdx]!.hat });
    } else peekFrame.style.display = 'none';
  }

  /**
   * 끝 장면(약 9초): 성에가 걷히고 사진기가 창가로 → 현관 선물이 사라진다(유나가 들여감) → 유나가 창가로 돌아와
   * 새 스케치북에 다 그린 고래(꼬리까지)를 펼쳐 보이고 → 번쩍 들어 올린다(그리는 과정은 보여 주지 않는다: 2026-11-28 사용자).
   * 그리면 true(이번 프레임은 끝 장면으로 그렸다)
   */
  function updateEnding(frame: number): boolean {
    ending += frame;
    if (ending > 9) sto.next(); // 이야기 모드: 끝 장면 뒤 2장으로
    const t = ending;
    const sg = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
    const ez = (x: number) => x * x * (3 - 2 * x);
    // 성에 걷힘
    const frost = space.frost as THREE.Mesh;
    (frost.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - sg(0, 1.2));
    // 현관 선물: 사라진다(들여감)
    const take = sg(0.8, 1.6);
    for (const [id, g] of gifts) if (id !== SACK) g.v.scale.setScalar(Math.max(0.001, (1 - take) * (g.v.userData.baseScale as number)));
    peekFrame.style.display = 'none';
    for (const h of hands) h.visible = false;
    fader.update([], frame); // 놀이 중 흐려 둔 담·집을 되돌린다(끝 장면 화면 옆에 반투명 유령이 남지 않게)
    document.body.classList.add('cutscene');
    // 유나: 창가로 돌아와 앉는다 → 그린다 → 든다
    space.setGaze(t < 1.6 ? 'away' : t < 2.4 ? 'turn' : 'look', t < 1.6 ? 0 : sg(1.6, 2.4), t);
    book.visible = t > 2.0;
    drawBook(1); // 다 그린 고래
    // 책상에 눕혀 둔 스케치북을 세워 가슴 앞에 펼쳐 보인다(얼굴을 가리지 않게 턱 아래까지만: 웃는 얼굴 + 다 그린 고래)
    const lift = ez(sg(3.6, 4.4));
    const base = space.yunaPlaceholder.position;
    book.position.set(0, base.y + 0.28 + lift * 0.06, 1.5 * 0.75 + 0.05);
    book.rotation.set(-1.0 * (1 - lift), 0, 0);
    book.scale.setScalar(0.55 + 0.25 * ez(sg(2.0, 2.6)) + 0.06 * lift);
    if (lift > 0) space.yunaPlaceholder.position.y = base.y + Math.abs(Math.sin(t * 7)) * 0.12 * lift;
    // 사진기: 지금 화면에서 창 앞으로
    const k = ez(sg(0, 1.4));
    const wc = space.windowCenter;
    const front = W(toLane(wc).s - 7.5, toLane(wc).t + 0.6);
    const from = camera.position;
    endCam.position.set(from.x + (front.x - from.x) * k, from.y + (3.4 - from.y) * k, from.z + (front.z - from.z) * k);
    endCam.lookAt(wc.x, wc.y - 0.3 * k, wc.z);
    endCam.aspect = aspect;
    endCam.updateProjectionMatrix();
    renderer.render(scene, endCam);
    return true;
  }

  /** 앞세워 보여 줄 곳: 골목 끝 유나네 담(아직 못 찾았으면), 찾았으면 앞마당 */
  function goalOf(): Pt | null {
    // 찾기 전에는 사진기가 유나네 쪽을 앞세우지 않는다(어느 집인지 화면이 알려 주면 안 된다)
    if (state.found) return W((YARD.front + YARD.back) / 2, 0);
    return null;
  }

  if (import.meta.env.DEV || params.has('test') || isAdmin()) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      ch1: () => JSON.parse(JSON.stringify(state)) as Ch1State,
      story: () => (story ? story.t : null),
      skipStory: () => story?.skip(),
      ending: () => ending,
      seekEnding: (t: number) => {
        if (ending >= 0) ending = t;
      },
      /** 시험(여러 기기 이어 붙이기): 방장이 이 장을 바로 마친 것으로(사건을 참가자에게도 보낸다) */
      debugWin: () => {
        const e = { type: 'complete' } as Ch1Event;
        state = { ...state, complete: true };
        onEvent(e);
        net?.emit([e]);
      },
      gaze: () => gazeAt(state.time, state.seed),
      peek: () => peekFrame.style.display === 'block',
      peekInfo: () => ({ window: space.windowCenter.toArray(), lane: toLane({ x: space.windowCenter.x, z: space.windowCenter.z }), cam: peekCam.position.toArray() }),
      setTime: (t: number) => {
        state = { ...state, time: t };
      },
      ch1Events: () => events.map((e) => ({ ...e })),
      run: () => ({ ...run.state }),
      playLog: () => meter.current(),
      maps: () => PLAYERS.map((_, i) => maps.isOpen(i)),
      lane: (x: number, z: number) => toLane({ x, z }),
      world: (s: number, t: number) => W(s, t),
      debugPlace: (id: string, s: number, t: number, facing = 0) => {
        const p = W(s, t);
        state = { ...state, players: state.players.map((q) => (q.id === id ? { ...q, x: p.x, z: p.z, facing } : q)) };
        snapCamera = true;
        establish = 0;
      },
      toScreen: (x: number, z: number, y = 0) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        return { x: ((v.x + 1) / 2) * host.clientWidth, y: ((1 - v.y) / 2) * host.clientHeight };
      },
      camera: () => ({ target: { x: camTarget.x, z: camTarget.z }, viewH, aspect }),
    };
  }
}
