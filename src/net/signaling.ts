// 시그널링(처음 소개)만 Firebase Realtime Database로 한다. 게임 데이터는 WebRTC로 기기끼리 직접.
//
// lastgiftRooms/{code}
//   meta               { host: uid, created: 서버시각, expires: ms }   ← 방장만 쓴다. 3시간 뒤 만료
//   members/{uid}      { name, at: 서버시각 }                          ← 참가자가 자기 것만 쓴다(다시 쓰면 재접속 요청)
//   signals/{to}/{id}  { from, kind, link, data, at }                  ← 받는 사람만 읽고 지운다
//
// 익명 로그인 uid가 곧 이 기기의 자리 표시다. 같은 기기에서 새로고침하면 같은 uid로 돌아온다.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  connectDatabaseEmulator,
  get,
  getDatabase,
  onChildAdded,
  onChildChanged,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  type Database,
} from 'firebase/database';
import { EMULATOR, emulatorConfig, firebaseConfig, isFirebaseConfigured } from './firebaseConfig';

export const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LEN = 5;
export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const ROOT = 'lastgiftRooms';

export type SignalKind = 'offer' | 'answer' | 'ice';

export interface SignalMsg {
  from: string;
  kind: SignalKind;
  /** 어느 연결 시도에 속한 신호인지(낡은 신호를 거른다) */
  link: string;
  data: string;
}

export interface MemberInfo {
  name: string;
  at: number;
}

export function isRoomCode(s: string): boolean {
  return s.length === ROOM_CODE_LEN && [...s].every((c) => ROOM_ALPHABET.includes(c));
}

export function newRoomCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) s += ROOM_ALPHABET[Math.floor(rand() * ROOM_ALPHABET.length)];
  return s;
}

/** 사람이 입력한 코드를 정리(소문자·공백·붙임표). 코드에는 0·1·I·O를 쓰지 않는다 */
export function normalizeRoomCode(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, '');
}

export class RoomError extends Error {
  constructor(readonly code: 'notFound' | 'expired' | 'unavailable' | 'notConfigured') {
    super(code);
  }
}

export class FirebaseSignaling {
  private constructor(
    private readonly db: Database,
    readonly uid: string,
  ) {}

  private room = '';
  private unsubs: (() => void)[] = [];

  static async connect(useEmulator: boolean): Promise<FirebaseSignaling> {
    if (!useEmulator && !isFirebaseConfigured()) throw new RoomError('notConfigured');
    let app: FirebaseApp;
    try {
      app = initializeApp(useEmulator ? emulatorConfig : firebaseConfig, 'lastgift');
    } catch {
      throw new RoomError('unavailable');
    }
    const auth = getAuth(app);
    const db = getDatabase(app);
    if (useEmulator) {
      connectAuthEmulator(auth, EMULATOR.authUrl, { disableWarnings: true });
      connectDatabaseEmulator(db, EMULATOR.dbHost, EMULATOR.dbPort);
    }
    try {
      const cred = await signInAnonymously(auth);
      return new FirebaseSignaling(db, cred.user.uid);
    } catch {
      throw new RoomError('unavailable');
    }
  }

  get code(): string {
    return this.room;
  }

  private path(p: string): string {
    return `${ROOT}/${this.room}/${p}`;
  }

  /** 방장: 새 방을 만든다(코드가 겹치면 다시 뽑는다) */
  async createRoom(): Promise<string> {
    for (let tries = 0; tries < 8; tries++) {
      const code = newRoomCode();
      const meta = await get(ref(this.db, `${ROOT}/${code}/meta`));
      if (meta.exists() && (meta.val() as { expires: number }).expires > Date.now()) continue;
      this.room = code;
      await set(ref(this.db, this.path('meta')), { host: this.uid, created: serverTimestamp(), expires: Date.now() + ROOM_TTL_MS });
      await remove(ref(this.db, this.path(`signals/${this.uid}`)));
      return code;
    }
    throw new RoomError('unavailable');
  }

  /** 방장: 같은 기기에서 다시 열 때 예전 방을 이어 쓴다(같은 uid일 때만) */
  async resumeRoom(code: string): Promise<boolean> {
    const meta = await get(ref(this.db, `${ROOT}/${code}/meta`));
    if (!meta.exists()) return false;
    const m = meta.val() as { host: string; expires: number };
    if (m.host !== this.uid || m.expires <= Date.now()) return false;
    this.room = code;
    await remove(ref(this.db, this.path(`signals/${this.uid}`)));
    return true;
  }

  /** 참가자: 방에 들어간다. 다시 부르면 방장에게 재접속을 알린다. 방장 uid를 돌려준다 */
  async joinRoom(code: string, name: string): Promise<string> {
    const meta = await get(ref(this.db, `${ROOT}/${code}/meta`));
    if (!meta.exists()) throw new RoomError('notFound');
    const m = meta.val() as { host: string; expires: number };
    if (m.expires <= Date.now()) throw new RoomError('expired');
    const first = this.room !== code;
    this.room = code;
    // 처음 들어갈 때만 예전 세션의 낡은 신호를 비운다(재접속 요청 때는 이미 구독 중이다)
    if (first) await remove(ref(this.db, this.path(`signals/${this.uid}`)));
    await set(ref(this.db, this.path(`members/${this.uid}`)), { name, at: serverTimestamp() });
    return m.host;
  }

  /** 방장: 참가자가 들어오거나(added) 다시 접속을 요청하면(changed) 알려 준다 */
  onMember(fn: (uid: string, info: MemberInfo) => void): void {
    const r = ref(this.db, this.path('members'));
    const h = (snap: { key: string | null; val(): unknown }) => {
      if (snap.key) fn(snap.key, snap.val() as MemberInfo);
    };
    this.unsubs.push(onChildAdded(r, h), onChildChanged(r, h));
  }

  /** 내 받은 편지함: 읽은 신호는 바로 지운다 */
  onSignal(fn: (m: SignalMsg) => void): void {
    const r = ref(this.db, this.path(`signals/${this.uid}`));
    this.unsubs.push(
      onChildAdded(r, (snap) => {
        const v = snap.val() as SignalMsg | null;
        void remove(snap.ref);
        if (v && typeof v.data === 'string' && typeof v.link === 'string') fn(v);
      }),
    );
  }

  async send(to: string, kind: SignalKind, link: string, data: string): Promise<void> {
    await push(ref(this.db, this.path(`signals/${to}`)), { from: this.uid, kind, link, data, at: serverTimestamp() });
  }

  close(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}
