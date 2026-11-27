// 여러 기기: 한 요정의 연결이 끊기거나 다시 들어왔을 때 장 상태를 고친다(방장만 부른다).
// 장마다 상태 모양이 다르지만 공통 규칙은 같다:
//   - 끊긴 요정은 멈추고(connected=false) 판정에서 빠진다(각 장 규칙이 connected를 본다).
//   - 들고 있던 것은 그 자리에 내려놓는다(복제·공중 부양 없음). 2장식 함께 들기는 손잡이만 놓는다.
//   - 다시 들어오면 같은 자리(slot)로 이어서, 빈손으로 선다.
import { playerLeft, playerRejoined, type SewingState } from './sewing';

type Pos = { x: number; z: number };
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSewing = (v: unknown): v is SewingState => isObj(v) && Array.isArray(v.players) && isObj(v.crate) && Array.isArray(v.handles);

function dropAt(o: Obj, key: 'carriedBy' | 'holder', id: string, at: Pos): Obj {
  return o[key] === id ? { ...o, [key]: null, ...('x' in o ? { x: at.x, z: at.z } : {}) } : o;
}

/** 이 요정이 나갔다: 멈추고 들고 있던 것을 그 자리에 놓는다 */
export function playerGone<S>(state: S, id: string): S {
  if (isSewing(state)) return playerLeft(state, id).state as S;
  if (!isObj(state)) return state;
  const s = state as Obj;
  const players = Array.isArray(s.players) ? (s.players as (Obj & Pos & { id: string })[]) : [];
  const me = players.find((p) => p.id === id) ?? (isSewing(s.sewing) ? s.sewing.players.find((p) => p.id === id) : undefined);
  if (!me) return state;
  const at = { x: me.x, z: me.z };
  const out: Obj = { ...s };
  if (players.length)
    out.players = players.map((p) =>
      p.id === id ? { ...p, connected: false, moving: false, ...('handUp' in p ? { handUp: false } : {}), ...('mapOpen' in p ? { mapOpen: false } : {}) } : p,
    );
  if (Array.isArray(s.items)) out.items = (s.items as Obj[]).map((it) => dropAt(it, 'carriedBy', id, at));
  if (isObj(s.ball)) out.ball = dropAt(s.ball, 'carriedBy', id, at);
  if (isObj(s.globe)) out.globe = dropAt(s.globe, 'holder', id, at);
  if (s.cranking === id) out.cranking = null;
  if (isSewing(s.sewing)) out.sewing = playerLeft(s.sewing, id).state;
  return out as S;
}

/** 이 요정이 다시 들어왔다: 같은 자리로, 빈손으로 */
export function playerBack<S>(state: S, id: string): S {
  if (isSewing(state)) return playerRejoined(state, id) as S;
  if (!isObj(state)) return state;
  const s = state as Obj;
  const out: Obj = { ...s };
  if (Array.isArray(s.players)) out.players = (s.players as (Obj & { id: string })[]).map((p) => (p.id === id ? { ...p, connected: true, moving: false } : p));
  if (isSewing(s.sewing)) out.sewing = playerRejoined(s.sewing, id);
  return out as S;
}
