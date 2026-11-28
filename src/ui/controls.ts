// 터치 조작 화면(왼쪽 가상 스틱 · 오른쪽 행동 버튼)과 키보드용 행동 안내.
// 기기 이름이 아니라 실제 입력으로 터치 모드를 켠다. 터치 노트북은 키보드와 섞어 쓸 수 있다.
import { STICK_RADIUS, TouchState } from '../input/touch';
import { iconSvg, type ActionIcon } from './actionIcons';

const CSS = `
#controls { position: fixed; inset: 0; pointer-events: none; z-index: 10;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
#stick-zone { position: absolute; left: 0; top: 72px; bottom: 0; width: 50%;
  pointer-events: auto; touch-action: none; }
#stick-base, #stick-knob { position: absolute; border-radius: 50%; pointer-events: none;
  transform: translate(-50%, -50%); display: none; }
#stick-base { width: ${STICK_RADIUS * 2}px; height: ${STICK_RADIUS * 2}px;
  background: rgba(27, 36, 51, 0.18); border: 3px solid rgba(255, 255, 255, 0.75); box-sizing: border-box; }
#stick-knob { width: 56px; height: 56px; background: rgba(255, 255, 255, 0.92);
  border: 3px solid #1b2433; box-sizing: border-box; }
#action-btn { position: absolute; width: 96px; height: 96px; border-radius: 50%;
  right: calc(env(safe-area-inset-right) + 24px); bottom: calc(env(safe-area-inset-bottom) + 28px);
  background: rgba(27, 36, 51, 0.72); border: 4px solid #fff; box-sizing: border-box;
  pointer-events: auto; touch-action: none; display: none; padding: 14px; }
#crouch-btn { position: absolute; width: 72px; height: 72px; border-radius: 50%;
  right: calc(env(safe-area-inset-right) + 132px); bottom: calc(env(safe-area-inset-bottom) + 24px);
  background: rgba(27, 36, 51, 0.72); border: 4px solid #fff; box-sizing: border-box;
  pointer-events: auto; touch-action: none; display: none; padding: 10px; }
#crouch-btn.on { background: rgba(80, 170, 110, 0.9); }
#crouch-btn svg { width: 100%; height: 100%; display: block; }
body.touch-on #crouch-btn.enabled { display: block; }
#crouch-hint { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); display: none; align-items: center; gap: 8px;
  padding: 6px 12px 6px 8px; border-radius: 14px; background: rgba(27, 36, 51, 0.72); }
#crouch-hint .key { min-width: 36px; height: 36px; border-radius: 8px; background: #fff; color: #1b2433; padding: 0 6px;
  font: 700 20px/36px system-ui, sans-serif; text-align: center; box-shadow: 0 3px 0 #9aa6bb; }
#crouch-hint svg { width: 40px; height: 40px; display: block; }
#crouch-hint.show { display: flex; }
#crouch-hint.on { background: rgba(60, 140, 90, 0.85); }
body.touch-on #crouch-hint { display: none !important; }
@media (max-width: 820px) { #crouch-hint { top: 116px; } }
#action-btn.pressed { background: rgba(255, 216, 74, 0.85); transform: scale(0.94); }
#action-btn svg, #key-hint svg { width: 100%; height: 100%; display: block; }
#key-hint { position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; border-radius: 14px;
  background: rgba(27, 36, 51, 0.72); }
#key-hint .key { min-width: 36px; height: 36px; border-radius: 8px; background: #fff; color: #1b2433;
  font: 700 20px/36px system-ui, sans-serif; text-align: center; box-shadow: 0 3px 0 #9aa6bb; }
#key-hint .pic { width: 44px; height: 44px; }
#key-hint.hidden { display: none; }
/* 좁은 화면(여러 기기 4인이면 위쪽 팀 칩이 길다): 행동 안내를 팀 칩 아래로 */
@media (max-width: 820px) { #key-hint { top: 64px; } }
body.touch-on #stick-base { display: block; }
body.touch-on #action-btn { display: block; }
body.touch-on #key-hint { display: none; }
`;

export interface Controls {
  touch: TouchState;
  /** 매 프레임: 스틱 위치와 행동 그림을 갱신한다 */
  update(icon: ActionIcon): void;
  readonly touchMode: boolean;
  /** 앉기 단추를 쓰는 장(1장)에서 켠다. 켜면 터치 화면에 앉기 단추가 생긴다 */
  enableCrouch(on: boolean): void;
  /** 키보드 앉기 안내(C + 앉기 그림): show = 보이기, on = 지금 앉아 있음 */
  crouchHint(show: boolean, on: boolean): void;
}

