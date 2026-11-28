// 1장 시작 그림책(명세서 §4 1장 첫 문단): 대사·글자 없이 손과 소품만으로.
//   ① 지우의 공책 귀퉁이에 이미 그려진 고래(종이 끝이라 꼬리가 없다) 옆에서 유나가 시무룩 → 지우가 그 모습을 본다
//   ② 지우가 다 그린 카드(빈 스케치북 + 색연필 + 받을 자리의 유나 얼굴)를 들고 웃는다
//   (2026-11-28 사용자: "그리는 과정은 어색, 인물을 보여 주고 그림은 다 그린 것으로". 인물은 그림책 화풍 상반신, ui/people2d)
//   ③ 봉투에 산타 얼굴 우표 → ④ 빨간 우체통에 쏙 → ⑤ 같은 카드가 요정 손(초록 소매·뾰족 장갑)에 → 우편함 골목으로
// 우체통·요정 장면은 손만 그린다. 건너뛰기: 버튼·Esc.

import { drawPerson, JIWOO_2D, YUNA_2D } from './people2d';

export const STORY = {
  draw: [0.6, 3.4] as const, // 유나와 꼬리 없는 고래
  stop: [3.4, 6.0] as const, // 지우가 본다
  card: [6.0, 9.6] as const, // 지우가 카드를 그림
  envelope: [9.6, 12.0] as const,
  mailbox: [12.0, 14.2] as const,
  elf: [14.2, 16.6] as const,
  end: 17.2,
};

