// 화면 상단 HUD: 팀 시간, 일시중지·재개 카운트다운, 저장 실패 표시, 시간 초과 화면.
// 만화 대사는 띄우지 않는다. 숫자와 그림, 기능 버튼의 짧은 한국어만 쓴다.

const CSS = `
#hud { position: fixed; top: calc(env(safe-area-inset-top) + 10px); left: calc(env(safe-area-inset-left) + 12px);
  z-index: 20; display: flex; gap: 8px; align-items: center; pointer-events: none;
  font: 700 22px/1 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#hud .chip { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; border-radius: 14px;
  background: rgba(27, 36, 51, 0.72); color: #fff; }
#hud .chip svg { width: 28px; height: 28px; }
#hud .timer.low { color: #ffd84a; }
#hud .save-error { display: none; }
#hud .save-error.on { display: flex; }
#overlay { position: fixed; inset: 0; z-index: 30; display: none; place-items: center;
  background: rgba(27, 36, 51, 0.55); color: #fff; font: 800 96px/1 system-ui, sans-serif; }
#overlay.on { display: grid; }
#overlay svg { width: 120px; height: 120px; }
#overlay button { margin-top: 24px; min-width: 160px; min-height: 64px; border-radius: 32px; border: 4px solid #fff;
  background: #2f9a4a; color: #fff; font: 700 24px/1 system-ui, sans-serif; cursor: pointer; }
#overlay button:focus-visible { outline: 4px solid #ffd84a; outline-offset: 4px; }
#overlay .box { display: grid; justify-items: center; }
`;

const CLOCK = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="12" fill="#fff" stroke="#1b2433" stroke-width="2.5"/><path d="M16 10v7l5 3" fill="none" stroke="#1b2433" stroke-width="3" stroke-linecap="round"/><path d="M12 3h8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;
const SAVE_ERR = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22" rx="3" fill="#7aa2e0" stroke="#fff" stroke-width="2"/><rect x="10" y="5" width="12" height="8" fill="#fff"/><circle cx="24" cy="24" r="7" fill="#d23a3a" stroke="#fff" stroke-width="2"/><path d="M21 21l6 6M27 21l-6 6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const PAUSE = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="10" width="12" height="44" rx="3" fill="#fff"/><rect x="38" y="10" width="12" height="44" rx="3" fill="#fff"/></svg>`;
const HOURGLASS = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 6h32M16 58h32M20 6c0 16 24 18 24 26S20 42 20 58M44 6c0 16-24 18-24 26s24 10 24 26" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M24 54c4-6 12-6 16 0z" fill="#ffd84a"/></svg>`;

export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export type OverlayView =
  | { kind: 'none' }
  | { kind: 'paused' }
  | { kind: 'countdown'; secondsLeft: number }
  | { kind: 'timeout' };

export interface Hud {
  setTime(ms: number): void;
  setSaveError(on: boolean): void;
  setOverlay(v: OverlayView): void;
  /** 시간 초과 화면의 「다시 하기」 */
  onRetry(fn: () => void): void;
}

export function createHud(doc: Document): Hud {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);

  const hud = doc.createElement('div');
  hud.id = 'hud';
  hud.innerHTML = `
    <div class="chip timer" role="timer" aria-label="남은 팀 시간">${CLOCK}<span class="t">30:00</span></div>
    <div class="chip save-error" role="status" aria-label="저장하지 못했어요">${SAVE_ERR}</div>`;
  doc.body.appendChild(hud);
  const timer = hud.querySelector<HTMLDivElement>('.timer')!;
  const t = timer.querySelector<HTMLSpanElement>('.t')!;
  const saveErr = hud.querySelector<HTMLDivElement>('.save-error')!;

  const overlay = doc.createElement('div');
  overlay.id = 'overlay';
  doc.body.appendChild(overlay);

  let retry: () => void = () => {};
  let lastKey = '';
  let lastText = '';

  return {
    setTime(ms) {
      const text = formatClock(ms);
      if (text !== lastText) {
        t.textContent = text;
        lastText = text;
      }
      timer.classList.toggle('low', ms <= 60_000);
    },
    setSaveError(on) {
      saveErr.classList.toggle('on', on);
    },
    setOverlay(v) {
      const key = v.kind === 'countdown' ? `c${v.secondsLeft}` : v.kind;
      if (key === lastKey) return;
      lastKey = key;
      overlay.classList.toggle('on', v.kind !== 'none');
      overlay.dataset.kind = v.kind;
      if (v.kind === 'paused') overlay.innerHTML = `<div class="box">${PAUSE}</div>`;
      else if (v.kind === 'countdown') overlay.innerHTML = `<div class="box">${v.secondsLeft}</div>`;
      else if (v.kind === 'timeout') {
        overlay.innerHTML = `<div class="box">${HOURGLASS}<button type="button">다시 하기</button></div>`;
        const btn = overlay.querySelector('button')!;
        btn.addEventListener('click', () => retry());
        btn.focus();
      } else overlay.innerHTML = '';
    },
    onRetry(fn) {
      retry = fn;
    },
  };
}
