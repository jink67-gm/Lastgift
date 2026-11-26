// 설정(오른쪽 위 톱니): 그래픽 품질(자동·낮음·보통) · 눈발(보통·줄이기) · FPS 표시(끔·켬). 개인 설정이라 이 기기에만 저장한다.
// 글자는 기능 이름의 짧은 한국어만(이야기 대사는 없다). 버튼은 터치로 누르기 쉬운 크기.
import type { QualitySetting } from '../core/quality';
import type { Settings } from '../save/store';

const CSS = `
#settings-btn { position: fixed; z-index: 26; top: calc(env(safe-area-inset-top) + 10px); right: calc(env(safe-area-inset-right) + 12px);
  width: 52px; height: 52px; border-radius: 16px; border: 3px solid #fff; background: rgba(27,36,51,0.78); cursor: pointer;
  display: grid; place-items: center; padding: 0; }
#settings-btn svg { width: 30px; height: 30px; }
#settings-btn:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
#fps-chip { position: fixed; z-index: 25; top: calc(env(safe-area-inset-top) + 70px); right: calc(env(safe-area-inset-right) + 12px);
  padding: 5px 10px; border-radius: 10px; background: rgba(27,36,51,0.78); color: #fff; display: none;
  font: 700 15px/1.2 ui-monospace, Menlo, Consolas, monospace; text-align: right; pointer-events: none; }
#fps-chip.on { display: block; }
#settings-panel { position: fixed; z-index: 40; inset: 0; display: none; place-items: center; background: rgba(27,36,51,0.45); }
#settings-panel.on { display: grid; }
#settings-panel .box { min-width: min(92vw, 420px); padding: 18px 20px 20px; border-radius: 22px; background: #fffdf6; color: #1b2433;
  border: 4px solid #1b2433; font: 700 18px/1.2 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  display: grid; gap: 14px; }
#settings-panel .row { display: grid; gap: 8px; }
#settings-panel .seg { display: flex; gap: 8px; }
#settings-panel .seg button { flex: 1; min-height: 52px; border-radius: 14px; border: 3px solid #1b2433; background: #fff;
  color: #1b2433; font: inherit; cursor: pointer; }
#settings-panel .seg button[aria-pressed="true"] { background: #2f6fd0; border-color: #2f6fd0; color: #fff; }
#settings-panel .seg button:focus-visible, #settings-panel .close:focus-visible { outline: 4px solid #ffd84a; outline-offset: 2px; }
#settings-panel .close { justify-self: center; min-width: 140px; min-height: 52px; border-radius: 26px; border: 3px solid #1b2433;
  background: #2f9a4a; color: #fff; font: inherit; cursor: pointer; }
#settings-panel .note { font-weight: 500; font-size: 14px; color: #5a6478; }
`;

const GEAR = `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#fff" d="M13.6 2h4.8l.7 3.6 2.4 1 3-2.1 3.4 3.4-2.1 3 1 2.4 3.6.7v4.8l-3.6.7-1 2.4 2.1 3-3.4 3.4-3-2.1-2.4 1-.7 3.6h-4.8l-.7-3.6-2.4-1-3 2.1-3.4-3.4 2.1-3-1-2.4L2 18.4v-4.8l3.6-.7 1-2.4-2.1-3 3.4-3.4 3 2.1 2.4-1z"/><circle cx="16" cy="16" r="5" fill="#1b2433"/></svg>`;

export interface SettingsUi {
  /** 지금 설정 */
  readonly value: Settings;
  /** 설정이 바뀌면(저장은 호출 쪽에서) */
  onChange(fn: (s: Settings) => void): void;
  /** FPS 표시 갱신(켜져 있을 때만 보인다). note: 지금 품질 */
  setFps(fps: number, note: string): void;
}

export function createSettingsUi(doc: Document, initial: Settings): SettingsUi {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  let value = { ...initial };
  const listeners: ((s: Settings) => void)[] = [];

  const btn = doc.createElement('button');
  btn.id = 'settings-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', '설정');
  btn.innerHTML = GEAR;
  doc.body.appendChild(btn);

  const fps = doc.createElement('div');
  fps.id = 'fps-chip';
  doc.body.appendChild(fps);

  const panel = doc.createElement('div');
  panel.id = 'settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '설정');
  panel.innerHTML = `<div class="box">
    <div class="row"><span>그래픽</span><div class="seg" data-k="quality">
      <button type="button" data-v="auto">자동</button><button type="button" data-v="low">낮음</button><button type="button" data-v="normal">보통</button></div>
      <span class="note">자동: 느린 기기면 낮음으로 바꿔요</span></div>
    <div class="row"><span>눈발</span><div class="seg" data-k="reducedSnow">
      <button type="button" data-v="false">보통</button><button type="button" data-v="true">줄이기</button></div></div>
    <div class="row"><span>FPS 표시</span><div class="seg" data-k="showFps">
      <button type="button" data-v="false">끔</button><button type="button" data-v="true">켬</button></div></div>
    <button type="button" class="close">닫기</button>
  </div>`;
  doc.body.appendChild(panel);

  const sync = () => {
    panel.querySelectorAll<HTMLElement>('.seg').forEach((seg) => {
      const k = seg.dataset.k as 'quality' | 'reducedSnow' | 'showFps';
      seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-pressed', String(String(value[k]) === b.dataset.v)));
    });
    fps.classList.toggle('on', value.showFps);
  };
  sync();
  const open = (on: boolean) => {
    panel.classList.toggle('on', on);
    if (on) panel.querySelector<HTMLButtonElement>('.seg button[aria-pressed="true"]')?.focus();
    else btn.focus();
  };
  btn.addEventListener('click', () => open(true));
  panel.querySelector('.close')!.addEventListener('click', () => open(false));
  panel.addEventListener('click', (e) => e.target === panel && open(false));
  panel.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Escape' && open(false));
  // 패널이 열려 있을 때 게임 키(E·Enter·방향키)가 요정에게 가지 않게
  panel.addEventListener('keydown', (e) => e.stopPropagation());
  panel.querySelectorAll<HTMLElement>('.seg').forEach((seg) =>
    seg.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      const k = seg.dataset.k!;
      const v = b.dataset.v!;
      value = { ...value, [k]: k === 'quality' ? (v as QualitySetting) : v === 'true' };
      sync();
      for (const fn of listeners) fn(value);
    }),
  );

  return {
    get value() {
      return value;
    },
    onChange(fn) {
      listeners.push(fn);
    },
    setFps(v, note) {
      if (value.showFps) fps.textContent = `FPS ${Math.round(v)} · ${note}`;
    },
  };
}
