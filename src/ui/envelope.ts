// 4장 시작: 수리 상자에 묶여 있던 산타 앞 봉투(명세서 §4 4장 첫 문단). 글자 없이 그림만.
//   ① 봉투(산타 모자 우표 + 수리 상자와 같은 집 그림 도장) → 행동(E·Enter·스페이스·화면 누르기)으로 펼친다
//   ② 사진 두 장이 나온다: 작년(환한 트리 앞 할머니와 아이들의 브이), 올해(불 꺼진 트리 위 노란 색연필 불빛)
//   ③ 한 번 더 누르면 사진을 내린다 → 눈앞에 같은 구도의 마당(게임 장면)
// 사진은 게임 장면을 할머니 사진기 구도로 찍은 그림(캔버스)을 받는다. 건너뛰기: 버튼·Esc.

const CSS = `
#envelope { position: fixed; inset: 0; z-index: 34; touch-action: none; }
#envelope canvas { width: 100%; height: 100%; display: block; }
#env-next { position: fixed; z-index: 35; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 22px); transform: translateX(-50%);
  width: 76px; height: 76px; border-radius: 50%; border: 4px solid #fff; background: #2f9a4a; box-shadow: 0 6px 16px rgba(0,0,0,0.4);
  display: grid; place-items: center; cursor: pointer; padding: 0; animation: env-pulse 1.1s ease-in-out infinite; }
#env-next svg { width: 46px; height: 46px; }
#env-next:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
#env-skip { position: fixed; z-index: 35; right: calc(env(safe-area-inset-right) + 16px); bottom: calc(env(safe-area-inset-bottom) + 16px);
  min-width: 48px; min-height: 48px; padding: 0 16px; border-radius: 24px; border: 3px solid #fff; background: rgba(27,36,51,0.7);
  color: #fff; font: 700 16px system-ui, sans-serif; cursor: pointer; }
@keyframes env-pulse { 0%,100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.08); } }
body.cutscene #controls, body.cutscene .action-btn { display: none !important; }
`;

const HAND =
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 44c-5-5-9-11-9-15 0-2 2-3 4-2l5 5V13a3 3 0 0 1 6 0v12V9a3 3 0 0 1 6 0v16V11a3 3 0 0 1 6 0v14-9a3 3 0 0 1 6 0v18c0 7-4 12-10 13h-6c-4 0-6-1-8-3z" fill="#fff" stroke="#1b2433" stroke-width="2.5" stroke-linejoin="round"/></svg>';

/** 집 그림 도장(수리 상자·봉투에 같은 것): 빨간 지붕 + 문 + 작은 트리 */
export function drawHouseStamp(g: CanvasRenderingContext2D, x: number, y: number, s: number, color = '#d23a3a'): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.beginPath();
  g.arc(0, 0, 34, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(-18, 2);
  g.lineTo(0, -16);
  g.lineTo(18, 2);
  g.moveTo(-13, 0);
  g.lineTo(-13, 18);
  g.lineTo(13, 18);
  g.lineTo(13, 0);
  g.stroke();
  g.fillStyle = color;
  g.fillRect(-4, 6, 8, 12);
  // 작은 트리
  g.beginPath();
  g.moveTo(22, 18);
  g.lineTo(27, 4);
  g.lineTo(32, 18);
  g.closePath();
  g.fill();
  g.restore();
}

export interface Envelope {
  /** 시각을 흘린다. 다 끝나 사진을 내렸으면 true */
  update(dt: number): boolean;
  /** 0 봉투 · 1 펼치는 중 · 2 사진 두 장(기다림) · 3 내리는 중 · 4 끝 */
  readonly stage: number;
  /** 건너뛰기로 끝났다(뒤 장면도 건너뛴다) */
  readonly skipped: boolean;
  next(): void;
  skip(): void;
  dispose(): void;
}

