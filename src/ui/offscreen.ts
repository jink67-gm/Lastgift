// 화면 밖 친구 표시: 요정이 화면 밖(또는 가장자리 바로 앞)에 있으면 그쪽 화면 가장자리에 모자 색 동그라미 + 화살표.
// 위치는 화면 좌표로 받는다(카메라·three.js와 분리). 버튼·시계와 겹치지 않게 가장자리 안쪽 여백을 둔다.

const CSS = `
.offscreen-mark { position: fixed; z-index: 15; width: 44px; height: 44px; margin: -22px 0 0 -22px; pointer-events: none; display: none; }
.offscreen-mark.on { display: block; }
.offscreen-mark .dot { position: absolute; inset: 6px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 2px #1b2433; }
.offscreen-mark .arrow { position: absolute; left: 50%; top: 50%; width: 0; height: 0; margin: -9px 0 0 -2px;
  border-left: 16px solid #fff; border-top: 9px solid transparent; border-bottom: 9px solid transparent;
  transform-origin: 2px 9px; filter: drop-shadow(0 0 1.5px #1b2433); }
`;

export interface OffscreenMarks {
  /** players: 화면 좌표(px)와 모자 색. 화면 안이면 표시하지 않는다 */
  update(players: { x: number; y: number; color: string }[], width: number, height: number): void;
}

export function createOffscreenMarks(doc: Document, count: number): OffscreenMarks {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  const marks = Array.from({ length: count }, () => {
    const el = doc.createElement('div');
    el.className = 'offscreen-mark';
    el.innerHTML = '<div class="arrow"></div><div class="dot"></div>';
    doc.body.appendChild(el);
    return el;
  });
  return {
    update(players, w, h) {
      const pad = 34; // 가장자리 여백(이 안으로 들어오면 화면 안으로 본다)
      const top = 80; // 위쪽은 시계·설정 버튼 아래
      players.forEach((p, i) => {
        const el = marks[i];
        if (!el) return;
        const inside = p.x >= pad && p.x <= w - pad && p.y >= top && p.y <= h - pad;
        el.classList.toggle('on', !inside);
        if (inside) return;
        const cx = Math.min(w - pad, Math.max(pad, p.x));
        const cy = Math.min(h - pad, Math.max(top, p.y));
        el.style.left = `${cx}px`;
        el.style.top = `${cy}px`;
        (el.querySelector('.dot') as HTMLElement).style.background = p.color;
        const ang = Math.atan2(p.y - cy, p.x - cx);
        (el.querySelector('.arrow') as HTMLElement).style.transform = `rotate(${ang}rad) translateX(16px)`;
      });
    },
  };
}
