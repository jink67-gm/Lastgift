// Firebase 보안 규칙 시험(에뮬레이터에서만): `npm run test:net`
// 방장만 방 정보를 쓰고, 참가자는 자기 자리만 쓰고, 신호는 받는 사람만 읽는다.
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, push, ref, remove, serverTimestamp, set, type Database } from 'firebase/database';
import { afterAll, describe, expect, it } from 'vitest';
import { EMULATOR, emulatorConfig } from '../../src/net/firebaseConfig';

const apps: FirebaseApp[] = [];
async function client(name: string): Promise<{ db: Database; uid: string }> {
  const app = initializeApp(emulatorConfig, `${name}-${Math.random()}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, EMULATOR.authUrl, { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, EMULATOR.dbHost, EMULATOR.dbPort);
  const cred = await signInAnonymously(auth);
  return { db, uid: cred.user.uid };
}

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)));
});

const denied = async (p: PromiseLike<unknown>) => {
  await expect(Promise.resolve(p)).rejects.toThrow(/permission|denied/i);
};

describe('lastgiftRooms 보안 규칙', () => {
  it('방장·참가자·다른 사람의 권한', async () => {
    const host = await client('host');
    const guest = await client('guest');
    const other = await client('other');
    const code = 'K7M3Q';
    const room = (db: Database, p: string) => ref(db, `lastgiftRooms/${code}/${p}`);

    // 방장이 방을 만든다(만료는 3시간까지만)
    await set(room(host.db, 'meta'), { host: host.uid, created: serverTimestamp(), expires: Date.now() + 3 * 3600_000 });
    await denied(set(ref(host.db, `lastgiftRooms/BAD01/meta`), { host: host.uid, created: serverTimestamp(), expires: Date.now() + 1000 })); // 코드 모양
    await denied(set(ref(host.db, `lastgiftRooms/K7M3R/meta`), { host: host.uid, created: serverTimestamp(), expires: Date.now() + 10 * 3600_000 })); // 너무 긴 만료
    // 다른 사람은 방장 정보를 바꾸지 못한다
    await denied(set(room(other.db, 'meta'), { host: other.uid, created: serverTimestamp(), expires: Date.now() + 1000 }));

    // 참가자는 자기 자리만 쓴다
    await set(room(guest.db, `members/${guest.uid}`), { name: '눈송이 요정', at: serverTimestamp() });
    await denied(set(room(guest.db, `members/${other.uid}`), { name: '사칭', at: serverTimestamp() }));
    await denied(set(room(other.db, `members/${other.uid}`), { name: 'x'.repeat(20), at: serverTimestamp() })); // 이름 길이

    // 신호: 참가자 → 방장, 방장 → 참가자만. 멤버가 아니면 방장에게도 못 보낸다
    const sig = (from: string, kind = 'offer') => ({ from, kind, link: 'L1', data: '{}', at: serverTimestamp() });
    await push(room(guest.db, `signals/${host.uid}`), sig(guest.uid));
    await push(room(host.db, `signals/${guest.uid}`), sig(host.uid));
    await denied(push(room(other.db, `signals/${host.uid}`), sig(other.uid)));
    await denied(push(room(guest.db, `signals/${other.uid}`), sig(guest.uid))); // 참가자끼리는 안 됨
    await denied(push(room(guest.db, `signals/${host.uid}`), sig(host.uid))); // from 사칭
    await denied(push(room(guest.db, `signals/${host.uid}`), sig(guest.uid, 'script')));

    // 받은 편지함은 받는 사람만 읽고 지운다
    expect((await get(room(host.db, `signals/${host.uid}`))).exists()).toBe(true);
    await denied(get(room(guest.db, `signals/${host.uid}`)));
    await denied(get(room(other.db, `signals/${guest.uid}`)));
    await remove(room(guest.db, `signals/${guest.uid}`));
    await denied(remove(room(other.db, `signals/${host.uid}`)));

    // 방 전체는 방장만 지운다
    await denied(remove(ref(guest.db, `lastgiftRooms/${code}`)));
    await remove(ref(host.db, `lastgiftRooms/${code}`));

    // 〈수학 대륙〉 경로(rooms)는 그 게임 규칙 그대로 남아 있다
    await set(ref(host.db, 'rooms/1234/meta'), { host: host.uid });
    await denied(set(ref(guest.db, 'rooms/1234/meta'), { host: guest.uid }));
  }, 30_000);
});
