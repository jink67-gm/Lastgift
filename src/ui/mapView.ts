// 지우의 그림 지도(1장): 공책 한 장에 크레파스로 그린 동네 길 그림. 글자 없이(명세서: 대사·설명 없음).
//   아래 돌 아치 → 골목 → 빨간 우체통 갈림길에서 왼쪽 → 끝에서 위로 → 큰 트리 모퉁이에서 오른쪽 → 나무 대문으로(빨간 화살표).
//   막다른 갈래·오른쪽 윗길도 길로만 그렸다. 유나네: 낮은 담·나무 대문, 대문 왼쪽 물고기 우편함, 문 오른쪽 풍차 화분, 창가에 웃는 얼굴.
//   다른 집들은 무늬 없이 네모로만(가까이 가서 생김새를 비교하게).
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

  // 동네 길(크레파스 넓은 줄): 아래 골목, 왼쪽 막다른 갈래, 가로로 긴 갈림길, 양 끝에서 위로, 윗길
  const fx = (t: number) => 40 + (t + 30) * 6;
  const fy = (s: number) => 478 - (s + 8) * 6.4;
  const road = '#d9bf98';
  const line = (pts: [number, number][], seed: number) => crayon(g, pts.map(([s, t]) => [fx(t), fy(s)] as [number, number]), road, 24, seed);
  line([[-8, 0], [19, 0]], 2);
  line([[8.6, -1], [8.6, -16]], 3);
  line([[19, -25], [19, 22]], 4);
  line([[19, -25], [38.2, -25]], 5);
  line([[19, 22], [35, 22]], 6);
  line([[38.2, -25], [38.2, 11]], 7);
  // 돌 아치(맨 아래)
  crayon(g, [[fx(-5), 486], [fx(-5), fy(-5.5)], [fx(-3), fy(-3.6)], [fx(0), fy(-2.8)], [fx(3), fy(-3.6)], [fx(5), fy(-5.5)], [fx(5), 486]], '#8a7d6a', 8, 3);
  // 다른 집들(무늬 없이 네모 + 세모 지붕): 막다른 갈래 끝 A, 오른쪽 윗길 끝 B, 유나네 왼쪽 옆 C
  for (const [s0, t0] of [[8.6, -24], [42.5, 22], [48, -18]] as const) {
    const x = fx(t0), y = fy(s0);
    crayon(g, [[x - 26, y + 18], [x - 26, y - 10], [x, y - 30], [x + 26, y - 10], [x + 26, y + 18], [x - 26, y + 18]], '#9aa7c4', 5, x + y);
  }
  // 갈림길 빨간 우체통(동그란 머리)
  const pbx = fx(-4.8), pby = fy(22.5);
  fill(g, '#d23a3a', () => g.rect(pbx - 8, pby - 2, 16, 22));
  fill(g, '#d23a3a', () => g.arc(pbx, pby - 2, 8, Math.PI, 0));
  crayon(g, [[pbx - 8, pby + 20], [pbx - 8, pby - 2], [pbx + 8, pby - 2], [pbx + 8, pby + 20]], '#8a1c1c', 3, 21);
  // 모퉁이 큰 트리(초록 세모 셋 + 노란 별)
  const tx0 = fx(-18.5), ty0 = fy(30.5);
  for (const [w, y] of [[22, 16], [17, 4], [12, -7]] as const) fill(g, '#2f8a4a', () => {
    g.moveTo(tx0 - w, ty0 + y);
    g.lineTo(tx0, ty0 + y - 18);
    g.lineTo(tx0 + w, ty0 + y);
  });
  fill(g, '#f2c230', () => g.arc(tx0, ty0 - 27, 5, 0, Math.PI * 2));

  // 유나네 집(맨 위 가운데): 지붕 + 벽, 창가의 웃는 얼굴, 문, 문 오른쪽 풍차 화분
  const hx = fx(-7), hw = fx(9) - fx(-7), hy = 34, hh = 62;
  fill(g, '#f3dfc4', () => g.rect(hx, hy, hw, hh));
  crayon(g, [[hx - 8, hy + 4], [hx + hw / 2, hy - 24], [hx + hw + 8, hy + 4]], '#c0623a', 8, 5);
  crayon(g, [[hx, hy + 4], [hx, hy + hh], [hx + hw, hy + hh], [hx + hw, hy + 4]], '#8a5a3a', 5, 6);
  const wx = fx(-4.2);
  fill(g, '#ffd27a', () => g.rect(wx - 18, hy + 14, 36, 30));
  crayon(g, [[wx - 18, hy + 14], [wx + 18, hy + 14], [wx + 18, hy + 44], [wx - 18, hy + 44], [wx - 18, hy + 14]], '#2f6fd0', 4, 7);
  g.strokeStyle = '#5a3620';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(wx, hy + 29, 8, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(wx, hy + 31, 4, 0.2, Math.PI - 0.2);
  g.stroke();
  g.fillStyle = '#5a3620';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(wx + sx * 10, hy + 30, 3, 0, Math.PI * 2);
    g.fill();
  }
  const dx = fx(1.6);
  fill(g, '#8c4a3a', () => g.rect(dx - 9, hy + hh - 30, 18, 30));
  const px = dx + 22, py = hy + hh - 4;
  crayon(g, [[px - 6, py], [px - 8, py - 10], [px + 8, py - 10], [px + 6, py], [px - 6, py]], '#c0623a', 4, 9);
  crayon(g, [[px, py - 10], [px, py - 26]], '#888', 2.5, 10);
  const blades: [string, number][] = [['#d23a3a', 0], ['#f2c230', 1], ['#2f6fd0', 2], ['#2f9a4a', 3]];
  for (const [c, i] of blades) {
    const a = (i * Math.PI) / 2;
    fill(g, c, () => {
      g.moveTo(px, py - 28);
      g.lineTo(px + Math.cos(a) * 10 - Math.sin(a) * 4, py - 28 + Math.sin(a) * 10 + Math.cos(a) * 4);
      g.lineTo(px + Math.cos(a + 0.6) * 10, py - 28 + Math.sin(a + 0.6) * 10);
    });
  }
  // 낮은 담(벽돌 무늬) + 나무 대문(오른쪽, 살 무늬)
  const wy = fy(42.5) - 8;
  const gx0 = fx(7.3), gx1 = fx(9.9);
  fill(g, '#c9b9a2', () => g.rect(fx(-9.5), wy, gx0 - fx(-9.5), 14));
  fill(g, '#c9b9a2', () => g.rect(gx1, wy, fx(10.5) - gx1, 14));
  crayon(g, [[fx(-9.5), wy], [gx0, wy], [gx0, wy + 14], [fx(-9.5), wy + 14], [fx(-9.5), wy]], '#7a6a56', 4, 11);
  for (let x = gx0 + 3; x < gx1 - 1; x += 5) crayon(g, [[x, wy - 2], [x, wy + 14]], '#a0703f', 2.5, x);
  // 물고기 우편함: 대문 왼쪽
  const mx = fx(5.6), my = wy + 16;
  crayon(g, [[mx, my + 14], [mx, my]], '#8a5a3a', 4, 14);
  fill(g, '#4a9be8', () => g.ellipse(mx - 2, my - 4, 12, 7, 0, 0, Math.PI * 2));
  fill(g, '#4a9be8', () => {
    g.moveTo(mx + 9, my - 4);
    g.lineTo(mx + 18, my - 10);
    g.lineTo(mx + 18, my + 2);
  });
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(mx - 8, my - 6, 1.8, 0, Math.PI * 2);
  g.fill();

  // 가는 길(빨간 화살표): 골목 → 우체통에서 왼쪽 → 끝에서 위로 → 트리 모퉁이에서 오른쪽 → 대문으로 쏙
  const route: [number, number][] = [[-4, 1.8], [17.4, 1.8], [17.4, -26.6], [36.6, -26.6], [36.6, 8.6], [41.5, 8.6]];
  crayon(g, route.map(([s0, t0]) => [fx(t0), fy(s0)] as [number, number]), '#e0342f', 5, 12);
  const [ex, ey] = [fx(8.6), fy(41.5)];
  crayon(g, [[ex - 8, ey + 8], [ex, ey], [ex + 8, ey + 8]], '#e0342f', 5, 13);
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
