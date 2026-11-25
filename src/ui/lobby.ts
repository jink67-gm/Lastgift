// 로비: 고르기 · 방장 대기실 · 참가자 대기실. 기능 버튼과 접속 오류만 짧은 한국어로 쓴다(대사 없음).
// 모든 버튼은 키보드(Tab·Enter)로도 누를 수 있고 48px 이상이다.
import { ELF_LOOKS } from '../data/elves';
import type { TeamEntry } from '../net/protocol';
import { ROOM_CODE_LEN } from '../net/signaling';

const CSS = `
#lobby { position: fixed; inset: 0; z-index: 40; display: none; place-items: center; overflow: auto;
  background: rgba(27, 36, 51, 0.92); color: #fff; padding: 24px 16px; box-sizing: border-box;
  font: 500 18px/1.4 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
#lobby.on { display: grid; }
#lobby .card { width: min(560px, 100%); display: grid; gap: 16px; justify-items: stretch; }
#lobby h1 { margin: 0; font-size: 26px; text-align: center; }
#lobby button, #lobby input { min-height: 56px; border-radius: 16px; font: 700 20px/1 system-ui, sans-serif; }
#lobby button { border: 3px solid #fff; background: #2f6fd0; color: #fff; cursor: pointer; padding: 0 20px; }
#lobby button.alt { background: transparent; }
#lobby button.go { background: #2f9a4a; }
#lobby button:disabled { opacity: 0.4; cursor: default; }
#lobby button:focus-visible, #lobby input:focus-visible { outline: 4px solid #ffd84a; outline-offset: 3px; }
#lobby input { border: 3px solid #fff; padding: 0 16px; text-transform: uppercase; letter-spacing: 6px; text-align: center; min-width: 0; }
#lobby .row { display: flex; gap: 8px; }
#lobby .row > * { flex: 1; }
#lobby .code { font: 800 56px/1 ui-monospace, monospace; letter-spacing: 10px; text-align: center; }
#lobby .link { font-size: 14px; word-break: break-all; opacity: 0.8; text-align: center; }
#lobby .team { display: grid; gap: 8px; }
#lobby .member { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 12px; background: rgba(255,255,255,0.08); }
#lobby .hat { width: 28px; height: 28px; border-radius: 50% 50% 6px 6px; border: 2px solid #fff; }
#lobby .dot { margin-left: auto; width: 14px; height: 14px; border-radius: 50%; background: #5fd36a; }
#lobby .dot.off { background: #888; }
#lobby .msg { text-align: center; min-height: 1.4em; }
#lobby .msg.err { color: #ffd84a; }
`;

export interface Lobby {
  showChooser(h: { onLocal(): void; onHost(): void; onJoin(code: string): void }): void;
  showHost(v: { code: string; link: string; team: TeamEntry[]; canStart: boolean; onStart(): void }): void;
  showGuest(v: { name: string; team: TeamEntry[]; message: string; error?: boolean; onRetry?: () => void }): void;
  showMessage(message: string, error?: boolean): void;
  hide(): void;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function teamHtml(team: TeamEntry[]): string {
  return team
    .map((m) => {
      const look = ELF_LOOKS[Number(m.slot.slice(1))]!;
      return `<div class="member" data-slot="${m.slot}"><span class="hat" style="background:${look.hat}"></span><span>${esc(m.name)}</span><span class="dot ${m.connected ? '' : 'off'}" aria-label="${m.connected ? '연결됨' : '연결 끊김'}"></span></div>`;
    })
    .join('');
}

export function createLobby(doc: Document): Lobby {
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.appendChild(style);
  const root = doc.createElement('div');
  root.id = 'lobby';
  doc.body.appendChild(root);

  let hostKey = '';
  let onStart: () => void = () => {};
  return {
    showChooser(h) {
      root.className = 'on';
      root.innerHTML = `<div class="card">
        <h1>수선집 재봉틀</h1>
        <button type="button" class="go" data-act="host">방 만들기</button>
        <form class="row" data-act="join"><input name="code" maxlength="${ROOM_CODE_LEN + 2}" placeholder="코드" aria-label="방 코드" autocomplete="off" /><button type="submit">참가</button></form>
        <button type="button" class="alt" data-act="local">한 기기에서 둘이</button>
      </div>`;
      root.querySelector<HTMLButtonElement>('[data-act=host]')!.onclick = () => h.onHost();
      root.querySelector<HTMLButtonElement>('[data-act=local]')!.onclick = () => h.onLocal();
      const form = root.querySelector<HTMLFormElement>('form')!;
      form.onsubmit = (e) => {
        e.preventDefault();
        const code = (form.elements.namedItem('code') as HTMLInputElement).value.trim();
        if (code) h.onJoin(code);
      };
      root.querySelector<HTMLButtonElement>('[data-act=host]')!.focus();
    },
    showHost(v) {
      onStart = v.onStart;
      const key = `${v.code}|${v.link}`;
      if (key !== hostKey || !root.querySelector('.code')) {
        hostKey = key;
        root.className = 'on';
        root.innerHTML = `<div class="card">
          <div class="code" data-code="${esc(v.code)}">${esc(v.code)}</div>
          <div class="link">${esc(v.link)}</div>
          <button type="button" class="alt" data-act="copy">링크 복사</button>
          <div class="team"></div>
          <button type="button" class="go" data-act="start">시작</button>
        </div>`;
        root.querySelector<HTMLButtonElement>('[data-act=copy]')!.onclick = async () => {
          try {
            await navigator.clipboard.writeText(v.link);
          } catch {
            /* 복사가 막힌 브라우저: 링크 글자를 직접 고른다 */
          }
        };
        root.querySelector<HTMLButtonElement>('[data-act=start]')!.onclick = () => onStart();
      }
      root.querySelector('.team')!.innerHTML = teamHtml(v.team);
      root.querySelector<HTMLButtonElement>('[data-act=start]')!.disabled = !v.canStart;
    },
    showGuest(v) {
      hostKey = '';
      root.className = 'on';
      root.innerHTML = `<div class="card">
        <h1>${esc(v.name)}</h1>
        <div class="team">${teamHtml(v.team)}</div>
        <div class="msg ${v.error ? 'err' : ''}" role="status">${esc(v.message)}</div>
        ${v.onRetry ? '<button type="button" data-act="retry">다시 연결</button>' : ''}
      </div>`;
      if (v.onRetry) {
        const b = root.querySelector<HTMLButtonElement>('[data-act=retry]')!;
        b.onclick = () => v.onRetry!();
        b.focus();
      }
    },
    showMessage(message, error) {
      hostKey = '';
      root.className = 'on';
      root.innerHTML = `<div class="card"><div class="msg ${error ? 'err' : ''}" role="status">${esc(message)}</div></div>`;
    },
    hide() {
      hostKey = '';
      root.className = '';
      root.innerHTML = '';
    },
  };
}
