import Peer, { type DataConnection } from 'peerjs';

/**
 * Online play between two devices using room codes.
 * Phones connect straight to each other (WebRTC). The free PeerJS server is only
 * used to help them find each other.
 *
 * The HOST runs the real fight. The GUEST sends its button presses and draws
 * whatever the host says is happening.
 */

const ID_PREFIX = 'darkshadow-v1-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1 and 0)

export type Role = 'host' | 'guest';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NetMessage = { t: string; [k: string]: any };

function randomCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return c;
}

export function cleanCode(s: string) {
  return s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

export function inviteLink(code: string) {
  const url = new URL(location.href);
  url.search = `?room=${code}`;
  url.hash = '';
  return url.toString();
}

export class NetSession {
  onMessage: ((m: NetMessage) => void) | null = null;
  onClose: (() => void) | null = null;
  ping = 0; // round trip in ms
  private conn: DataConnection | null = null;
  private pingTimer = 0;
  private closed = false;

  private constructor(readonly role: Role, readonly code: string, private peer: Peer) {}

  /** Create a room. `onReady` fires when the code is ready to share; the promise resolves when a friend joins. */
  static host(onReady: (code: string) => void): { session: Promise<NetSession>; cancel: () => void } {
    let peer: Peer | null = null;
    let cancelled = false;
    const session = new Promise<NetSession>((resolve, reject) => {
      const attempt = (tries: number) => {
        const code = randomCode();
        peer = new Peer(ID_PREFIX + code);
        peer.on('open', () => onReady(code));
        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && tries < 5) {
            peer?.destroy();
            attempt(tries + 1);
          } else if (!cancelled) reject(err);
        });
        let taken = false;
        peer.on('connection', (conn) => {
          if (taken) {
            conn.on('open', () => conn.close()); // room is full
            return;
          }
          taken = true;
          const s = new NetSession('host', code, peer!);
          conn.on('open', () => {
            s.attach(conn);
            resolve(s);
          });
        });
      };
      attempt(0);
    });
    return {
      session,
      cancel: () => {
        cancelled = true;
        peer?.destroy();
      },
    };
  }

  /** Join a friend's room by code. */
  static join(code: string): Promise<NetSession> {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      const fail = (msg: string) => {
        peer.destroy();
        reject(new Error(msg));
      };
      const timeout = setTimeout(() => fail('Could not connect. Check the code and try again.'), 15000);
      peer.on('error', (err) => {
        clearTimeout(timeout);
        fail(err.type === 'peer-unavailable' ? `Room ${code} not found` : 'Connection problem. Try again.');
      });
      peer.on('open', () => {
        const conn = peer.connect(ID_PREFIX + code, { serialization: 'json' });
        conn.on('open', () => {
          clearTimeout(timeout);
          const s = new NetSession('guest', code, peer);
          s.attach(conn);
          resolve(s);
        });
      });
    });
  }

  private attach(conn: DataConnection) {
    this.conn = conn;
    conn.on('data', (d) => {
      const m = d as NetMessage;
      if (m.t === 'ping') this.send({ t: 'pong', ts: m.ts });
      else if (m.t === 'pong') this.ping = Math.round(performance.now() - m.ts);
      else if (m.t === 'bye') this.handleClose();
      else this.onMessage?.(m);
    });
    conn.on('close', () => this.handleClose());
    conn.on('error', () => this.handleClose());
    this.pingTimer = window.setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 1000);
  }

  send(m: NetMessage) {
    if (this.conn?.open) this.conn.send(m);
  }

  private handleClose() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pingTimer);
    this.onClose?.();
    this.peer.destroy();
  }

  /** Leave on purpose (tells the other player). */
  close() {
    if (this.closed) return;
    this.send({ t: 'bye' });
    this.closed = true;
    clearInterval(this.pingTimer);
    setTimeout(() => this.peer.destroy(), 200);
  }
}

/** The current online session (lives across scene changes). */
export const net: { session: NetSession | null } = { session: null };