export function createControls(doc: Document): Controls {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const root = doc.createElement('div');
  root.id = 'controls';
  root.innerHTML = `
    <div id="stick-zone"></div>
    <div id="stick-base"></div><div id="stick-knob"></div>
    <div id="action-btn" role="button" aria-label="행동"></div>
    <div id="crouch-btn" role="button" aria-label="앉기"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="20" r="9" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><path d="M20 52l6-14 12 2 6 12M26 38l4-9h8l4 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 56h48" stroke="#ffd84a" stroke-width="4" stroke-linecap="round"/></svg></div>
    <div id="crouch-hint"><div class="key">C</div><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="20" r="9" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><path d="M20 52l6-14 12 2 6 12M26 38l4-9h8l4 9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 56h48" stroke="#ffd84a" stroke-width="4" stroke-linecap="round"/></svg></div>
    <div id="key-hint" class="hidden"><div class="key">E</div><div class="pic"></div></div>`;
  doc.body.appendChild(root);

  const zone = root.querySelector<HTMLDivElement>('#stick-zone')!;
  const base = root.querySelector<HTMLDivElement>('#stick-base')!;
  const knob = root.querySelector<HTMLDivElement>('#stick-knob')!;
  const btn = root.querySelector<HTMLDivElement>('#action-btn')!;
  const crouchBtn = root.querySelector<HTMLDivElement>('#crouch-btn')!;
  const crouchHint = root.querySelector<HTMLDivElement>('#crouch-hint')!;
  const hint = root.querySelector<HTMLDivElement>('#key-hint')!;
  const hintPic = hint.querySelector<HTMLDivElement>('.pic')!;

  const touch = new TouchState();
  const win = doc.defaultView!;
  let touchMode = win.matchMedia?.('(any-pointer: coarse)').matches ?? false;
  const setTouchMode = (on: boolean) => {
    touchMode = on;
    doc.body.classList.toggle('touch-on', on);
  };
  setTouchMode(touchMode);

  // 손가락·펜이 화면에 닿으면 터치 모드를 켠다(마우스는 켜지 않는다).
  win.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse' && !touchMode) setTouchMode(true);
    },
    { capture: true },
  );

  const release = (e: PointerEvent) => touch.end(e.pointerId);

  zone.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && !touchMode) return;
    e.preventDefault();
    if (touch.stickStart(e.pointerId, e.clientX, e.clientY)) zone.setPointerCapture?.(e.pointerId);
  });
  zone.addEventListener('pointermove', (e) => touch.move(e.pointerId, e.clientX, e.clientY));
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) zone.addEventListener(t, release);

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touch.actionStart(e.pointerId);
    btn.setPointerCapture?.(e.pointerId);
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) btn.addEventListener(t, release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  crouchBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touch.crouchOn = !touch.crouchOn;
  });
  crouchBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // 화면 전환·회전·창 전환 때 붙어 있는 입력이 남지 않게 한다.
  const clear = () => touch.clear();
  win.addEventListener('blur', clear);
  win.addEventListener('resize', clear);
  win.addEventListener('orientationchange', clear);
  doc.addEventListener('visibilitychange', () => doc.visibilityState !== 'visible' && clear());
  // iOS Safari 두 손가락 확대 제스처 막기(게임 영역)
  doc.addEventListener('gesturestart', (e) => e.preventDefault());

  let lastIcon: ActionIcon | null = null;
  return {
    touch,
    get touchMode() {
      return touchMode;
    },
    crouchHint(show, on) {
      crouchHint.classList.toggle('show', show);
      crouchHint.classList.toggle('on', on);
    },
    enableCrouch(on) {
      crouchBtn.classList.toggle('enabled', on);
      if (!on) touch.crouchOn = false;
    },
    update(icon) {
      crouchBtn.classList.toggle('on', touch.crouchOn);
      const v = touch.stickView();
      const idleX = Math.max(24 + STICK_RADIUS, win.innerWidth * 0.14);
      const idleY = win.innerHeight - 28 - STICK_RADIUS - 24;
      base.style.left = `${v ? v.ox : idleX}px`;
      base.style.top = `${v ? v.oy : idleY}px`;
      knob.style.display = v ? 'block' : 'none';
      if (v) {
        knob.style.left = `${v.kx}px`;
        knob.style.top = `${v.ky}px`;
      }
      btn.classList.toggle('pressed', touch.actionHeld);
      if (icon !== lastIcon) {
        btn.innerHTML = iconSvg(icon);
        hintPic.innerHTML = iconSvg(icon);
        lastIcon = icon;
      }
      hint.classList.toggle('hidden', icon === 'none');
    },
  };
}
