// 지우의 그림 지도(1장): 공책 한 장에 크레파스로 그린 길 그림. 글자 없이(명세서: 대사·설명 없음).
//   아래 돌 아치 → 위로 뻗은 골목 → 낮은 담(벽돌)을 오른쪽 끝으로 돌아 들어가는 화살표 →
//   물고기 우편함(대문 왼쪽)·풍차 화분(문 오른쪽)·창가에 웃는 얼굴이 있는 집.
//   골목 옆 다른 집들은 무늬 없이 네모로만(세지 말고 생김새를 비교하게).
// 지도를 편 요정 쪽 아래 모서리에 펼쳐진다(1P 왼쪽, 2P 오른쪽). 테두리는 그 요정 모자 색.

const CSS = `
.jiu-map { position: fixed; z-index: 20; bottom: calc(env(safe-area-inset-bottom) + 12px); width: min(44vh, 46vw, 400px);
  aspect-ratio: 0.8; pointer-events: none; transform-origin: 50% 100%; transform: scale(0.2) rotate(0deg); opacity: 0;
  transition: transform 0.28s cubic-bezier(.2,1.4,.4,1), opacity 0.2s; }
.jiu-map.on { opacity: 1; }
.jiu-map.l { left: calc(env(safe-area-inset-left) + 12px); }
.jiu-map.r { right: calc(env(safe-area-inset-right) + 12px); }
.jiu-map canvas { width: 100%; height: 100%; display: block; border-radius: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); border: 5px solid #fff; box-sizing: border-box; }
`;

/** 크레파스 선(살짝 떨리게, 두 번 겹쳐 그린다) */
function crayon(g: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, seed = 1): void {
  let s = seed * 9973;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.globalAlpha = pass ? 0.55 : 0.9;
    g.lineWidth = width * (pass ? 0.7 : 1);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + rnd() * width * 0.5, jy = y + rnd() * width * 0.5;
      if (i === 0) g.moveTo(jx, jy);
      else g.lineTo(jx, jy);
    });
    g.stroke();
  }
  g.globalAlpha = 1;
}

function fill(g: CanvasRenderingContext2D, color: string, draw: () => void): void {
  g.fillStyle = color;
  g.globalAlpha = 0.75;
  g.beginPath();
  draw();
  g.fill();
  g.globalAlpha = 1;
}

