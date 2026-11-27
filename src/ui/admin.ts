// 관리자 모드(교사·개발자가 혼자 게임을 점검할 때). 주소에 `?admin`을 붙이면 켜지고, 이 창(탭)에서는 장이 넘어가도 유지된다.
// - 왼쪽 위 「관리」 단추 → 판: 이야기 모드 처음부터·이어서, 장 하나만 처음부터(첫 연출 포함), 지금 장 바로 끝내기(끝 장면 보기),
//   연출 건너뛰기, 관리자 모드 끄기. 혼자 두 요정을 움직이는 키 안내.
// - 학생 화면에는 보이지 않는다(주소를 알아야 켤 수 있다). 판정·저장 규칙은 바꾸지 않고, 시험용 창구(window.__lastgift)를 부를 뿐이다.

const FLAG = 'lastgift.admin';

/** 관리자 모드인가: 주소에 admin이 있거나, 이 탭에서 이미 켰다 */
export function isAdmin(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('admin')) {
      sessionStorage.setItem(FLAG, '1');
      return true;
    }
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return new URLSearchParams(location.search).has('admin');
  }
}

type Hooks = Record<string, ((...a: unknown[]) => unknown) | undefined>;
const hooks = () => ((window as unknown as { __lastgift?: Hooks }).__lastgift ?? {}) as Hooks;

/** 저장 지우기: 이야기 모드('story') 또는 장 하나('dev-chN') */
function clearSave(room: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)!;
      if (k === `lastgift.cp.v1.${room}` || k.startsWith(`lastgift.intro.${room}.`)) localStorage.removeItem(k);
    }
  } catch {
    /* 저장소를 못 쓰면 지울 것도 없다 */
  }
}

function go(search: string): void {
  const u = new URL(location.href);
  u.search = search;
  location.href = u.toString();
}

const CSS = `
#admin-btn { position: fixed; z-index: 60; left: calc(env(safe-area-inset-left) + 12px); top: calc(env(safe-area-inset-top) + 58px);
  font: 700 14px/1 system-ui, sans-serif; color: #fff; background: #7a3fc4; border: 2px solid #fff; border-radius: 999px; padding: 8px 14px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35); cursor: pointer; }
#admin-panel { position: fixed; z-index: 61; left: calc(env(safe-area-inset-left) + 12px); top: calc(env(safe-area-inset-top) + 100px);
  width: min(360px, calc(100vw - 24px)); max-height: calc(100vh - 120px); overflow: auto; display: none;
  background: rgba(24, 26, 40, 0.94); color: #f4f1ff; border-radius: 14px; padding: 12px 14px; font: 14px/1.45 system-ui, sans-serif;
  box-shadow: 0 6px 20px rgba(0,0,0,0.45); }
#admin-panel.on { display: block; }
#admin-panel h2 { font-size: 15px; margin: 4px 0 8px; }
#admin-panel h3 { font-size: 13px; margin: 12px 0 6px; color: #cdbdf5; font-weight: 700; }
#admin-panel .row { display: flex; flex-wrap: wrap; gap: 6px; }
#admin-panel button { font: 600 14px/1 system-ui, sans-serif; padding: 9px 11px; border-radius: 9px; border: 0; background: #ece6ff; color: #2a1f45; cursor: pointer; min-height: 36px; }
#admin-panel button.go { background: #ffd84a; }
#admin-panel button:disabled { opacity: 0.4; cursor: default; }
#admin-panel .note { font-size: 12.5px; color: #d6d0ea; margin-top: 4px; }
#admin-panel .now { font-size: 12.5px; color: #ffd84a; }
`;

/** 왼쪽 위 「관리」 단추와 판. chapter: 지금 연 장(이야기 모드면 null) */
export function createAdminPanel(doc: Document, chapter: number | null): void {
  if (doc.getElementById('admin-btn')) return;
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  const btn = doc.createElement('button');
  btn.id = 'admin-btn';
  btn.type = 'button';
  btn.textContent = '관리';
  const panel = doc.createElement('div');
  panel.id = 'admin-panel';
  const chapters: [number, string][] = [
    [0, '0장(프롤로그부터)'],
    [1, '1장'],
    [2, '2장'],
    [3, '3장'],
    [4, '4장'],
    [5, '5장'],
    [6, '6장'],
  ];
  panel.innerHTML = `
    <h2>관리자 점검</h2>
    <div class="now">${chapter === null ? '지금: 이야기 모드' : `지금: ${chapter}장만`}</div>
    <h3>이야기 모드(0~6장 이어서)</h3>
    <div class="row"><button type="button" class="go" data-act="story-new">처음부터</button><button type="button" data-act="story">이어서</button></div>
    <h3>장 하나만 처음부터(첫 연출 포함)</h3>
    <div class="row">${chapters.map(([n, t]) => `<button type="button" data-ch="${n}">${t}</button>`).join('')}</div>
    <h3>지금 장</h3>
    <div class="row">
      <button type="button" class="go" data-act="win">바로 끝내기(끝 장면 보기)</button>
      <button type="button" data-act="skip">연출 건너뛰기</button>
      <button type="button" data-act="restart">이 장 처음부터</button>
    </div>
    <div class="note">혼자 두 요정 움직이기: 1P = WASD + E, 2P = 방향키 + Enter</div>
    <h3>끄기</h3>
    <div class="row"><button type="button" data-act="off">관리자 모드 끄기</button></div>
  `;
  doc.body.append(btn, panel);
  btn.addEventListener('click', () => panel.classList.toggle('on'));
  panel.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b) return;
    const ch = b.dataset.ch;
    if (ch !== undefined) {
      clearSave(`dev-ch${ch}`);
      // 5·6장은 같은 장면(5장 저장 칸에서 6장으로 이어진다)
      if (ch === '6') clearSave('dev-ch5');
      go(`?chapter=${ch}&admin`);
      return;
    }
    switch (b.dataset.act) {
      case 'story-new':
        clearSave('story');
        go('?admin');
        break;
      case 'story':
        go('?admin');
        break;
      case 'restart':
        clearSave(chapter === null ? 'story' : `dev-ch${chapter}`);
        location.reload();
        break;
      case 'win': {
        const h = hooks();
        if (chapter === 5 || chapter === 6 || (h.finale && h.debugWin)) {
          // 5장: 가방 열기 → 네 빛·스노글로브, 6장: 건네기 → 끝 장면
          const f = h.finale?.() as { chapter?: number } | undefined;
          h.debugWin?.((f?.chapter ?? chapter) === 6 ? 'deliver' : 'opened', 'p0');
        } else h.debugWin?.();
        panel.classList.remove('on');
        break;
      }
      case 'skip': {
        const h = hooks();
        h.skipPrologue?.();
        h.skipClip?.();
        // 화면에 떠 있는 「건너뛰기」 단추(프롤로그·그림책·봉투·단체사진·끝 장면)
        for (const el of doc.querySelectorAll<HTMLElement>('#pro-skip, #env-skip, #clip-skip, #ending-skip, #storybook > button')) {
          if (el.offsetParent !== null || el.id === 'pro-skip') el.click();
        }
        panel.classList.remove('on');
        break;
      }
      case 'off':
        try {
          sessionStorage.removeItem('lastgift.admin');
        } catch {
          /* 무시 */
        }
        go(new URLSearchParams(location.search).get('chapter') ? `?chapter=${new URLSearchParams(location.search).get('chapter')}` : '');
        break;
    }
  });
}
