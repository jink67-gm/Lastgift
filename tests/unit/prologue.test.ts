import { describe, expect, it } from 'vitest';
import { beatAt, isPhotoSetup, PHOTO_SPOT, photoLineup, PROLOGUE, seg } from '../../src/core/prologue';
import { createRun, fromCheckpoint, reduce, remainingAt, toCheckpoint } from '../../src/core/run';
import { CheckpointStore, type KeyValue } from '../../src/save/store';

class MemoryKV implements KeyValue {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('프롤로그 시간표', () => {
  it('순서: 썰매 비행 → 눈보라 광장 → 불시착 → 그 뒤 → 끝', () => {
    const P = PROLOGUE;
    expect(beatAt(0)).toBe('flight');
    expect(beatAt(P.flight.end + 0.1)).toBe('storm');
    expect(beatAt(P.crash.sleigh[0] + 0.1)).toBe('crash');
    expect(beatAt(P.crash.impact + 1)).toBe('aftermath');
    expect(beatAt(P.end)).toBe('done');
  });
  it('비행: 높은 데서 → 썰매 옆 → 눈보라(그 사이 나사가 튀어 나감) → 떨어짐 → 하얗게, 땅 장면은 비행이 끝난 뒤', () => {
    const F = PROLOGUE.flight;
    expect(F.wide[1]).toBeLessThanOrEqual(F.ride[0]);
    expect(F.ride[1]).toBeLessThanOrEqual(F.gust[0]);
    expect(F.bolt).toBeGreaterThan(F.gust[0]);
    expect(F.bolt).toBeLessThan(F.gust[1]);
    expect(F.dive[0]).toBeGreaterThanOrEqual(F.gust[1]);
    expect(F.white[0]).toBeLessThan(F.end);
    expect(PROLOGUE.crash.quiet[0]).toBeGreaterThanOrEqual(F.end);
  });
  it('불시착 뒤: 산타가 손을 흔든 다음(무사) 썰매를 받치고, 도토는 눈을 턴 다음 썰매 날로 간다', () => {
    const C = PROLOGUE.crash;
    expect(C.santaWave[0]).toBeGreaterThanOrEqual(C.santaOut[1]);
    expect(C.santaHold[0]).toBeGreaterThanOrEqual(C.santaWave[1]);
    expect(C.dotoWalk[0]).toBeGreaterThanOrEqual(C.dotoShake[1]);
    expect(C.gifts[0]).toBeGreaterThan(C.impact);
    expect(PROLOGUE.end).toBeGreaterThan(C.santaHold[1]);
  });
  it('호흡: 불시착 뒤 쓰러진 요정들을 보여 주는 정적(2초 이상)이 있고, 그 뒤에 일어난다. 전체 30초 이상', () => {
    const C = PROLOGUE.crash;
    expect(C.settle[0]).toBeGreaterThanOrEqual(C.elves[1]);
    expect(C.settle[1] - C.settle[0]).toBeGreaterThanOrEqual(2);
    expect(C.elfUp[0]).toBeGreaterThanOrEqual(C.settle[1]);
    expect(C.santaUp[0]).toBeGreaterThanOrEqual(C.elfUp[1]);
    expect(C.tags[1]).toBeLessThanOrEqual(PROLOGUE.fadeOut[0]);
    expect(PROLOGUE.end).toBeGreaterThanOrEqual(30);
  });
  it('seg는 구간 밖에서 0·1로 자른다', () => {
    expect(seg(0, [1, 2])).toBe(0);
    expect(seg(1.5, [1, 2])).toBeCloseTo(0.5);
    expect(seg(3, [1, 2])).toBe(1);
  });
});

describe('단체사진 구도', () => {
  it('산타가 가운데, 요정들은 양옆으로 번갈아, 모두 사진기 쪽을 본다', () => {
    const p = photoLineup([0, 1]);
    expect(p.santa.x).toBeCloseTo(PHOTO_SPOT.x);
    expect(p.elves.map((e) => e.slot)).toEqual([0, 1]);
    expect(p.elves[0]!.x).toBeLessThan(p.santa.x);
    expect(p.elves[1]!.x).toBeGreaterThan(p.santa.x);
    expect(p.camera.z).toBeGreaterThan(p.santa.z); // 사진기는 앞(남쪽)
    expect(isPhotoSetup(p)).toBe(true);
  });
  it('같은 참가자면 들어온 순서와 상관없이 같은 구도(5장 재현)', () => {
    expect(photoLineup([3, 0, 2, 1])).toEqual(photoLineup([0, 1, 2, 3]));
    const four = photoLineup([0, 1, 2, 3]);
    const xs = four.elves.map((e) => e.x);
    expect(new Set(xs.map((x) => x.toFixed(2))).size).toBe(4); // 겹치지 않는다
  });
  it('잘못된 값은 사진 구도로 받지 않는다', () => {
    expect(isPhotoSetup(null)).toBe(false);
    expect(isPhotoSetup({ ...photoLineup([0, 1]), version: 2 })).toBe(false);
    expect(isPhotoSetup({ ...photoLineup([0, 1]), elves: [] })).toBe(false);
  });
});

describe('사진 구도 저장(run)', () => {
  const start = () => reduce(createRun('r', 'room', 1), { type: 'start', at: 0 }).state;
  it('프롤로그(연출) 중에 한 번 저장하고, 체크포인트로 이어 하면 그대로 남는다', () => {
    let s = start();
    expect(s.phase).toBe('cutscene');
    const photo = photoLineup([0, 1]);
    const r = reduce(s, { type: 'savePhoto', at: 100, photo });
    s = r.state;
    expect(s.photo).toEqual(photo);
    expect(r.effects.some((e) => e.type === 'save' && e.checkpoint.photo !== undefined)).toBe(true);
    // 두 번째는 바꾸지 않는다
    s = reduce(s, { type: 'savePhoto', at: 200, photo: photoLineup([0, 1, 2]) }).state;
    expect(s.photo).toEqual(photo);
    expect(fromCheckpoint(toCheckpoint(s)).photo).toEqual(photo);
  });
  it('연출 중에는 시계가 멈춰 있고, 연출이 끝나야 흐른다', () => {
    let s = start();
    expect(remainingAt(s, 20_000)).toBe(1_800_000);
    s = reduce(s, { type: 'cutsceneDone', at: 20_000 }).state;
    expect(s.phase).toBe('play');
    expect(remainingAt(s, 21_000)).toBe(1_799_000);
  });
  it('플레이 중에는 사진 구도를 새로 받지 않는다', () => {
    let s = reduce(start(), { type: 'cutsceneDone', at: 0 }).state;
    const r = reduce(s, { type: 'savePhoto', at: 10, photo: photoLineup([0, 1]) });
    s = r.state;
    expect(s.photo).toBeNull();
    expect(r.effects.some((e) => e.type === 'rejected')).toBe(true);
  });
  it('저장소: 사진 구도가 든 체크포인트를 읽고, 망가진 구도면 버린다', () => {
    const kv = new MemoryKV();
    const store = new CheckpointStore(kv);
    const cp = { ...toCheckpoint(createRun('r', 'room', 1)), photo: photoLineup([0, 1]) };
    store.save(cp);
    expect(store.load('room')?.photo).toEqual(cp.photo);
    store.save({ ...cp, photo: { version: 1 } as never });
    expect(store.load('room')).toBeNull();
  });
});