/** 지도 그림(400×500) */
export function drawJiuMap(g: CanvasRenderingContext2D, W = 400, H = 500): void {
  // 공책 종이: 연한 줄 + 왼쪽 빨간 여백선
  g.fillStyle = '#fffdf3';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(90,140,210,0.25)';
  g.lineWidth = 1.5;
  for (let y = 40; y < H; y += 26) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(220,80,80,0.35)';
  g.beginPath();
  g.moveTo(34, 0);
  g.lineTo(34, H);
  g.stroke();

  // 길(골목): 아래에서 위로, 담 앞에서 오른쪽으로 꺾여 들어간다
  crayon(g, [[200, 480], [200, 230], [212, 200], [300, 196], [318, 170]], '#c9a27a', 26, 2);
  // 돌 아치(아래)
  crayon(g, [[150, 470], [150, 420], [160, 392], [200, 378], [240, 392], [250, 420], [250, 470]], '#8a7d6a', 9, 3);
  // 골목 옆 다른 집들(무늬 없음)
  for (const [x, y] of [[90, 330], [312, 300], [92, 250], [312, 236]] as const) {
    crayon(g, [[x - 34, y + 26], [x - 34, y - 14], [x, y - 40], [x + 34, y - 14], [x + 34, y + 26], [x - 34, y + 26]], '#9aa7c4', 5, x + y);
  }
  // 유나네 집(위): 지붕 + 벽
  fill(g, '#f3dfc4', () => g.rect(110, 70, 180, 100));
  crayon(g, [[100, 76], [200, 18], [300, 76]], '#c0623a', 9, 5);
  crayon(g, [[110, 76], [110, 170], [290, 170], [290, 76]], '#8a5a3a', 6, 6);
  // 창가에 웃는 얼굴(유나) — 왼쪽 창
  fill(g, '#ffd27a', () => g.rect(128, 94, 64, 52));
  crayon(g, [[128, 94], [192, 94], [192, 146], [128, 146], [128, 94]], '#2f6fd0', 5, 7);
  g.strokeStyle = '#5a3620';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(160, 120, 13, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(160, 123, 7, 0.2, Math.PI - 0.2);
  g.stroke();
  for (const sx of [-1, 1]) {
    g.fillStyle = '#5a3620';
    g.beginPath();
    g.arc(160 + sx * 5, 116, 1.8, 0, Math.PI * 2);
    g.fill();
    // 양 갈래 머리
    g.beginPath();
    g.arc(160 + sx * 16, 124, 4.5, 0, Math.PI * 2);
    g.fill();
  }
  // 문(오른쪽) + 문 오른쪽 풍차 화분
  fill(g, '#8c4a3a', () => g.rect(222, 112, 36, 58));
  crayon(g, [[222, 170], [222, 112], [258, 112], [258, 170]], '#5a3620', 5, 8);
  crayon(g, [[276, 170], [272, 152], [292, 152], [288, 170], [276, 170]], '#c0623a', 5, 9);
  crayon(g, [[282, 152], [282, 128]], '#888', 3, 10);
  const blades: [string, number][] = [['#d23a3a', 0], ['#f2c230', 1], ['#2f6fd0', 2], ['#2f9a4a', 3]];
  for (const [c, i] of blades) {
    const a = (i * Math.PI) / 2;
    fill(g, c, () => {
      g.moveTo(282, 124);
      g.lineTo(282 + Math.cos(a) * 13 - Math.sin(a) * 5, 124 + Math.sin(a) * 13 + Math.cos(a) * 5);
      g.lineTo(282 + Math.cos(a + 0.6) * 13, 124 + Math.sin(a + 0.6) * 13);
    });
  }
  // 낮은 담(벽돌 무늬) — 집 앞을 가로막고, 오른쪽 끝이 열려 있다
  fill(g, '#c9b9a2', () => g.rect(62, 196, 232, 22));
  crayon(g, [[62, 196], [294, 196], [294, 218], [62, 218], [62, 196]], '#7a6a56', 5, 11);
  for (let x = 82; x < 290; x += 26) crayon(g, [[x, 198], [x, 216]], '#7a6a56', 3, x);
  // 담 오른쪽 끝을 돌아 들어가는 화살표(빨강)
  crayon(g, [[236, 260], [318, 252], [336, 214], [318, 184]], '#e0342f', 7, 12);
  crayon(g, [[306, 196], [318, 184], [332, 196]], '#e0342f', 7, 13);
  // 물고기 우편함: 대문(담 오른쪽 끝) 왼쪽
  crayon(g, [[282, 238], [282, 216]], '#8a5a3a', 5, 14);
  fill(g, '#4a9be8', () => g.ellipse(278, 210, 16, 9, 0, 0, Math.PI * 2));
  fill(g, '#4a9be8', () => {
    g.moveTo(292, 210);
    g.lineTo(304, 202);
    g.lineTo(304, 218);
  });
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(270, 207, 2.2, 0, Math.PI * 2);
  g.fill();
}

export interface MapView {
  /** 이 자리(0 = 1P, 1 = 2P)의 지도 펴기·접기. color: 지도를 편 요정 모자 색 */
  set(slot: number, open: boolean, color: string): void;
  isOpen(slot: number): boolean;
}

export function createMapView(doc: Document, slots: number): MapView {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  const views = Array.from({ length: slots }, (_, i) => {
    const el = doc.createElement('div');
    el.className = `jiu-map ${i % 2 === 0 ? 'l' : 'r'}`;
    el.setAttribute('aria-hidden', 'true');
    const c = doc.createElement('canvas');
    c.width = 400;
    c.height = 500;
    el.appendChild(c);
    const g = c.getContext('2d');
    if (g) drawJiuMap(g);
    doc.body.appendChild(el);
    return { el, canvas: c, open: false };
  });
  return {
    set(slot, open, color) {
      const v = views[slot];
      if (!v || v.open === open) return;
      v.open = open;
      v.el.classList.toggle('on', open);
      v.el.style.transform = open ? `scale(1) rotate(${slot % 2 ? 3 : -3}deg)` : 'scale(0.2) rotate(0deg)';
      v.canvas.style.borderColor = color;
    },
    isOpen(slot) {
      return views[slot]?.open ?? false;
    },
  };
}
