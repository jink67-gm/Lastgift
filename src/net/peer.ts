// WebRTC 연결 하나(방장 ↔ 참가자 1명). 데이터 채널 둘:
//   state   : 순서·재전송 없음. 이동 입력과 화면 스냅샷(늦으면 버리고 최신만 쓴다)
//   mission : 순서·신뢰 보장. 행동·재시도·입장 같은 미션 이벤트
// 같은 와이파이에서는 내부 주소로 기기끼리 직접 연결된다. STUN은 직접 연결이 어려울 때 바깥 주소를 찾는 데 쓴다.
import type { SignalKind } from './signaling';

export type Channel = 'state' | 'mission';

export const DEFAULT_ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export class PeerLink {
  readonly pc: RTCPeerConnection;
  private channels: Partial<Record<Channel, RTCDataChannel>> = {};
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSet = false;
  private closed = false;
  onMessage: (ch: Channel, data: string) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};

  constructor(
    readonly link: string,
    private readonly sendSignal: (kind: SignalKind, data: string) => void,
    iceServers: RTCIceServer[],
  ) {
    this.pc = new RTCPeerConnection({ iceServers });
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal('ice', JSON.stringify(e.candidate.toJSON()));
    };
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      if (st === 'failed' || st === 'closed') this.close();
    };
    this.pc.ondatachannel = (e) => this.adopt(e.channel);
  }

  private adopt(ch: RTCDataChannel): void {
    const name = ch.label as Channel;
    if (name !== 'state' && name !== 'mission') return;
    this.channels[name] = ch;
    ch.onmessage = (e) => {
      if (typeof e.data === 'string') this.onMessage(name, e.data);
    };
    ch.onopen = () => {
      if (this.isOpen) this.onOpen();
    };
    ch.onclose = () => this.close();
  }

  get isOpen(): boolean {
    return this.channels.state?.readyState === 'open' && this.channels.mission?.readyState === 'open';
  }

  /** 방장: 채널을 만들고 offer를 보낸다 */
  async offer(): Promise<void> {
    this.adopt(this.pc.createDataChannel('state', { ordered: false, maxRetransmits: 0 }));
    this.adopt(this.pc.createDataChannel('mission', { ordered: true }));
    const o = await this.pc.createOffer();
    await this.pc.setLocalDescription(o);
    this.sendSignal('offer', JSON.stringify(this.pc.localDescription));
  }

  async handle(kind: SignalKind, data: string): Promise<void> {
    if (this.closed) return;
    const v: unknown = JSON.parse(data);
    if (kind === 'offer') {
      await this.pc.setRemoteDescription(v as RTCSessionDescriptionInit);
      await this.flushIce();
      const a = await this.pc.createAnswer();
      await this.pc.setLocalDescription(a);
      this.sendSignal('answer', JSON.stringify(this.pc.localDescription));
    } else if (kind === 'answer') {
      await this.pc.setRemoteDescription(v as RTCSessionDescriptionInit);
      await this.flushIce();
    } else if (this.remoteSet) {
      await this.pc.addIceCandidate(v as RTCIceCandidateInit).catch(() => {});
    } else {
      this.pendingIce.push(v as RTCIceCandidateInit);
    }
  }

  private async flushIce(): Promise<void> {
    this.remoteSet = true;
    for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
  }

  send(ch: Channel, msg: unknown): void {
    const c = this.channels[ch];
    if (c?.readyState === 'open') c.send(JSON.stringify(msg));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const c of Object.values(this.channels)) c?.close();
    this.pc.close();
    this.onClose();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
