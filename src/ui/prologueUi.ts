// 프롤로그 화면 위 장치(DOM): 사진기 뷰파인더(예약 셔터 깜박임) · 찰칵 번쩍임 · 사진 카드(앞: 찍힌 사진, 뒤: 손글씨 한 줄) ·
// 장면 넘김 어둡게 하기 · 건너뛰기 버튼. 대사·자막 없음. 글자는 사진 뒷면 한 줄(소품)과 기능 버튼 이름뿐.
// 연출이 도는 동안 몸에 'cutscene' 표시를 달아 조작 버튼·대상 표시를 숨긴다.

const CSS = `
body.cutscene #controls, body.cutscene .offscreen-mark { display: none !important; }
#pro-finder { position: fixed; inset: 6vh 6vw; z-index: 30; pointer-events: none; display: none; }
#pro-finder.on { display: block; }
#pro-finder .c { position: absolute; width: 46px; height: 46px; border: 0 solid rgba(255,255,255,0.92); filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); }
#pro-finder .tl { left: 0; top: 0; border-width: 5px 0 0 5px; border-radius: 10px 0 0 0; }
#pro-finder .tr { right: 0; top: 0; border-width: 5px 5px 0 0; border-radius: 0 10px 0 0; }
#pro-finder .bl { left: 0; bottom: 0; border-width: 0 0 5px 5px; border-radius: 0 0 0 10px; }
#pro-finder .br { right: 0; bottom: 0; border-width: 0 5px 5px 0; border-radius: 0 0 10px 0; }
#pro-finder .rec { position: absolute; right: 18px; top: 16px; width: 26px; height: 26px; border-radius: 50%;
  background: #ff3b30; box-shadow: 0 0 14px 4px rgba(255,59,48,0.75); border: 3px solid #fff; opacity: 0.18; }
#pro-finder .rec.on { opacity: 1; }
#pro-flash { position: fixed; inset: 0; z-index: 31; background: #fff; opacity: 0; pointer-events: none; }
#pro-dim { position: fixed; inset: 0; z-index: 29; background: #070b16; opacity: 0; pointer-events: none; }
#pro-card { position: fixed; left: 50%; top: 50%; z-index: 32; width: min(62vw, 92vh, 620px); aspect-ratio: 1.12;
  margin: 0; transform: translate(-50%, -50%); perspective: 1400px; pointer-events: none; display: none; }
#pro-card.on { display: block; }
#pro-card .flip { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
#pro-card .face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 10px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.55); background: #fbf8f0; }
#pro-card .front { padding: 4.5% 4.5% 15%; box-sizing: border-box; }
#pro-card .front canvas { width: 100%; height: 100%; display: block; border-radius: 3px; background: #223049; }
#pro-card .back { transform: rotateY(180deg); display: grid; place-items: center;
  background: repeating-linear-gradient(0deg, #fbf8f0 0 30px, #efe9da 30px 31px); }
#pro-card .back p { margin: 0; transform: rotate(-4deg); color: #2b4a8a; letter-spacing: 0.04em;
  font: 700 clamp(22px, 4.4vw, 44px)/1.3 'Nanum Pen Script', 'Nanum Pen', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif; }
#pro-skip { position: fixed; z-index: 35; right: calc(env(safe-area-inset-right) + 16px); bottom: calc(env(safe-area-inset-bottom) + 16px);
  min-width: 132px; min-height: 52px; padding: 0 20px; border-radius: 26px; border: 3px solid #fff; cursor: pointer;
  background: rgba(27,36,51,0.78); color: #fff; font: 700 18px/1 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#pro-skip:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
`;

export interface PrologueUi {
  finder(on: boolean, rec: boolean): void;
  flash(k: number): void;
  /** 0 = 투명, 1 = 깜깜 */
  dim(k: number): void;
  /** 사진 카드: show 0~1(나타남), flip 0~1(뒤집힘), 사진 그림 */
  card(show: number, flip: number): void;
  /** 찍힌 사진을 카드 앞면에 그린다 */
  setPhoto(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void;
  onSkip(fn: () => void): void;
  dispose(): void;
}

export function createPrologueUi(doc: Document): PrologueUi {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  doc.body.classList.add('cutscene');

  const finder = doc.createElement('div');
  finder.id = 'pro-finder';
  finder.innerHTML = '<div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div><div class="rec"></div>';
  const flash = doc.createElement('div');
  flash.id = 'pro-flash';
  const dim = doc.createElement('div');
  dim.id = 'pro-dim';
  const card = doc.createElement('div');
  card.id = 'pro-card';
  card.innerHTML = '<div class="flip"><div class="face front"><canvas width="640" height="480"></canvas></div><div class="face back"><p>한 시간 전, 마을 광장</p></div></div>';
  const skip = doc.createElement('button');
  skip.id = 'pro-skip';
  skip.type = 'button';
  skip.textContent = '건너뛰기 ▶▶';
  for (const el of [dim, finder, flash, card, skip]) doc.body.appendChild(el);
  const rec = finder.querySelector('.rec') as HTMLElement;
  const flip = card.querySelector('.flip') as HTMLElement;
  const canvas = card.querySelector('canvas') as HTMLCanvasElement;
  const skipFns: (() => void)[] = [];
  const fire = () => skipFns.forEach((f) => f());
  skip.addEventListener('click', fire);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') fire();
  };
  doc.addEventListener('keydown', onKey);

  return {
    finder(on, r) {
      finder.classList.toggle('on', on);
      rec.classList.toggle('on', r);
    },
    flash(k) {
      flash.style.opacity = String(Math.max(0, Math.min(1, k)));
    },
    dim(k) {
      dim.style.opacity = String(Math.max(0, Math.min(1, k)));
    },
    card(show, f) {
      card.classList.toggle('on', show > 0.001);
      const s = 0.72 + 0.28 * show;
      card.style.opacity = String(Math.min(1, show * 1.4));
      card.style.transform = `translate(-50%, -50%) scale(${s.toFixed(3)}) rotate(${(-3 + 1.5 * f).toFixed(2)}deg)`;
      flip.style.transform = `rotateY(${(180 * f).toFixed(1)}deg)`;
    },
    setPhoto(draw) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas.width, canvas.height);
    },
    onSkip(fn) {
      skipFns.push(fn);
    },
    dispose() {
      doc.removeEventListener('keydown', onKey);
      for (const el of [dim, finder, flash, card, skip]) el.remove();
      style.remove();
      doc.body.classList.remove('cutscene');
    },
  };
}