const seg = (t: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const ease = (x: number) => x * x * (3 - 2 * x);

/** 고래 그림(크레파스·연필). progress 0~1: 몸 → 눈 → 물줄기 → 꼬리. tailCut이면 꼬리 자리에 종이 끝 */
export function drawWhale(g: CanvasRenderingContext2D, x: number, y: number, s: number, progress: number, color = '#2f6fd0', tail = true, line = 5): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.lineWidth = line;
  // 몸: 둥근 등 + 배(0~0.55)
  const body = Math.min(1, progress / 0.55);
  if (body > 0) {
    g.beginPath();
    const steps = Math.floor(60 * body);
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI * 0.95 - (i / 60) * Math.PI * 1.9;
      const px = Math.cos(a) * 70, py = -Math.sin(a) * 38 * (a > 0 && a < Math.PI ? 1 : 0.6);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  // 눈·웃는 입(0.55~0.65)
  if (progress > 0.58) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(-42, -6, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  if (progress > 0.63) {
    g.beginPath();
    g.arc(-52, 8, 10, 0.2, Math.PI - 0.4);
    g.stroke();
  }
  // 물줄기(0.65~0.78)
  const sp = Math.min(1, Math.max(0, (progress - 0.65) / 0.13));
  if (sp > 0) {
    g.strokeStyle = '#4a9be8';
    for (const dx of [-10, 0, 10]) {
      g.beginPath();
      g.moveTo(-20, -38);
      g.quadraticCurveTo(-20 + dx * 0.5, -60 * sp, -20 + dx * 1.6, -70 * sp + 10);
      g.stroke();
    }
    g.strokeStyle = color;
  }
  // 꼬리(0.8~1): 몸 끝에서 위로 갈라진 두 지느러미
  const tp = Math.min(1, Math.max(0, (progress - 0.8) / 0.2));
  if (tail && tp > 0) {
    g.beginPath();
    g.moveTo(68, -8);
    g.quadraticCurveTo(90, -14 - 6 * tp, 104, -34 * tp);
    g.moveTo(68, -8);
    g.quadraticCurveTo(96, 0, 112 * Math.min(1, tp * 1.2) + (1 - Math.min(1, tp * 1.2)) * 70, 4 - 22 * tp);
    g.stroke();
  }
  g.restore();
}

/** 손(소매 색·크기). 원점 = 손끝, 팔이 dir 쪽으로 뻗는다 */
function hand(g: CanvasRenderingContext2D, x: number, y: number, s: number, sleeve: string, glove: string | null, angle: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(s, s);
  // 소매
  g.fillStyle = sleeve;
  g.beginPath();
  g.roundRect(28, -22, 160, 44, 16);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(28, -22, 12, 44);
  // 손(장갑이면 장갑 색)
  g.fillStyle = glove ?? '#f3cfb2';
  g.beginPath();
  g.ellipse(14, 0, 24, 18, 0, 0, Math.PI * 2);
  g.fill();
  if (glove) {
    // 요정 장갑: 뾰족한 손목 테두리
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    for (let i = 0; i <= 6; i++) g.lineTo(30 + (i % 2) * 8, -20 + i * 6.7);
    g.lineTo(26, 20);
    g.lineTo(26, -20);
    g.fill();
  }
  g.restore();
}

function pencil(g: CanvasRenderingContext2D, x: number, y: number, angle: number, color = '#f2c230'): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = color;
  g.fillRect(8, -6, 90, 12);
  g.fillStyle = '#e8c49a';
  g.beginPath();
  g.moveTo(8, -6);
  g.lineTo(-8, 0);
  g.lineTo(8, 6);
  g.fill();
  g.fillStyle = '#333';
  g.beginPath();
  g.moveTo(-2, -2);
  g.lineTo(-8, 0);
  g.lineTo(-2, 2);
  g.fill();
  g.fillStyle = '#e57ab0';
  g.fillRect(98, -6, 10, 12);
  g.restore();
}

/** 카드 그림(빈 스케치북 + 색연필 + 받을 자리의 유나 얼굴). progress 0~1 */
export function drawCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, progress: number): void {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#fffdf3';
  g.strokeStyle = '#c9b9a2';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(0, 0, w, h, 10);
  g.fill();
  g.stroke();
  const p1 = Math.min(1, progress / 0.4);
  // 빈 스케치북(빨간 표지 + 흰 종이 + 스프링)
  if (p1 > 0) {
    g.globalAlpha = p1;
    g.fillStyle = '#d23a3a';
    g.fillRect(w * 0.12, h * 0.34, w * 0.42, h * 0.5);
    g.fillStyle = '#fff';
    g.fillRect(w * 0.15, h * 0.38, w * 0.36, h * 0.42);
    g.fillStyle = '#888';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(w * 0.17 + i * w * 0.064, h * 0.35, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // 색연필 셋
  const p2 = Math.min(1, Math.max(0, (progress - 0.35) / 0.3));
  ['#d23a3a', '#2f9a4a', '#2f6fd0'].forEach((c, i) => {
    if (p2 * 3 > i) pencil(g, w * 0.62 + i * 14, h * 0.82, -Math.PI / 2 - 0.15, c);
  });
  // 받을 자리: 유나 얼굴(양 갈래 머리)
  const p3 = Math.min(1, Math.max(0, (progress - 0.7) / 0.3));
  if (p3 > 0) {
    g.globalAlpha = p3;
    g.strokeStyle = '#c9b9a2';
    g.setLineDash([6, 5]);
    g.strokeRect(w * 0.64, h * 0.08, w * 0.3, h * 0.3);
    g.setLineDash([]);
    const fx = w * 0.79, fy = h * 0.23;
    g.fillStyle = '#3a2418';
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(fx + sx * 22, fy + 4, 8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#f3cfb2';
    g.beginPath();
    g.arc(fx, fy, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2418';
    g.beginPath();
    g.arc(fx, fy - 6, 16, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1210';
    g.beginPath();
    g.arc(fx - 5, fy + 1, 1.8, 0, Math.PI * 2);
    g.arc(fx + 5, fy + 1, 1.8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d23a3a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(fx, fy + 4, 6, 0.3, Math.PI - 0.3);
    g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
}

/** 산타 얼굴 우표 */
function stamp(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#fff';
  g.strokeStyle = '#c9b9a2';
  g.setLineDash([4, 4]);
  g.lineWidth = 3;
  g.fillRect(-30, -36, 60, 72);
  g.strokeRect(-30, -36, 60, 72);
  g.setLineDash([]);
  g.fillStyle = '#c42b30';
  g.beginPath();
  g.moveTo(-18, -8);
  g.lineTo(0, -30);
  g.lineTo(18, -8);
  g.fill();
  g.fillStyle = '#f3cfb2';
  g.beginPath();
  g.arc(0, 0, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(0, 14, 14, 0, Math.PI);
  g.fill();
  g.fillRect(-20, -10, 40, 6);
  g.restore();
}

/** 그림책 한 장면(960×540) */
export function drawStory(g: CanvasRenderingContext2D, t: number, W = 960, H = 540): void {
  // 책상
  g.fillStyle = '#c9a27a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 46) g.fillRect(0, y, W, 3);
  if (t < STORY.card[0]) {
    // ① 지우의 공책 귀퉁이(파란 표지 위 줄 종이, 오른쪽 끝이 종이 끝)
    g.fillStyle = '#2f5fb0';
    g.fillRect(150, 70, 620, 420);
    g.fillStyle = '#fffdf3';
    g.fillRect(170, 86, 560, 390);
    g.strokeStyle = 'rgba(90,140,210,0.3)';
    g.lineWidth = 2;
    for (let y = 120; y < 470; y += 30) {
      g.beginPath();
      g.moveTo(170, y);
      g.lineTo(730, y);
      g.stroke();
    }
    // 지우가 쓴 연습 줄(글자 대신 물결)
    g.strokeStyle = 'rgba(40,40,60,0.45)';
    for (const y of [116, 146, 176]) {
      g.beginPath();
      for (let x = 200; x < 520; x += 8) g.lineTo(x, y + Math.sin(x * 0.2) * 3);
      g.stroke();
    }
    // 다 그린 고래(종이 끝이라 꼬리 자리가 없다)
    drawWhale(g, 628, 340, 1.3, 0.78, '#2f6fd0', false);
    // 유나: 오른쪽 아래에서 고래를 보며 시무룩(연필은 들지 않는다: 얼굴을 가로질러 어색했다)
    const inK = ease(seg(t, [0, 0.8]));
    drawPerson(g, YUNA_2D, 830, 560 + (1 - inK) * 120, 1.05, { mood: t > 1.6 ? -1 : 0, look: -1 });
    // 지우: 왼쪽 아래에서 들어와 유나를 본다
    const stopK = ease(seg(t, STORY.stop));
    if (stopK > 0) drawPerson(g, JIWOO_2D, 120, 560 + (1 - stopK) * 160, 1.1, { mood: 0, look: 1 });
  } else if (t < STORY.envelope[0]) {
    // ② 다 그린 카드를 들고 웃는 지우
    const k = ease(seg(t, [STORY.card[0], STORY.card[0] + 0.7]));
    drawCard(g, 220, 70 + (1 - k) * 40, 440, 330, 1);
    drawPerson(g, JIWOO_2D, 800, 560, 1.15, { mood: 1, look: -1 });
    hand(g, 640, 400, 0.85, '#2f6fd0', null, 0.5);
  } else if (t < STORY.mailbox[0]) {
    // ③ 봉투에 넣고 산타 우표
    const k = seg(t, STORY.envelope);
    g.fillStyle = '#f4ead6';
    g.fillRect(250, 150, 460, 270);
    g.strokeStyle = '#d6c4a4';
    g.lineWidth = 3;
    g.strokeRect(250, 150, 460, 270);
    // 카드가 봉투 안으로 내려간다
    g.save();
    g.beginPath();
    g.rect(240, 0, 480, 150 + 30);
    g.clip();
    drawCard(g, 290, 40 + k * 160, 380, 260, 1);
    g.restore();
    g.beginPath();
    g.moveTo(250, 150);
    g.lineTo(480, 300);
    g.lineTo(710, 150);
    g.stroke();
    if (k > 0.6) stamp(g, 650, 210, 0.9 + 0.3 * (1 - seg(t, [STORY.envelope[0] + 1.4, STORY.envelope[0] + 1.7])));
  } else if (t < STORY.elf[0]) {
    // ④ 빨간 우체통에 쏙
    const k = seg(t, STORY.mailbox);
    g.fillStyle = '#d23a3a';
    g.beginPath();
    g.roundRect(360, 120, 240, 380, 40);
    g.fill();
    g.fillStyle = '#9e2a2a';
    g.fillRect(400, 220, 160, 18);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(480, 340, 34, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.rect(0, 0, W, 226);
    g.clip();
    g.fillStyle = '#f4ead6';
    g.save();
    g.translate(480, 120 + ease(k) * 130);
    g.rotate(-0.05);
    g.fillRect(-90, -60, 180, 110);
    stamp(g, 60, -20, 0.5);
    g.restore();
    g.restore();
    hand(g, 600, 120 + ease(Math.min(1, k * 1.5)) * 60, 1.0, '#2f6fd0', null, -0.3);
  } else {
    // ⑤ 같은 카드가 요정 손(초록 소매·흰 털 장갑 테두리)에 — 눈 오는 밤
    const k = ease(seg(t, STORY.elf));
    g.fillStyle = '#223049';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % W, y = ((i * 53 + t * 40) % H);
      g.beginPath();
      g.arc(x, y, 2, 0, Math.PI * 2);
      g.fill();
    }
    drawCard(g, 300, 100 - (1 - k) * 60, 360, 270, 1);
    hand(g, 300, 330, 0.8, '#2f8a3e', '#2f8a3e', 2.6);
    hand(g, 660, 330, 0.8, '#2f8a3e', '#2f8a3e', 0.54);
  }
  // 끝으로 갈수록 어두워짐
  const out = seg(t, [STORY.elf[1], STORY.end]);
  if (out > 0) {
    g.fillStyle = `rgba(7,11,22,${out})`;
    g.fillRect(0, 0, W, H);
  }
}

const CSS = `
body.cutscene #controls, body.cutscene .offscreen-mark, body.cutscene .jiu-map { display: none !important; }
#storybook { position: fixed; inset: 0; z-index: 36; background: #070b16; display: grid; place-items: center; }
#storybook canvas { width: min(100vw, 177.7vh); height: auto; aspect-ratio: 16/9; display: block; }
#storybook button { position: fixed; z-index: 37; right: calc(env(safe-area-inset-right) + 16px); bottom: calc(env(safe-area-inset-bottom) + 16px);
  min-width: 132px; min-height: 52px; padding: 0 20px; border-radius: 26px; border: 3px solid #fff; cursor: pointer;
  background: rgba(27,36,51,0.78); color: #fff; font: 700 18px/1 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#storybook button:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
`;

export interface Storybook {
  /** 시각을 dt만큼 보낸다. 끝나면 true */
  update(dt: number): boolean;
  readonly t: number;
  skip(): void;
  dispose(): void;
}

export function createStorybook(doc: Document): Storybook {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  const root = doc.createElement('div');
  root.id = 'storybook';
  const canvas = doc.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  root.appendChild(canvas);
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = '건너뛰기 ▶▶';
  root.appendChild(btn);
  doc.body.appendChild(root);
  doc.body.classList.add('cutscene');
  const g = canvas.getContext('2d');
  let t = 0;
  const skip = () => {
    t = STORY.end;
  };
  btn.addEventListener('click', skip);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') skip();
  };
  doc.addEventListener('keydown', onKey);
  return {
    get t() {
      return t;
    },
    update(dt) {
      t = Math.min(STORY.end, t + dt);
      if (g) drawStory(g, t);
      return t >= STORY.end;
    },
    skip,
    dispose() {
      doc.removeEventListener('keydown', onKey);
      root.remove();
      style.remove();
      doc.body.classList.remove('cutscene');
    },
  };
}
