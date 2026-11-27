// 5장 · 빈 양말 하나 / 6장 · 마지막 배달 — 처음의 광장(명세서 §4 5·6장, §5 5·6장).
//   ?chapter=5  광장 복귀 → 산타와 단체사진(프롤로그와 같은 구도, 시계 정지) → 빈 양말 들여다보기(둘 다) → 배달 가방 열기
//               → 네 빛 → 스노글로브(5장 완료) → 6장: 스노글로브를 든 요정이 산타 앞에서 E로 직접 건넨다
//   ?chapter=6  6장부터(스노글로브는 안전 지점에, 가까이에서 E로 든다)
//   한 기기에서 둘이(1P WASD+E·터치, 2P 방향키+Enter). 6장 끝(스노글로브 속 네 기억·뼈다귀)은 06b.
import * as THREE from 'three';
import { addHaze, createBackdrop } from '../scene/backdrop';
import { baseViewH, deadZone, frameFor, type Pt } from '../core/framing';
import { createFinale, planAction, step, stockingChecked, CAMERA_YAW, type FinaleAction, type FinaleEvent, type FinaleState } from '../core/finale';
import { CH5_LIGHTS, CH5_PHOTO, CH6_END, ch5BlinkOn, endingBeat, lightsBeat } from '../core/finaleScenes';
import { photoLineup, seg, type PhotoSetup } from '../core/prologue';
import { AutoQuality, effectiveQuality, snowCount, type Quality } from '../core/quality';
import type { SewingInput } from '../core/sewing';
import { chapter, type ChapterId, type MemoryId } from '../data/chapters';
import { BAG, FINALE_BOUNDS, SANTA_SPOT, STOCKING } from '../data/finale';
import { SLEIGH } from '../data/plaza';
import { ELF_LOOKS } from '../data/elves';
import { attachKeyboard, KeyState, KEYMAP_P1, KEYMAP_P2 } from '../input/keyboard';
import { mergeIntents } from '../input/merge';
import { browserStorage, CheckpointStore, loadSettings, saveSettings } from '../save/store';
import { createKongi, createSanta } from '../scene/characters';
import { tripodCamera } from '../scene/chapter4';
import { createElfAvatar } from '../scene/elfAvatar';
import { createBag, createGiftLight, createSnowglobe, createStocking, drawYunaGlimpse, type GiftLightKind } from '../scene/finale';
import { createTargetRing } from '../scene/gifts';
import { placeOnHands } from '../scene/hold';
import type { Models } from '../scene/models';
import { createOcclusionFader } from '../scene/occlusionFade';
import { createPlaza } from '../scene/plaza';
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
import { createOffscreenMarks } from '../ui/offscreen';
import { createPrologueUi, type PrologueUi } from '../ui/prologueUi';
import { createMemoryView, type MemoryView } from '../ui/memories';
import { createSettingsUi } from '../ui/settings';
import { toSewingInput } from './chapter2';
import { storyFor, type StoryOptions } from './story';

const testParams = new URLSearchParams(location.search);
const CAMERA_PITCH = (testParams.has('test') && testParams.get('pitch') ? Number(testParams.get('pitch')) : 30) * (Math.PI / 180);
const ELF_SCALE = 1.2;
const SIM_DT = 1 / 60;
const LIGHT_KINDS: GiftLightKind[] = ['sketchbook', 'sewing', 'ball', 'tree'];

export function finaleCheckpoint(roomId: string, chapterId: 5 | 6) {
  return (runId: string, seed: number) => ({
    schemaVersion: 1,
    runId,
    roomId,
    chapterId,
    savedRemainingMs: chapter(chapterId).floorMs,
    completedChapters: (chapterId === 5 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5]) as ChapterId[],
    memories: [1, 2, 3, 4] as MemoryId[],
    timeAssistMs: 0,
    retryCount: 0,
    seed,
  });
}

function iconOf(a: FinaleAction): ActionIcon {
  return a.kind === 'peek' ? 'peek' : a.kind === 'openBag' ? 'bag' : a.kind === 'take' ? 'pick' : a.kind === 'deliver' ? 'give' : a.kind === 'notYet' ? 'blocked' : 'none';
}