export function createEnvelope(doc: Document, photos: { lastYear: HTMLCanvasElement; thisYear: HTMLCanvasElement }): Envelope {
  let style = doc.getElementById('env-style') as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = 'env-style';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }
  const root = doc.createElement('div');
  root.id = 'envelope';
  const cv = doc.createElement('canvas');
  root.appendChild(cv);
  const next = doc.createElement('button');
  next.id = 'env-next';
  next.type = 'button';
  next.setAttribute('aria-label', '봉투 펼치기');
  next.innerHTML = HAND;
  const skipBtn = doc.createElement('button');
  skipBtn.id = 'env-skip';
  skipBtn.type = 'button';
  skipBtn.textContent = '건너뛰기 ▶▶';
  doc.body.append(root, next, skipBtn);
  doc.body.classList.add('cutscene');

  let stage = 0;
  let t = 0; // 이 단계에 들어온 뒤 시간
  const advance = () => {
    if (stage === 0) {
      stage = 1;
      t = 0;
    } else if (stage === 2) {
      stage = 3;
      t = 0;
      next.setAttribute('aria-label', '사진 내리기');
    }
  };
  let skipped = false;
  const finish = () => {
    stage = 4;
    skipped = true;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') finish();
    else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter' || e.code === 'Slash') {
      e.preventDefault();
      advance();
    }
  };
  window.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', advance);
  next.addEventListener('click', advance);
  skipBtn.addEventListener('click', finish);

  const ease = (x: number) => {
    const k = Math.min(1, Math.max(0, x));
    return k * k * (3 - 2 * k);
  };
  const g = cv.getContext('2d')!;

  function photo(img: HTMLCanvasElement, cx: number, cy: number, w: number, rot: number, alpha: number): void {
    const h = (w * img.height) / img.width;
    g.save();
    g.globalAlpha = alpha;
    g.translate(cx, cy);
    g.rotate(rot);
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 6;
    const pad = w * 0.045;
    g.fillStyle = '#fbfaf6';
    g.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 3.2);
    g.shadowColor = 'transparent';
    g.drawImage(img, -w / 2, -h / 2, w, h);
    g.restore();
  }

  function envelopeArt(cx: number, cy: number, w: number, open: number): void {
    const h = w * 0.62;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = '#efe3c8';
    g.strokeStyle = '#b89a6a';
    g.lineWidth = 3;
    // 뒷면 + 아래 접힘
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.beginPath();
    g.moveTo(-w / 2, h / 2);
    g.lineTo(0, 0);
    g.lineTo(w / 2, h / 2);
    g.stroke();
    // 위 덮개(열리면 뒤로 접힌다)
    const flapY = -h / 2 + h * 0.55 * (1 - 2 * open);
    g.fillStyle = open > 0.5 ? '#e4d4b0' : '#f3e8d0';
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(0, flapY);
    g.lineTo(w / 2, -h / 2);
    g.closePath();
    g.fill();
    g.stroke();
    if (open < 0.5) {
      // 우표: 산타 모자 + 흰 털
      g.fillStyle = '#fff';
      g.fillRect(w / 2 - w * 0.2, -h / 2 + h * 0.08, w * 0.15, w * 0.17);
      g.strokeStyle = '#d23a3a';
      g.lineWidth = 2;
      g.setLineDash([4, 3]);
      g.strokeRect(w / 2 - w * 0.2, -h / 2 + h * 0.08, w * 0.15, w * 0.17);
      g.setLineDash([]);
      const sx = w / 2 - w * 0.125, sy = -h / 2 + h * 0.08 + w * 0.1;
      g.fillStyle = '#d23a3a';
      g.beginPath();
      g.moveTo(sx - w * 0.05, sy + w * 0.02);
      g.lineTo(sx + w * 0.02, sy - w * 0.07);
      g.lineTo(sx + w * 0.05, sy + w * 0.02);
      g.closePath();
      g.fill();
      g.fillStyle = '#f2f2f2';
      g.fillRect(sx - w * 0.055, sy + w * 0.015, w * 0.11, w * 0.022);
      // 같은 집 그림 도장
      drawHouseStamp(g, -w * 0.18, h * 0.12, w / 260);
    }
    g.restore();
  }

  function draw(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 어두운 바탕(사진을 내리면 걷힌다)
    const dim = stage === 3 ? 1 - ease(t / 0.9) : stage >= 4 ? 0 : 1;
    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(20, 26, 40, ${0.82 * dim})`;
    g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.47;
    const big = Math.min(W * 0.36, H * 0.55);
    if (stage === 0 || stage === 1) {
      const open = stage === 1 ? ease(t / 0.6) : 0;
      // 사진이 봉투에서 쑥 올라온다
      if (stage === 1 && t > 0.5) {
        const up = ease((t - 0.5) / 0.7);
        photo(photos.thisYear, cx + 8, cy - big * 0.35 * up, big * 0.9, 0.03, 1);
        photo(photos.lastYear, cx - 8, cy - big * 0.42 * up, big * 0.9, -0.04, 1);
      }
      envelopeArt(cx, cy + big * 0.25, big * 1.25, open);
    } else {
      // 두 장을 나란히: 왼쪽 작년(환한 트리), 오른쪽 올해(불 꺼진 트리 + 노란 색연필 불빛)
      const spread = stage === 2 ? ease(t / 0.6) : 1;
      const down = stage === 3 ? ease(t / 0.9) : 0;
      const w = big * (0.9 + 0.15 * spread);
      const gap = w * 0.58 * spread;
      const y = cy - big * 0.35 * (1 - spread) + down * H * 0.7;
      photo(photos.lastYear, cx - gap, y, w, -0.05 * spread, 1 - down * 0.6);
      photo(photos.thisYear, cx + gap, y + 6, w, 0.04 * spread, 1 - down * 0.6);
    }
  }

  return {
    get stage() {
      return stage;
    },
    get skipped() {
      return skipped;
    },
    update(dt) {
      t += dt;
      if (stage === 1 && t > 1.8) {
        stage = 2;
        t = 0;
      }
      if (stage === 3 && t > 1.0) stage = 4;
      next.style.display = stage === 0 || stage === 2 ? 'grid' : 'none';
      if (stage < 4) draw();
      return stage >= 4;
    },
    next: advance,
    skip: finish,
    dispose() {
      window.removeEventListener('keydown', onKey);
      root.remove();
      next.remove();
      skipBtn.remove();
    },
  };
}

/**
 * 4장 끝: 찰칵 → 화면을 채운 올해 사진 → 작년 사진이 아래에서 올라와 같은 구도로 포개진다(반투명으로 겹쳐 같은 자리임을 보인다).
 * t: 사진이 나타난 뒤 시간(초). overlayAt: 작년 사진이 올라오기 시작하는 t
 */
export function createPhotoStack(doc: Document, thisYear: HTMLCanvasElement, lastYear: HTMLCanvasElement, overlayAt: number, overlayDur: number) {
  const cv = doc.createElement('canvas');
  cv.id = 'photo-stack';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:33;pointer-events:none';
  doc.body.appendChild(cv);
  const g = cv.getContext('2d')!;
  const ease = (x: number) => {
    const k = Math.min(1, Math.max(0, x));
    return k * k * (3 - 2 * k);
  };
  return {
    update(t: number) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      // 흰 번쩍 → 올해 사진(액자)이 화면을 채운다
      const appear = ease(t / 0.6);
      g.fillStyle = `rgba(20, 26, 40, ${0.85 * appear})`;
      g.fillRect(0, 0, W, H);
      const w = Math.min(W * 0.78, ((H * 0.78) * 4) / 3);
      const h = (w * 3) / 4;
      const cx = W / 2, cy = H / 2;
      const frame = (img: HTMLCanvasElement, x: number, y: number, rot: number, alpha: number) => {
        g.save();
        g.globalAlpha = alpha;
        g.translate(x, y);
        g.rotate(rot);
        const pad = w * 0.035;
        g.shadowColor = 'rgba(0,0,0,0.4)';
        g.shadowBlur = 24;
        g.fillStyle = '#fbfaf6';
        g.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 3);
        g.shadowColor = 'transparent';
        g.drawImage(img, -w / 2, -h / 2, w, h);
        g.restore();
      };
      frame(thisYear, cx, cy - h * 0.02, 0, appear);
      const k = ease((t - overlayAt) / overlayDur);
      if (k > 0) {
        // 작년 사진: 아래에서 비스듬히 올라와 같은 자리에 똑바로 → 반쯤 비쳐 두 사진이 겹친다
        const y = cy - h * 0.02 + (1 - k) * H * 0.75;
        frame(lastYear, cx + (1 - k) * w * 0.25, y, (1 - k) * 0.18, k < 1 ? 1 : 0.55 + 0.45 * Math.cos(Math.min(1, (t - overlayAt - overlayDur) / 3) * Math.PI));
      }
      // 처음 번쩍
      const flash = Math.max(0, 1 - t / 0.35);
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash})`;
        g.fillRect(0, 0, W, H);
      }
    },
    dispose() {
      cv.remove();
    },
  };
}
