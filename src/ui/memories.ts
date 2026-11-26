// 6장 끝: 산타가 들여다보는 스노글로브 속 기억(명세서 §4 6장). 화면 가운데 둥근 유리 안에 차례로 비친다.
// 기억마다 영상 파일(public/video/<파일>, docs/VIDEO_PROMPTS.md)이 있으면 영상을, 없으면 손그림 움직임으로 대신한다.
// 기억 사이는 눈송이가 쓸고 지나간다. 대사·글자 없음.
import { drawWhale } from './storybook';

export interface MemoryDef {
  id: string;
  file: string;
  span: readonly [number, number];
}

const ease = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

// ── 손그림(사람 에셋·영상이 오기 전) ─────────────────────────
type Draw = (g: CanvasRenderingContext2D, w: number, h: number, k: number, t: number) => void;

function person(g: CanvasRenderingContext2D, x: number, y: number, s: number, o: { coat: string; hair: string; hat?: string; skin?: string; armsUp?: number; v?: boolean }): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineCap = 'round';
  // 몸
  g.fillStyle = o.coat;
  g.beginPath();
  g.roundRect(-26, -10, 52, 70, 20);
  g.fill();
  // 팔(armsUp 0 = 내림, 1 = 앞으로 쭉)
  const up = o.armsUp ?? 0;
  g.strokeStyle = o.coat;
  g.lineWidth = 14;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 22, 4);
    const ax = sx * (30 + 26 * up), ay = 40 - 60 * up;
    g.lineTo(ax, ay);
    g.stroke();
    g.fillStyle = o.skin ?? '#f1c9a5';
    g.beginPath();
    g.arc(ax, ay, 7, 0, Math.PI * 2);
    g.fill();
    if (o.v) {
      g.strokeStyle = o.skin ?? '#f1c9a5';
      g.lineWidth = 4;
      for (const d of [-0.35, 0.35]) {
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(ax + Math.sin(d) * 14, ay - Math.cos(d) * 14);
        g.stroke();
      }
      g.strokeStyle = o.coat;
      g.lineWidth = 14;
    }
  }
  // 머리
  g.fillStyle = o.skin ?? '#f1c9a5';
  g.beginPath();
  g.arc(0, -32, 24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = o.hair;
  g.beginPath();
  g.arc(0, -38, 25, Math.PI, 0);
  g.fill();
  if (o.hat) {
    g.fillStyle = o.hat;
    g.beginPath();
    g.arc(0, -40, 26, Math.PI, 0);
    g.fill();
  }
  // 웃는 얼굴
  g.fillStyle = '#1b1b1b';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(sx * 8, -32, 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(0, -26, 8, 0.2, Math.PI - 0.2);
  g.stroke();
  g.restore();
}

function dog(g: CanvasRenderingContext2D, x: number, y: number, s: number, o: { headDown?: number; wag: number; flip?: boolean }): void {
  g.save();
  g.translate(x, y);
  g.scale(o.flip ? -s : s, s);
  g.fillStyle = '#d9822b';
  g.beginPath();
  g.ellipse(0, 0, 42, 22, 0, 0, Math.PI * 2);
  g.fill();
  for (const lx of [-28, -12, 14, 30]) {
    g.fillRect(lx - 5, 10, 10, 26);
  }
  // 꼬리(말린 꼬리가 흔들린다)
  g.strokeStyle = '#d9822b';
  g.lineWidth = 9;
  g.beginPath();
  g.arc(-46, -14, 12, Math.PI * 0.2 + o.wag, Math.PI * 1.6 + o.wag);
  g.stroke();
  // 머리
  const hd = o.headDown ?? 0;
  g.save();
  g.translate(38, -18 + 14 * hd);
  g.rotate(0.4 * hd);
  g.fillStyle = '#d9822b';
  g.beginPath();
  g.ellipse(0, 0, 20, 17, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f6ead8';
  g.beginPath();
  g.ellipse(12, 6, 12, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d9822b';
  for (const ex of [-8, 6]) {
    g.beginPath();
    g.moveTo(ex - 6, -12);
    g.lineTo(ex, -28);
    g.lineTo(ex + 6, -12);
    g.fill();
  }
  g.fillStyle = '#1b1b1b';
  g.beginPath();
  g.arc(4, -3, 3, 0, Math.PI * 2);
  g.arc(23, 4, 3.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.restore();
}

function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#d23a3a';
  g.lineWidth = r * 0.22;
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(r, 0);
  g.stroke();
  g.fillStyle = '#1b2433';
  g.beginPath();
  g.arc(0, -r * 0.45, r * 0.22, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 따뜻한 방 안(창가) 바탕 */
function room(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#ffd9a0');
  grd.addColorStop(1, '#f3b878');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}
/** 눈 내리는 밤 마당 바탕 */
function night(g: CanvasRenderingContext2D, w: number, h: number): void {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#1c2a52');
  grd.addColorStop(0.62, '#3d5288');
  grd.addColorStop(0.62, '#eef2f8');
  grd.addColorStop(1, '#dfe6f2');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

const DRAW: Record<string, Draw> = {
  // 유나가 고래 꼬리를 마저 그리고 스케치북을 번쩍 들어 올린다
  yuna(g, w, h, k) {
    room(g, w, h);
    const lift = ease((k - 0.6) / 0.25);
    const by = h * 0.66 - lift * h * 0.24;
    person(g, w * 0.5, h * 0.62 - lift * 6, w / 520, { coat: '#f0c020', hair: '#4a2c18', armsUp: 0.35 + 0.65 * lift });
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#d23a3a';
    g.lineWidth = 6;
    g.fillRect(w * 0.27, by - h * 0.12, w * 0.46, h * 0.24);
    g.strokeRect(w * 0.27, by - h * 0.12, w * 0.46, h * 0.24);
    drawWhale(g, w * 0.46, by + h * 0.02, w / 900, 0.75 + 0.25 * ease(k / 0.55), '#1f57c0', true, 6);
  },
  // 수선집 창가: 빨간 코트 아이가 두 팔을 쭉 뻗자 손이 쏙, 아주머니가 따라 웃는다
  tailor(g, w, h, k) {
    room(g, w, h);
    // 창틀
    g.strokeStyle = '#7a4a2a';
    g.lineWidth = 18;
    g.strokeRect(w * 0.12, h * 0.14, w * 0.76, h * 0.72);
    // 재봉틀
    g.fillStyle = '#2a2d35';
    g.fillRect(w * 0.62, h * 0.6, w * 0.18, h * 0.06);
    g.fillRect(w * 0.74, h * 0.46, w * 0.05, h * 0.16);
    g.fillRect(w * 0.64, h * 0.45, w * 0.15, h * 0.04);
    const reach = ease(k / 0.4);
    person(g, w * 0.4, h * 0.6, w / 600, { coat: '#d23a3a', hair: '#3a2418', armsUp: reach });
    person(g, w * 0.7, h * 0.56, w / 520, { coat: '#6a8cc4', hair: '#5a3a24', armsUp: 0.1 + 0.2 * Math.max(0, Math.sin(k * 12)) * ease((k - 0.45) / 0.2) });
  },
  // 콩이가 새 축구공을 코로 밀어 주고, 민재가 털썩 주저앉는다
  kongi(g, w, h, k) {
    night(g, w, h);
    const push = ease(k / 0.35);
    const sit = ease((k - 0.4) / 0.2);
    ball(g, w * (0.42 + 0.14 * push), h * 0.74, w * 0.045, push * 4);
    dog(g, w * 0.3 + push * w * 0.06, h * 0.72, w / 700, { headDown: Math.sin(push * Math.PI) * 0.8, wag: Math.sin(k * 30) * 0.5 });
    person(g, w * 0.7, h * (0.62 + 0.1 * sit), w / 560, { coat: '#2f6fd0', hair: '#2a1d14', hat: '#f0b429', armsUp: 0.4 * sit });
  },
  // 환한 트리 앞: 할머니가 양손 브이, 옆 아이가 바짝 붙어 따라 한다
  tree(g, w, h, k, t) {
    night(g, w, h);
    // 트리 + 전구
    g.fillStyle = '#2e6a3e';
    for (const [y, r] of [[0.58, 0.2], [0.44, 0.16], [0.31, 0.11]] as const) {
      g.beginPath();
      g.moveTo(w * 0.5, h * (y - r * 1.1));
      g.lineTo(w * (0.5 - r), h * y);
      g.lineTo(w * (0.5 + r), h * y);
      g.fill();
    }
    const cols = ['#ff4a3a', '#4aa8ff', '#ffd84a'];
    for (let i = 0; i < 30; i++) {
      const y = 0.22 + (i / 30) * 0.36;
      const x = 0.5 + Math.sin(i * 2.4) * (y - 0.2) * 0.5;
      g.fillStyle = cols[i % 3]!;
      g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 4 + i);
      g.beginPath();
      g.arc(w * x, h * y, w * 0.009, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ffe680';
    g.beginPath();
    g.arc(w * 0.5, h * 0.16, w * 0.022, 0, Math.PI * 2);
    g.fill();
    const v = ease((k - 0.15) / 0.2);
    const copy = ease((k - 0.45) / 0.2);
    person(g, w * 0.27, h * 0.8, w / 900, { coat: '#f0b429', hair: '#2a1d14', hat: '#d23a3a' });
    person(g, w * 0.5, h * 0.78, w / 800, { coat: '#7a4ad0', hair: '#e6e6e6', armsUp: 0.75 * v, v: v > 0.5 });
    person(g, w * (0.68 - 0.06 * copy), h * 0.8, w / 900, { coat: '#2f9a4a', hair: '#3a2418', armsUp: 0.75 * copy, v: copy > 0.5 });
    person(g, w * 0.82, h * 0.8, w / 900, { coat: '#e07a9a', hair: '#1e1a18', hat: '#2f6fd0' });
  },
  // 콩이가 요정 장갑에 볼을 꾹 비비고 돌아와 민재 무릎에 턱을 괸다
  glove(g, w, h, k) {
    night(g, w, h);
    person(g, w * 0.24, h * 0.7, w / 560, { coat: '#2f6fd0', hair: '#2a1d14', hat: '#f0b429', armsUp: 0.35 });
    ball(g, w * 0.24, h * 0.66, w * 0.035, 0);
    // 요정 장갑(작은 초록 손)
    g.fillStyle = '#2f9a4a';
    g.beginPath();
    g.ellipse(w * 0.8, h * 0.7, w * 0.035, w * 0.026, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f6ead8';
    g.fillRect(w * 0.83, h * 0.69, w * 0.06, w * 0.02);
    // 콩이: 민재 곁 → 장갑으로 → 볼 비비기 → 돌아와 무릎에 턱
    const go = ease(k / 0.3);
    const rub = k > 0.3 && k < 0.5 ? Math.sin(((k - 0.3) / 0.2) * Math.PI) : 0;
    const back = ease((k - 0.5) / 0.3);
    const x = 0.36 + 0.34 * go - 0.34 * back;
    dog(g, w * x, h * 0.76, w / 760, { headDown: back > 0.95 ? 0.5 : -0.2 * rub, wag: Math.sin(k * 26) * 0.6, flip: back > 0.02 });
    if (rub > 0) {
      g.fillStyle = 'rgba(255, 216, 74, 0.8)';
      g.beginPath();
      g.arc(w * 0.78, h * 0.66, w * 0.02 * rub, 0, Math.PI * 2);
      g.fill();
    }
  },
};

/** 2장 끝: 아주머니가 새 재봉틀로 빨간 코트 소매를 줄인다 → 아이가 입고 팔을 쭉, 손이 쏙 → 남은 빨간 실을 끊으며 웃는다(16:9) */
function redCoat(g: CanvasRenderingContext2D, w: number, h: number, k: number, t: number): void {
  room(g, w, h);
  // 창(눈 오는 밤)과 옷걸이의 옷들
  g.fillStyle = '#24335e';
  g.fillRect(w * 0.06, h * 0.12, w * 0.22, h * 0.36);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 18; i++) {
    const x = w * 0.07 + ((i * 53) % (w * 0.2));
    const y = h * 0.13 + ((i * 37 + t * 40) % (h * 0.34));
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#7a4a2a';
  g.lineWidth = 10;
  g.strokeRect(w * 0.06, h * 0.12, w * 0.22, h * 0.36);
  g.fillStyle = '#5a3a24';
  g.fillRect(w * 0.82, h * 0.18, w * 0.12, h * 0.02);
  for (const [i, c] of ['#3f7a52', '#2f6fd0', '#e0b021'].entries()) {
    g.fillStyle = c;
    g.beginPath();
    g.roundRect(w * (0.83 + i * 0.035), h * 0.2, w * 0.03, h * 0.2, 6);
    g.fill();
  }
  // 작업대 + 새 재봉틀(반짝)
  g.fillStyle = '#a07a52';
  g.fillRect(w * 0.42, h * 0.66, w * 0.4, h * 0.05);
  g.fillStyle = '#2a2d35';
  g.fillRect(w * 0.55, h * 0.6, w * 0.2, h * 0.06);
  g.fillRect(w * 0.7, h * 0.44, w * 0.05, h * 0.18);
  g.fillRect(w * 0.56, h * 0.43, w * 0.19, h * 0.04);
  const sew = k < 0.38;
  const needle = sew ? Math.abs(Math.sin(t * 22)) * h * 0.03 : 0;
  g.fillStyle = '#c9c9c9';
  g.fillRect(w * 0.58, h * 0.47, w * 0.006, h * 0.1 + needle);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(w * 0.73, h * 0.46, 5 + 3 * Math.sin(t * 6), 0, Math.PI * 2);
  g.fill();
  // 빨간 실 한 가닥(끝에 끊는다)
  const cut = ease((k - 0.8) / 0.08);
  g.strokeStyle = '#d23a3a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(w * 0.585, h * 0.57);
  g.quadraticCurveTo(w * 0.62, h * 0.63, w * (0.66 - 0.03 * cut), h * (0.6 + 0.05 * cut));
  g.stroke();
  // 아주머니(재봉틀 뒤, 앞치마) — 끝에 가위로 실을 끊으며 웃는다
  person(g, w * 0.66, h * 0.6, w / 880, { coat: '#6a8cc4', hair: '#5a3a24', armsUp: sew ? 0.55 + 0.05 * Math.sin(t * 9) : k > 0.78 ? 0.6 : 0.15 });
  if (k > 0.76) {
    g.strokeStyle = '#9aa3ad';
    g.lineWidth = 4;
    const sx = w * 0.62, sy = h * 0.6, o = 0.25 * Math.abs(Math.sin(t * 10)) * (1 - cut);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + w * 0.04 * Math.cos(o), sy - w * 0.04 * Math.sin(o));
    g.moveTo(sx, sy);
    g.lineTo(sx + w * 0.04 * Math.cos(-o), sy - w * 0.04 * Math.sin(-o));
    g.stroke();
  }
  // 아이(빨간 코트): 처음엔 코트가 재봉틀 위 → 입고 두 팔을 쭉, 줄인 소매 밖으로 손이 쏙
  if (k < 0.38) {
    g.fillStyle = '#d23a3a';
    g.beginPath();
    g.roundRect(w * 0.5, h * 0.56, w * 0.1, h * 0.05, 8);
    g.fill();
  } else {
    const reach = ease((k - 0.42) / 0.16);
    const x = w * 0.28;
    person(g, x, h * 0.66, w / 1000, { coat: '#d23a3a', hair: '#3a2418', armsUp: reach });
    // 손이 쏙(소매 밖으로)
    const pop = ease((k - 0.5) / 0.1);
    if (pop > 0) {
      g.fillStyle = '#f1c9a5';
      const s = w / 1000;
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.arc(x + sx * (30 + 26) * s, h * 0.66 - 20 * s, 10 * s * (0.4 + 0.6 * pop), 0, Math.PI * 2);
        g.fill();
      }
      if (pop < 1) {
        g.fillStyle = `rgba(255,236,150,${(1 - pop).toFixed(2)})`;
        for (const sx of [-1, 1]) {
          g.beginPath();
          g.arc(x + sx * 56 * s, h * 0.66 - 20 * s, 26 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
}

export interface ClipView {
  /** dt만큼 흘린다. 끝났으면 true */
  update(dt: number): boolean;
  readonly t: number;
  mode(): 'video' | 'drawn';
  skip(): void;
  dispose(): void;
}

/** 화면 전체 짧은 장면(2장 끝): 영상 파일이 있으면 영상, 없으면 손그림. 건너뛰기(버튼·Esc) */
export function createClipView(doc: Document, o: { file: string; base: string; duration: number }): ClipView {
  const root = doc.createElement('div');
  root.id = 'clip';
  root.style.cssText = 'position:fixed;inset:0;z-index:40;background:#070b16;display:grid;place-items:center;opacity:0;transition:opacity 0.6s';
  const box = doc.createElement('div');
  box.style.cssText = 'position:relative;width:min(100vw,177.8vh);aspect-ratio:16/9';
  const cv = doc.createElement('canvas');
  cv.width = 1280;
  cv.height = 720;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  const video = doc.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none';
  let ok = false;
  video.addEventListener('loadeddata', () => (ok = true));
  video.src = `${o.base}video/${o.file}`;
  box.append(cv, video);
  root.appendChild(box);
  const skipBtn = doc.createElement('button');
  skipBtn.id = 'clip-skip';
  skipBtn.type = 'button';
  skipBtn.textContent = '건너뛰기 ▶▶';
  skipBtn.style.cssText = 'position:fixed;right:calc(env(safe-area-inset-right) + 16px);bottom:calc(env(safe-area-inset-bottom) + 16px);z-index:41;min-height:48px;padding:0 18px;border-radius:24px;border:3px solid #fff;background:rgba(27,36,51,0.72);color:#fff;font:700 16px system-ui,sans-serif;cursor:pointer';
  doc.body.append(root, skipBtn);
  doc.body.classList.add('cutscene');
  requestAnimationFrame(() => (root.style.opacity = '1'));
  let t = 0;
  let done = false;
  const g = cv.getContext('2d')!;
  const finish = () => (done = true);
  skipBtn.addEventListener('click', finish);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
  };
  doc.addEventListener('keydown', onKey);
  return {
    get t() {
      return t;
    },
    update(dt) {
      t += dt;
      const dur = ok && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : o.duration;
      if (ok) {
        video.style.display = 'block';
        if (video.paused && !done) void video.play().catch(() => {});
      } else redCoat(g, 1280, 720, Math.min(1, t / o.duration), t);
      if (t >= dur + 0.6) done = true;
      return done;
    },
    mode: () => (ok ? 'video' : 'drawn'),
    skip: finish,
    dispose() {
      doc.removeEventListener('keydown', onKey);
      video.pause();
      root.remove();
      skipBtn.remove();
      doc.body.classList.remove('cutscene');
    },
  };
}

export interface MemoryView {
  /** 기억 장면 시각 t(끝 장면 시각). 기억 구간 밖이면 감춘다 */
  update(t: number, open: number): void;
  /** 지금 보이는 기억(시험용): 'video' | 'drawn' | null */
  mode(): { id: string | null; source: 'video' | 'drawn' | null };
  dispose(): void;
}

export function createMemoryView(doc: Document, memories: readonly MemoryDef[], base: string): MemoryView {
  const root = doc.createElement('div');
  root.id = 'memory';
  root.style.cssText =
    'position:fixed;left:50%;top:50%;width:min(78vh,78vw);aspect-ratio:1;transform:translate(-50%,-50%) scale(0.2);border-radius:50%;overflow:hidden;z-index:33;pointer-events:none;opacity:0;box-shadow:0 0 0 6px rgba(255,255,255,0.55),0 0 60px 20px rgba(200,230,255,0.35);background:#1c2a52';
  const cv = doc.createElement('canvas');
  cv.width = cv.height = 720;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  root.appendChild(cv);
  // 영상(있으면): 기억마다 하나
  const videos = new Map<string, { el: HTMLVideoElement; ok: boolean }>();
  for (const m of memories) {
    const el = doc.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none';
    const v = { el, ok: false };
    el.addEventListener('loadeddata', () => (v.ok = true));
    el.addEventListener('error', () => (v.ok = false));
    el.src = `${base}video/${m.file}`;
    root.appendChild(el);
    videos.set(m.id, v);
  }
  // 유리 위 눈발·반사
  const glass = doc.createElement('canvas');
  glass.width = glass.height = 720;
  glass.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  root.appendChild(glass);
  doc.body.appendChild(root);
  const g = cv.getContext('2d')!;
  const gg = glass.getContext('2d')!;
  let current: string | null = null;
  let source: 'video' | 'drawn' | null = null;
  const flakes = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97) % 720, y: (i * 53) % 720, r: 2 + (i % 4), v: 30 + (i % 7) * 12 }));
  return {
    update(t, open) {
      root.style.opacity = String(open);
      root.style.transform = `translate(-50%,-50%) scale(${(0.2 + 0.8 * ease(open)).toFixed(3)})`;
      const m = memories.find((q) => t >= q.span[0] && t < q.span[1]) ?? null;
      for (const [id, v] of videos) {
        const on = !!m && m.id === id && v.ok;
        v.el.style.display = on ? 'block' : 'none';
        if (on) {
          const want = t - m!.span[0];
          if (Math.abs(v.el.currentTime - want) > 0.4) v.el.currentTime = Math.min(want, Math.max(0, (v.el.duration || 5) - 0.05));
          if (v.el.paused) void v.el.play().catch(() => {});
        } else if (!v.el.paused) v.el.pause();
      }
      current = m?.id ?? null;
      source = null;
      g.clearRect(0, 0, 720, 720);
      if (m) {
        const v = videos.get(m.id);
        const k = (t - m.span[0]) / (m.span[1] - m.span[0]);
        if (v?.ok) source = 'video';
        else {
          source = 'drawn';
          DRAW[m.id]?.(g, 720, 720, k, t);
        }
      }
      // 유리 속 눈발 + 기억 사이를 쓸고 지나가는 큰 눈송이
      gg.clearRect(0, 0, 720, 720);
      gg.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of flakes) {
        const y = (f.y + t * f.v) % 760 - 20;
        const x = f.x + Math.sin(t * 0.8 + f.y) * 12;
        gg.beginPath();
        gg.arc(x, y, f.r, 0, Math.PI * 2);
        gg.fill();
      }
      for (const q of memories) {
        const d = t - q.span[1];
        if (d > -0.5 && d < 0.5) {
          const k = (d + 0.5) / 1.0;
          gg.fillStyle = `rgba(255,255,255,${(0.95 * Math.sin(k * Math.PI)).toFixed(3)})`;
          gg.beginPath();
          gg.arc(-200 + k * 1120, 360, 260, 0, Math.PI * 2);
          gg.fill();
        }
      }
      // 유리 반사
      const hl = gg.createRadialGradient(220, 170, 10, 220, 170, 200);
      hl.addColorStop(0, 'rgba(255,255,255,0.35)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      gg.fillStyle = hl;
      gg.fillRect(0, 0, 720, 720);
    },
    mode: () => ({ id: current, source }),
    dispose() {
      for (const v of videos.values()) v.el.pause();
      root.remove();
    },
  };
}