export function startFinale(models: Models, startChapter: 5 | 6, opts?: StoryOptions): void {
  const sto = storyFor(opts, startChapter === 5 ? 'dev-ch5' : 'dev-ch6');
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
  const plaza = createPlaza(models, low ? 'low' : 'normal');
  setShadows(plaza, true);
  scene.add(plaza);
  // 광장 너머: 1·3·4장과 같은 산·숲·하늘(광장과 둘레 집, 사진기 쪽 남동은 비운다)
  scene.add(createBackdrop(models, { center: { x: 0, z: 0 }, forest: [16, 95], trees: 420, keepOut: (p) => Math.hypot(p.x, p.z) < 32 || (p.x + p.z > 10 && Math.hypot(p.x, p.z) < 70) }));
  addHaze(scene);
  // 기본 도형 산타는 숨기고 에셋 산타를 쓴다. 썰매는 도토가 고쳐 바로 서 있다
  const plainSanta = plaza.getObjectByName('santa');
  if (plainSanta) plainSanta.visible = false;
  // 도토가 고친 썰매: 눈에 처박힌 각도를 풀고 바로 세운다
  plaza.getObjectByName('sleigh')?.traverse((o) => {
    if (Math.abs(o.rotation.z - 0.28) < 1e-3) {
      o.rotation.z = 0;
      o.position.y = 0;
    }
  });

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 700);
  const camOffset = new THREE.Vector3(Math.sin(CAMERA_YAW) * Math.cos(CAMERA_PITCH), Math.sin(CAMERA_PITCH), Math.cos(CAMERA_YAW) * Math.cos(CAMERA_PITCH)).multiplyScalar(60);
  const cine = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 700);
  const camTarget = new THREE.Vector3(1.5, 0, -3);
  let viewH = 0;
  let aspect = 1;
  let snapCamera = true;
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

  const roomId = sto.roomId;
  const store = new CheckpointStore(browserStorage());
  const hadSave = store.load(roomId) !== null;
  const makeRun = () => new LocalRun(store, hud, roomId, 'p0', sto.story ? undefined : finaleCheckpoint(roomId, startChapter));
  const run: TeamRun = net ? net.bindRun(hud, makeRun) : makeRun();
  run.attachVisibility(document);
  const begin = () => {
    run.dispatch({ type: 'start', at: performance.now() });
    if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
  };
  /** 참가자 이벤트 머리표(누가 했는지) */
  const metaFor = (playerId: string) => ({ ...run.meta(), playerId });

  // ── 인물·소품 ──
  const photo: PhotoSetup = run.state.photo ?? photoLineup(PLAYERS.map((_, i) => i));
  const elves = PLAYERS.map((_, i) => {
    const e = createElfAvatar(models, ELF_LOOKS[i]!);
    e.root.scale.multiplyScalar(ELF_SCALE);
    setShadows(e.root, true, false);
    scene.add(e.root);
    return e;
  });
  const santa = createSanta(models);
  setShadows(santa.root, true, false);
  santa.root.userData.fadeable = true;
  scene.add(santa.root);
  const kongi = createKongi(models);
  kongi.root.visible = false;
  scene.add(kongi.root);
  const tripod = tripodCamera();
  tripod.scale.setScalar(0.62); // 요정 눈높이 삼각대(사진기 렌즈 = 사진 구도 높이)
  tripod.position.set(photo.camera.x, 0, photo.camera.z + 0.25);
  tripod.rotation.y = Math.PI;
  scene.add(tripod);
  const stocking = createStocking();
  stocking.group.position.set(STOCKING.x, 0, STOCKING.z);
  stocking.group.rotation.set(-0.12, 0.2, 0);
  setShadows(stocking.group, true);
  scene.add(stocking.group);
  const bag = createBag();
  bag.group.position.set(BAG.x, 0, BAG.z);
  bag.group.rotation.y = 0.5;
  setShadows(bag.group, true);
  scene.add(bag.group);
  const lights = LIGHT_KINDS.map((k) => {
    const l = createGiftLight(k);
    l.group.visible = false;
    scene.add(l.group);
    return l;
  });
  const globe = createSnowglobe();
  globe.group.visible = false;
  globe.group.scale.setScalar(ELF_SCALE * 0.95);
  scene.add(globe.group);
  // 사진 카드(요정 손에 작은 흰 카드)
  const cards = PLAYERS.map(() => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.28), new THREE.MeshStandardMaterial({ color: '#fbf8f0' }));
    c.visible = false;
    scene.add(c);
    return c;
  });
  const rings = PLAYERS.map((_, i) => {
    const r = createTargetRing();
    (r.material as THREE.MeshBasicMaterial).color.set(ELF_LOOKS[i]!.hat);
    scene.add(r);
    return r;
  });
  const fader = createOcclusionFader(scene, camera);
  const cf = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

  // ── 놀이 상태 ──
  const startSpots = photo.elves.map((e) => ({ x: e.x, z: e.z + 0.4, facing: Math.PI }));
  const playersAt = () => PLAYERS.map((id, i) => ({ id, ...(startSpots[i] ?? startSpots[0]!) }));
  let state: FinaleState = createFinale(startChapter, playersAt(), null);
  const events: FinaleEvent[] = [];
  let elapsed = 0;
  const peekAt = new Map<string, number>();
  let checkedAt = -9;
  /** 연출: 'photo' 단체사진, 'lights' 가방 열기, 'deliver' 건넨 뒤(06b), null 놀이 */
  let cut: 'photo' | 'lights' | 'deliver' | null = null;
  let cutT = 0;
  let ui: PrologueUi | null = null;
  let opener = 'p0';
  /** 가방 연출은 한 번만(참가자가 사건과 상태로 두 번 알아도) */
  let lightsShown = false;
  let shot = false;
  const photoCam = new THREE.PerspectiveCamera(photo.camera.fov, 4 / 3, 0.1, 700);
  photoCam.position.set(photo.camera.x, photo.camera.y, photo.camera.z);
  photoCam.lookAt(photo.camera.tx, photo.camera.ty, photo.camera.tz);
  const ARRIVE_FROM = [{ x: 9.5, z: 1.5 }, { x: 10.5, z: 3.0 }];
  /** 가방 연출 끝에 요정들이 선 자리(6장 시작 자리) */
  const approachEnd: { x: number; z: number }[] = [];

  const wantPhoto = startChapter === 5 && (sto.story ? !sto.introSeen(run.state.runId, 5) : !hadSave) && (!params.has('test') || params.has('intro'));
  if (wantPhoto) sto.markIntro(run.state.runId, 5);
  if (wantPhoto) {
    cut = 'photo';
    ui = createPrologueUi(document);
    ui.onSkip(() => (cutT = CH5_PHOTO.end));
  } else {
    begin();
    // 6장부터: 스노글로브는 안전 지점에(팀 시계도 holder: null)
    if (startChapter === 6) state = createFinale(6, playersAt(), null);
  }

  // 여러 기기: 끊긴 요정은 멈추고 스노글로브를 그 자리에 놓는다 / 참가자는 방장 사건으로 연출을 시작한다
  // 플레이 기록(장별 조작 시간·FPS·기기) + FPS 표시
  const meter = createPlayMeter({ chapterId: startChapter, run, players: PLAYERS.length, role: net?.role ?? 'local', quality: () => quality, showFps: (f, q) => settings.setFps(f, q) });
  net?.onPresence((id, on) => (state = on ? playerBack(state, id) : playerGone(state, id)));
  net?.onEvents((evs) => {
    for (const e of evs as FinaleEvent[]) onEvent(e);
  });

  const idle: SewingInput = { move: { x: 0, y: 0 }, actionDown: false, actionHeld: false };
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
  const ez = (x: number) => {
    const k = Math.min(1, Math.max(0, x));
    return k * k * (3 - 2 * k);
  };
  const yawTo = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.atan2(b.x - a.x, b.z - a.z);
  const lerpP = (a: { x: number; z: number }, b: { x: number; z: number }, k: number) => ({ x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k });
  const placeSanta = (p: { x: number; z: number }, yaw: number) => {
    santa.root.position.set(p.x, 0, p.z);
    santa.root.rotation.set(0, yaw, 0);
  };
  let acc = 0;
  let last = performance.now();
  applyQuality();

  requestAnimationFrame(function loop(now) {
    requestAnimationFrame(loop);
    const raw = (now - last) / 1000;
    last = now;
    meter.frame(raw);
    if (auto.feed(raw)) applyQuality();
    const frame = Math.min(raw, 0.25);
    run.frame(now);
    elapsed += frame;
    if (cut !== null) {
      if (guest) net!.sendIntent(IDLE_INTENT);
      else net?.publish(startChapter, state);
    }
    if (cut === 'photo') {
      cutT += frame;
      drawPhotoScene(frame);
      if (cutT >= CH5_PHOTO.end) {
        cut = null;
        ui?.dispose();
        ui = null;
        document.body.classList.remove('cutscene');
        for (const c of cards) c.visible = false;
        begin();
        snapCamera = true;
      }
      return;
    }
    if (cut === 'deliver') {
      cutT += frame;
      drawEnding(frame);
      return;
    }
    if (cut === 'lights') {
      cutT += frame;
      // 참가자: 방장이 이미 6장을 열었으면(방장 연출이 끝났다) 따라 끝낸다(느린 기기가 뒤처지지 않게)
      if (guest && net!.remote<FinaleState>()?.chapter === 6) cutT = Math.max(cutT, CH5_LIGHTS.end);
      drawLights(frame);
      if (cutT >= CH5_LIGHTS.end) {
        cut = null;
        document.body.classList.remove('cutscene');
        // 6장: 스노글로브는 연 요정의 손에. 건네기는 직접
        // 연출에서 산타 쪽으로 걸어간 자리 그대로 6장을 시작한다
        const pl = state.players.map((p, i) => ({ id: p.id, ...(approachEnd[i] ?? { x: p.x, z: p.z }), facing: yawTo(approachEnd[i] ?? p, SANTA_SPOT) }));
        // 끊겨 있던 요정은 그대로 빠진 채로(방장만 판정, 참가자는 방장 상태를 받는다)
        const away = state.players.filter((p) => !p.connected).map((p) => p.id);
        state = createFinale(6, pl, opener);
        for (const id of away) state = playerGone(state, id);
        if (run.state.phase === 'cutscene') run.dispatch({ type: 'cutsceneDone', at: performance.now() });
        snapCamera = true;
      }
      return;
    }
    acc += frame;
    const live = run.canPlay && cut === null;
    const i1 = mergeIntents(k1.sample(), controls.touch.sample());
    if (guest) {
      // 참가자: 입력만 보내고 방장 상태를 그린다(연출 중이 아닐 때)
      net!.sendIntent(live ? i1 : IDLE_INTENT);
      state = net!.remote<FinaleState>() ?? state;
      // 사건을 놓쳤어도(잠깐 끊김) 방장 상태로 연출을 시작한다(가방은 5장에서만, 건네기는 6장)
      const holder = run.state.snowglobe?.holder ?? state.players[0]!.id;
      if (state.chapter === 5 && state.opened) onEvent({ type: 'opened', playerId: holder } as FinaleEvent);
      else if (state.delivered) onEvent({ type: 'deliver', playerId: holder } as FinaleEvent);
      acc = 0;
      drawPlay(frame);
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
    }
    net?.publish(startChapter, state);
    drawPlay(frame);
  });

  function onEvent(e: FinaleEvent): void {
    sfxEvent(e);
    events.push(e);
    if (e.type === 'peek') {
      peekAt.set(e.playerId, elapsed);
      elves[PLAYERS.indexOf(e.playerId)]?.act?.('Interact', { once: true });
    }
    if (e.type === 'stockingChecked') checkedAt = elapsed;
    if (e.type === 'opened' && !lightsShown) {
      lightsShown = true;
      opener = e.playerId;
      run.dispatch({ type: 'openBag', at: performance.now(), ...metaFor(e.playerId) });
      cut = 'lights';
      cutT = 0;
      document.body.classList.add('cutscene');
    }
    if (e.type === 'take') run.dispatch({ type: 'takeSnowglobe', at: performance.now(), ...metaFor(e.playerId) });
    if (e.type === 'deliver' && cut !== 'deliver') {
      run.dispatch({ type: 'deliver', at: performance.now(), ...metaFor(e.playerId) });
      cut = 'deliver';
      cutT = 0;
      giver = e.playerId;
      startEnding();
      document.body.classList.add('cutscene');
    }
  }

  // ── 놀이 화면 ──
  function drawPlay(frame: number): void {
    const kf = 1 - Math.exp(-frame * 22);
    let mine: FinaleAction = { kind: 'none' };
    placeSanta(SANTA_SPOT, SANTA_SPOT.facing);
    santa.look?.(0);
    santa.animate(elapsed, false);
    const checked = stockingChecked(state);
    state.players.forEach((p, i) => {
      const e = elves[i]!;
      let yaw = p.facing;
      // 빈 양말을 둘 다 들여다본 순간: 두 요정의 눈이 마주친다
      const pair = state.peeked.slice(0, 2);
      if (elapsed - checkedAt < 1.4 && pair.length === 2 && pair.includes(p.id)) {
        const o = state.players.find((q) => q.id === pair.find((id) => id !== p.id))!;
        yaw = yawTo(p, o);
      }
      const ps = follow(p.id, p.x, p.z, yaw, kf);
      e.root.position.set(ps.x, 0, ps.z);
      e.root.rotation.y = ps.yaw;
      const holding = state.globe?.holder === p.id;
      e.animate(elapsed, p.moving, { carry: holding ? 'light' : 'none', act: 0, tired: false, span: holding ? 0.4 : undefined });
      e.root.updateMatrixWorld(true);
      if (holding) {
        globe.group.visible = true;
        placeOnHands(globe.group, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, ps, ELF_SCALE);
      }
      const a = run.canPlay ? planAction(state, p.id) : ({ kind: 'none' } as const);
      if (p.id === ME) mine = a;
      const ring = rings[i]!;
      const tgt = a.kind === 'peek' ? STOCKING : a.kind === 'openBag' ? BAG : a.kind === 'deliver' ? SANTA_SPOT : a.kind === 'take' && state.globe ? state.globe : null;
      ring.visible = !!tgt;
      if (tgt) ring.position.set(tgt.x, 0.03 + i * 0.005, tgt.z);
      ring.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.06);
    });
    // 스노글로브: 아무도 안 들었으면 안전 지점 바닥에
    if (state.globe && !state.globe.holder) {
      globe.group.visible = true;
      globe.group.position.set(state.globe.x, 0, state.globe.z);
      globe.group.rotation.set(0, 0, 0);
    } else if (!state.globe) globe.group.visible = false;
    globe.update(elapsed, 0);
    // 양말: 들여다볼 때 입구가 벌어졌다가 오므라든다
    let open = 0;
    for (const t of peekAt.values()) {
      const d = elapsed - t;
      if (d >= 0 && d < 1.8) open = Math.max(open, Math.sin(Math.min(1, d / 1.8) * Math.PI));
    }
    stocking.setOpen(open);
    bag.setOpen(0);
    void checked;
    controls.update(iconOf(mine));
    // 카메라: 두 요정과 양말·가방·산타
    const pts: Pt[] = state.players.filter((p) => p.connected).map((p) => ({ x: p.x, z: p.z }));
    let want = frameFor(pts, state.chapter === 5 ? { x: STOCKING.x - 0.6, z: STOCKING.z } : SANTA_SPOT, aspect, CAMERA_YAW, CAMERA_PITCH);
    const held = deadZone(camTarget, want);
    want = { ...want, x: held.x, z: held.z, viewH: Math.max(want.viewH, 11) };
    const k = snapCamera ? 1 : 1 - Math.exp(-frame * 3);
    const kz = snapCamera ? 1 : 1 - Math.exp(-frame * (want.viewH > viewH ? 4 : 1.2));
    snapCamera = false;
    camTarget.x += (Math.max(FINALE_BOUNDS.minX, Math.min(FINALE_BOUNDS.maxX, want.x)) - camTarget.x) * k;
    camTarget.z += (Math.max(FINALE_BOUNDS.minZ, Math.min(FINALE_BOUNDS.maxZ, want.z)) - camTarget.z) * k;
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
    const fpts: THREE.Vector3[] = [];
    for (const p of state.players) fpts.push(new THREE.Vector3(p.x, 0.5 * ELF_SCALE, p.z), new THREE.Vector3(p.x, 1.05 * ELF_SCALE, p.z));
    fader.update(fpts, frame);
    renderer.render(scene, camera);
  }

  // ── ① 단체사진 ──
  function drawPhotoScene(frame: number): void {
    const t = cutT;
    const P = CH5_PHOTO;
    for (const r of rings) r.visible = false;
    controls.update('none');
    // 요정들: 골목에서 돌아와 사진 자리로 → 고개 숙임 → 사진 카드를 받는다
    const down = ez(seg(t, P.lookDown)) * (1 - ez(seg(t, [P.shutter + 0.5, P.shutter + 1.1])));
    photo.elves.forEach((spot, i) => {
      const e = elves[i];
      if (!e) return;
      const from = ARRIVE_FROM[i % ARRIVE_FROM.length]!;
      const k = ez(seg(t, [P.arrive[0] + i * 0.25, P.arrive[1]]));
      const p = lerpP(from, spot, k);
      const moving = k > 0 && k < 1;
      const yaw = moving ? yawTo(from, spot) : t > P.handout[0] ? yawTo(spot, santa.root.position) : spot.facing;
      e.root.position.set(p.x, 0, p.z);
      e.root.rotation.set(0, yaw, 0);
      e.look?.(down);
      const got = t >= P.handout[0] + 0.9 * (i + 1);
      e.animate(elapsed, moving, { carry: got ? 'light' : 'none', act: 0, tired: false, span: 0.34 });
      e.root.updateMatrixWorld(true);
      const c = cards[i]!;
      c.visible = got;
      if (got) placeOnHands(c, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, { x: p.x, z: p.z, yaw }, ELF_SCALE);
    });
    // 산타: 썰매 옆에서 손 흔들기 → 사진기 → 타이머 → 자기 자리 → 고개 숙임 → 사진 나눠 주기 → 썰매로
    const camSide = { x: photo.camera.x - 0.9, z: photo.camera.z - 0.2 };
    const spotS = photo.santa;
    let sp = { x: SANTA_SPOT.x, z: SANTA_SPOT.z };
    let syaw = yawTo(SANTA_SPOT, photo.elves[0]!);
    let moving = false;
    santa.act?.(null);
    if (t < P.toCamera[0]) {
      if (t >= P.wave[0] && t < P.wave[1]) santa.act?.('Wave');
    } else if (t < P.setTimer[0]) {
      const k = ez(seg(t, P.toCamera));
      sp = lerpP(SANTA_SPOT, camSide, k);
      syaw = yawTo(SANTA_SPOT, camSide);
      moving = k < 1;
    } else if (t < P.back[0]) {
      sp = camSide;
      syaw = yawTo(camSide, { x: photo.camera.x, z: photo.camera.z + 1 });
    } else if (t < P.back[1]) {
      const k = ez(seg(t, P.back));
      sp = lerpP(camSide, spotS, k);
      syaw = k < 0.9 ? yawTo(camSide, spotS) : spotS.facing;
      moving = k < 1;
    } else if (t < P.handout[0]) {
      sp = spotS;
      syaw = spotS.facing;
    } else if (t < P.toSleigh[0]) {
      // 요정마다 앞에 서서 한 장씩
      const n = photo.elves.length;
      const kk = seg(t, P.handout) * n;
      const i = Math.min(n - 1, Math.floor(kk));
      const target = { x: photo.elves[i]!.x + 0.2, z: photo.elves[i]!.z - 1.1 };
      const prev = i === 0 ? spotS : { x: photo.elves[i - 1]!.x + 0.2, z: photo.elves[i - 1]!.z - 1.1 };
      const k = ez(Math.min(1, (kk - i) * 1.8));
      sp = lerpP(prev, target, k);
      syaw = k < 1 ? yawTo(prev, target) : yawTo(target, photo.elves[i]!);
      moving = k < 1;
    } else {
      const lastE = photo.elves[photo.elves.length - 1]!;
      const from = { x: lastE.x + 0.2, z: lastE.z - 1.1 };
      const k = ez(seg(t, P.toSleigh));
      sp = lerpP(from, SANTA_SPOT, k);
      syaw = k < 0.95 ? yawTo(from, SANTA_SPOT) : SANTA_SPOT.facing;
      moving = k < 1;
    }
    placeSanta(sp, syaw);
    santa.look?.(down * 0.85);
    santa.animate(elapsed, moving, { carry: 'none', act: t >= P.setTimer[0] && t < P.setTimer[1] ? 0.6 : 0, tired: false });
    // 장화 앞을 스치는 꼬리(프롤로그 사진과 같은 순간): 사진기 바로 앞을 코를 땅에 대고 휙
    const kt = seg(t, P.tail);
    kongi.root.visible = kt > 0 && kt < 1;
    if (kongi.root.visible) {
      const c = photo.camera;
      kongi.root.position.set(c.x + 2.4 - 4.8 * kt, 0, c.z - 1.25);
      kongi.root.rotation.set(0, -Math.PI / 2, 0);
      kongi.play('Gallop', { speed: 1.4 });
      kongi.wag(1);
      kongi.nose(1);
    }
    kongi.update(frame);
    // 사진기: 넓게(산타가 손 흔들고 타이머를 맞춘다) → 뷰파인더(깜박임·꼬리·찰칵) → 사진 카드 → 산타가 나눠 줌
    const inFinder = t >= P.back[0] && t < P.shutter + 0.25;
    ui?.finder(inFinder, inFinder && ch5BlinkOn(t));
    ui?.flash(t >= P.shutter ? Math.max(0, 1 - (t - P.shutter) / 0.5) : 0);
    const cardK = ez(seg(t, [P.card[0], P.card[0] + 0.5])) * (1 - ez(seg(t, [P.card[1] - 0.5, P.card[1]])));
    ui?.card(shot ? cardK : 0, 0);
    ui?.dim(0.55 * cardK);
    let cam: THREE.PerspectiveCamera = cine;
    if (inFinder) cam = photoCam;
    else {
      const c = photo.camera;
      cine.position.set(c.x + 3.6, 3.6, c.z + 4.2);
      cine.lookAt((c.tx + SANTA_SPOT.x) / 2, 1.4, (c.tz + SANTA_SPOT.z) / 2);
      cine.fov = 46;
    }
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    snow.update(frame, photo.camera.tx, photo.camera.tz, 16);
    renderer.render(scene, cam);
    // 찰칵: 지금 화면을 사진 카드에(모두 발끝을 보고 있다)
    if (!shot && t >= P.shutter) {
      shot = true;
      const src = renderer.domElement;
      ui?.setPhoto((g, w, h) => {
        const sa = src.width / src.height, da = w / h;
        const sw = sa > da ? src.height * da : src.width, sh = sa > da ? src.height : src.width / da;
        g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
      });
    }
  }

  // ── ② 가방 열기 → 네 빛 → 스노글로브 ──
  function drawLights(frame: number): void {
    const t = cutT;
    const L = CH5_LIGHTS;
    for (const r of rings) r.visible = false;
    controls.update('none');
    const oi = Math.max(0, PLAYERS.indexOf(opener));
    /** 연 요정 다음에 친구들(2~4인) */
    const order = [oi, ...PLAYERS.map((_, i) => i).filter((i) => i !== oi)];
    // 연 요정은 가방 앞, 친구는 그 옆에서 산타 쪽을 살핀다
    const openerSpot = { x: BAG.x + 0.1, z: BAG.z + 0.75 };
    const friendSpot = { x: BAG.x + 1.25, z: BAG.z + 0.6 };
    const approach = ez(seg(t, L.approach));
    const toward = (p: { x: number; z: number }, d: number) => {
      const dir = { x: SANTA_SPOT.x - p.x, z: SANTA_SPOT.z - p.z };
      const l = Math.hypot(dir.x, dir.z) || 1;
      return { x: p.x + (dir.x / l) * d, z: p.z + (dir.z / l) * d };
    };
    const handsY = 0.95 * ELF_SCALE;
    const mid = { x: (openerSpot.x + friendSpot.x) / 2, z: (openerSpot.z + friendSpot.z) / 2 };
    order.forEach((idx, rank) => {
      const e = elves[idx];
      if (!e) return;
      const role = Math.min(rank, 1);
      // 셋째·넷째 요정은 친구 옆에 한 줄로
      const base = rank === 0 ? openerSpot : { x: friendSpot.x + (rank - 1) * 0.95, z: friendSpot.z + (rank - 1) * 0.35 };
      const p = toward(base, 2.4 * approach);
      approachEnd[idx] = toward(base, 2.4);
      let yaw = role === 0 ? yawTo(base, BAG) : yawTo(base, SANTA_SPOT);
      if (t >= L.open[1]) yaw = yawTo(base, { x: mid.x, z: mid.z - 0.2 }) ;
      if (t >= L.globe[0]) yaw = role === 0 ? yawTo(base, { x: base.x, z: base.z + 1 }) : yawTo(base, openerSpot);
      if (approach > 0) yaw = yawTo(base, SANTA_SPOT);
      e.root.position.set(p.x, 0, p.z);
      e.root.rotation.set(0, yaw, 0);
      e.look?.(t < L.globe[0] ? -0.2 : 0.3);
      const carrying = (role === 0 && t >= L.globe[0]) || (rank === 1 && t >= L.stocking[0]);
      e.animate(elapsed, approach > 0 && approach < 1, { carry: carrying ? 'light' : 'none', act: role === 0 && t < L.open[1] ? 0.7 : 0, tired: false, span: role === 0 ? 0.4 : 0.5 });
      e.root.updateMatrixWorld(true);
      if (role === 0 && t >= L.globe[0]) {
        globe.group.visible = true;
        placeOnHands(globe.group, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, { x: p.x, z: p.z, yaw }, ELF_SCALE);
      }
      if (rank === 1 && t >= L.stocking[0]) {
        // 빨간 양말을 살짝 들어 보인다
        placeOnHands(stocking.group, e.carryFrame?.(cf.pos, cf.quat) ? cf : null, { x: p.x, z: p.z, yaw }, ELF_SCALE);
        stocking.group.scale.setScalar(0.55);
      }
    });
    placeSanta(SANTA_SPOT, SANTA_SPOT.facing);
    santa.animate(elapsed, false);
    bag.setOpen(ez(seg(t, L.open)));
    // 선물 모양의 빛: 가방에서 차례로 그려지며 떠올라 둥글게 섰다가 → 손 위에서 포개진다
    const spans = [L.sketchbook, L.sewing, L.ball, L.tree];
    const mouth = bag.mouth.getWorldPosition(new THREE.Vector3());
    const merge = ez(seg(t, L.merge));
    const center = new THREE.Vector3(mid.x, handsY + 0.2, mid.z);
    lights.forEach((l, i) => {
      const sp = spans[i]!;
      const k = seg(t, sp);
      l.group.visible = k > 0 && t < L.globe[1];
      if (!l.group.visible) return;
      const a = (i / 4) * Math.PI * 2 + t * 0.6 * merge;
      const ringPos = new THREE.Vector3(mid.x + Math.cos(a) * 0.95, handsY + 0.75 + (i % 2) * 0.3, mid.z + Math.sin(a) * 0.5);
      const rise = mouth.clone().lerp(ringPos, ez(k * 1.4));
      const p = rise.lerp(center, merge);
      l.group.position.copy(p);
      l.group.rotation.y = t * 0.8 + i;
      l.group.scale.setScalar(1.7 * (1 - 0.85 * merge));
      l.setDraw(ez(k * 1.6));
      l.flip(t);
      l.setGlow(1 - ez(seg(t, L.globe)));
    });
    // 스노글로브: 빛이 잦아들며 손바닥에
    if (t < L.globe[0]) globe.group.visible = false;
    const glimpse = ez(seg(t, L.glimpse)) * (1 - ez(seg(t, [L.glimpse[1], L.glimpse[1] + 0.6])));
    if (t >= L.glimpse[0] - 0.2 && t < L.glimpse[1] + 0.2) globe.setInside((g, w, h) => drawYunaGlimpse(g, w, h, ez(seg(t, L.glimpse))));
    globe.update(elapsed, glimpse);
    stocking.setOpen(0);
    if (t < L.stocking[0]) {
      stocking.group.position.set(STOCKING.x, 0, STOCKING.z);
      stocking.group.rotation.set(-0.12, 0.2, 0);
      stocking.group.scale.setScalar(1);
    }
    // 사진기: 가방 쪽 → 빛 → 손바닥 스노글로브 가까이 → 둘이 산타에게
    const beat = lightsBeat(t);
    const gpos = globe.group.getWorldPosition(new THREE.Vector3());
    if (beat === 'glimpse') {
      // 손바닥 위 스노글로브를 앞에서 가까이(요정 모자 아래)
      cine.position.set(gpos.x + 0.2, gpos.y + 0.42, gpos.z + 1.6);
      cine.lookAt(gpos.x, gpos.y + 0.3, gpos.z);
      cine.fov = 30;
    } else if (beat === 'stocking' || beat === 'approach' || beat === 'done') {
      cine.position.set(mid.x - 1.2, 2.2, mid.z + 4.6);
      cine.lookAt((mid.x + SANTA_SPOT.x) / 2, 1.0, (mid.z + SANTA_SPOT.z) / 2);
      cine.fov = 48;
    } else {
      // 요정 둘과 그 위에 떠오르는 빛이 한가운데
      cine.position.set(mid.x + 0.3, 1.5, mid.z + 3.6);
      cine.lookAt(mid.x, 1.2 + 0.6 * ez(seg(t, L.sketchbook)), mid.z - 0.2);
      cine.fov = 50;
    }
    cine.aspect = aspect;
    cine.updateProjectionMatrix();
    snow.update(frame, mid.x, mid.z, 14);
    renderer.render(scene, cine);
  }

  // ── ③ 6장 끝: 건네기 → 스노글로브 속 기억 → 썰매 앞자리 → 뼈다귀 → 장갑 ──
  let giver = 'p0';
  let memView: MemoryView | null = null;
  let halfRate = false;
  let endUi: HTMLDivElement | null = null;
  /** 썰매 앞자리(스노글로브를 내려놓는 곳): 썰매 몸통 윗면 앞쪽 */
  const SEAT = new THREE.Vector3(SLEIGH.x + 1.0, 1.98, SLEIGH.z + 0.35);
  function startEnding(): void {
    document.body.classList.add('cutscene');
    memView = createMemoryView(document, CH6_END.memories, import.meta.env.BASE_URL, { low: quality === 'low' });
    // 건너뛰기(결과는 그대로) · 끝나면 다시 보기
    endUi = document.createElement('div');
    endUi.id = 'ending-ui';
    endUi.style.cssText = 'position:fixed;right:calc(env(safe-area-inset-right) + 16px);bottom:calc(env(safe-area-inset-bottom) + 16px);z-index:36;display:flex;gap:10px';
    const btn = (id: string, label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.id = id;
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'min-height:48px;padding:0 18px;border-radius:24px;border:3px solid #fff;background:rgba(27,36,51,0.72);color:#fff;font:700 16px system-ui,sans-serif;cursor:pointer';
      b.addEventListener('click', fn);
      endUi!.appendChild(b);
      return b;
    };
    btn('ending-replay', '다시 보기 ↺', () => (cutT = CH6_END.look[0]));
    btn('ending-skip', '건너뛰기 ▶▶', () => (cutT = Math.max(cutT, CH6_END.end)));
    // 이야기 모드: 새 시도(저장 칸을 비우고 0장 프롤로그부터)
    if (sto.story && !guest)
      btn('ending-restart', '처음부터 ↺', () => {
        store.clear(roomId);
        location.reload();
      });
    document.body.appendChild(endUi);
    window.addEventListener('keydown', (e) => {
      if (cut === 'deliver' && e.key === 'Escape') cutT = Math.max(cutT, CH6_END.end);
    });
  }
  function drawEnding(frame: number): void {
    const t = cutT;
    const E = CH6_END;
    const beat = endingBeat(t);
    for (const r of rings) r.visible = false;
    controls.update('none');
    (endUi?.querySelector('#ending-replay') as HTMLElement | null)?.style.setProperty('display', t >= E.end ? 'block' : 'none');
    (endUi?.querySelector('#ending-skip') as HTMLElement | null)?.style.setProperty('display', t < E.end ? 'block' : 'none');
    (endUi?.querySelector('#ending-restart') as HTMLElement | null)?.style.setProperty('display', t >= E.end ? 'block' : 'none');
    // 요정들: 그 자리에서 산타를 본다. 장갑 요정(첫 요정)은 끝에 제 장갑을 내려다본다
    const gi = Math.max(0, PLAYERS.indexOf(giver));
    const thumbI = 0;
    state.players.forEach((p, i) => {
      const e = elves[i]!;
      e.root.position.set(p.x, 0, p.z);
      const thumbing = i === thumbI && t >= E.thumb[0];
      e.root.rotation.set(0, thumbing ? yawTo(p, { x: p.x, z: p.z + 1 }) : yawTo(p, SANTA_SPOT), 0);
      e.look?.(thumbing ? 0.75 : t >= E.place[0] && t < E.thumb[0] ? 0.1 : -0.25);
      const handing = i === gi && t < E.give[1] * 0.6;
      e.animate(elapsed, false, { carry: handing || thumbing ? 'light' : 'none', act: thumbing ? 0.35 + 0.25 * Math.sin(elapsed * 6) : 0, tired: false, span: thumbing ? 0.15 : 0.4 });
      e.root.updateMatrixWorld(true);
    });
    // 산타: 받아 들고 → 들여다본다 → 썰매 앞자리에 내려놓는다
    const toSeat = ez(seg(t, [E.place[0], E.boneReveal - 0.3]));
    // 썰매 앞자리 오른쪽(동쪽)으로 가서 내려놓는다(사진기는 왼쪽 앞에서 본다)
    const seatSide = { x: SEAT.x + 1.9, z: SEAT.z + 1.1 };
    const sp = { x: SANTA_SPOT.x + (seatSide.x - SANTA_SPOT.x) * toSeat, z: SANTA_SPOT.z + (seatSide.z - SANTA_SPOT.z) * toSeat };
    const giverP = state.players[gi]!;
    let syaw = yawTo(SANTA_SPOT, giverP);
    if (t >= E.place[0]) syaw = yawTo(sp, { x: SEAT.x, z: SEAT.z });
    placeSanta(sp, syaw);
    const holding = t >= E.give[0] + 0.6 && t < E.boneReveal;
    santa.look?.(beat === 'look' || beat.startsWith('memory') ? 0.75 : t >= E.place[0] && t < E.thumb[0] ? 0.55 : 0.2);
    santa.animate(elapsed, toSeat > 0 && toSeat < 1, { carry: holding ? 'heavy' : 'none', act: 0, tired: false });
    // 스노글로브: 요정 손 → 산타 두 손 → 썰매 앞자리
    const fwd = new THREE.Vector3(Math.sin(syaw), 0, Math.cos(syaw));
    const santaHands = new THREE.Vector3(sp.x, 2.75, sp.z).addScaledVector(fwd, 1.45);
    const e0 = elves[gi]!;
    const elfHands = e0.carryFrame?.(cf.pos, cf.quat) ? cf.pos.clone() : new THREE.Vector3(giverP.x, 1.1, giverP.z);
    const kGive = ez(seg(t, E.give));
    const gp = elfHands.clone().lerp(santaHands, kGive);
    if (t >= E.place[0]) gp.copy(santaHands).lerp(SEAT, ez(seg(t, [E.place[0], E.boneReveal - 0.2])));
    globe.group.visible = true;
    globe.group.position.copy(gp);
    globe.group.rotation.set(0, syaw, 0);
    globe.group.scale.setScalar(ELF_SCALE * 0.95);
    globe.update(elapsed, 0);
    // 손을 떼는 순간 받침 위 하얀 뼈다귀가 처음 보인다
    globe.bone.visible = t >= E.boneReveal;
    // 유리 속 기억(화면 가운데 둥근 유리)
    const first = E.memories[0]!.span[0];
    const lastM = E.memories[E.memories.length - 1]!.span[1];
    const open = ez(seg(t, [first - 0.6, first])) * (1 - ez(seg(t, [lastM, lastM + 0.9])));
    memView?.update(t, open);
    // 사진기
    const gpw = globe.group.getWorldPosition(new THREE.Vector3());
    if (beat === 'give') {
      const mid = { x: (giverP.x + SANTA_SPOT.x) / 2, z: (giverP.z + SANTA_SPOT.z) / 2 };
      cine.position.set(mid.x - 1.0, 2.2, mid.z + 5.2);
      cine.lookAt(mid.x, 1.8, mid.z);
      cine.fov = 46;
    } else if (beat === 'look' || beat.startsWith('memory') || beat === 'settle') {
      // 산타 앞 비스듬히: 두 손의 스노글로브와 그것을 내려다보는 산타 얼굴
      const k = ez(seg(t, E.look));
      const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
      const eye = gpw.clone().addScaledVector(fwd, 3.4 - 0.8 * k).addScaledVector(side, 1.3);
      cine.position.set(eye.x, gpw.y + 0.9, eye.z);
      cine.lookAt(gpw.x, gpw.y + 0.8, gpw.z);
      cine.fov = 46 - 6 * k;
    } else if (beat === 'place' || beat === 'bone') {
      // 썰매 앞자리 가까이: 손을 떼면 받침 위 뼈다귀
      const k = ez(seg(t, [E.boneReveal, E.bone[1]]));
      cine.position.set(SEAT.x - 1.3 + 0.6 * k, SEAT.y + 0.8 - 0.4 * k, SEAT.z + 2.2 - 1.0 * k);
      cine.lookAt(SEAT.x, SEAT.y + 0.2, SEAT.z);
      cine.fov = 40 - 12 * k;
    } else {
      // 요정이 제 장갑을 엄지로 쓸며 웃는다
      const p = state.players[thumbI]!;
      cine.position.set(p.x + 0.3, 0.85, p.z + 1.7);
      cine.lookAt(p.x, 0.95, p.z);
      cine.fov = 40;
    }
    cine.aspect = aspect;
    cine.updateProjectionMatrix();
    snow.update(frame, sp.x, sp.z, 14);
    // 저사양: 유리가 화면 가운데를 다 덮은 동안에는 뒤 장면을 한 화면 걸러 그린다(회상 그리기 비용을 먼저 줄인다)
    halfRate = !halfRate;
    if (quality === 'low' && open > 0.98 && halfRate) return;
    renderer.render(scene, cine);
  }

  if (import.meta.env.DEV || params.has('test')) {
    (window as unknown as Record<string, unknown>).__lastgift = {
      ending: () => ({ t: cut === 'deliver' ? cutT : -1, beat: cut === 'deliver' ? endingBeat(cutT) : null, bone: globe.bone.visible, memory: memView?.mode() ?? null }),
      finale: () => JSON.parse(JSON.stringify(state)) as FinaleState,
      finaleEvents: () => events.map((e) => ({ ...e })),
      /** 시험(여러 기기 이어 붙이기): 방장이 가방 열기·건네기 사건을 바로 낸다(참가자에게도) */
      debugWin: (type: 'opened' | 'take' | 'deliver', playerId: string) => {
        const e = { type, playerId } as FinaleEvent;
        onEvent(e);
        net?.emit([e]);
      },
      run: () => ({ ...run.state }),
      playLog: () => meter.current(),
      cut: () => ({ cut, t: cutT, beat: cut === 'lights' ? lightsBeat(cutT) : null }),
      seekCut: (t: number) => {
        if (cut) cutT = t;
      },
      debugPlace: (id: string, x: number, z: number, facing = Math.PI) => {
        state = { ...state, players: state.players.map((q) => (q.id === id ? { ...q, x, z, facing } : q)) };
        snapCamera = true;
      },
      spots: () => ({ stocking: STOCKING, bag: BAG, santa: SANTA_SPOT }),
    };
  }
}
