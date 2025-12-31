import { API_BASE_URL } from './api';

type Message =
  | { type: 'auth'; token?: string; requestId?: string }
  | { type: 'subscribe'; topic: string; lastVersion?: number; requestId?: string }
  | { type: 'unsubscribe'; topic: string; requestId?: string }
  | { type: 'ping'; requestId?: string }
  | { type: 'campaigns.catchup'; topic: 'public.campaigns'; since: number; requestId?: string };

type ServerMessage =
  | { type: 'ack'; requestId?: string }
  | { type: 'error'; requestId?: string; code: string; message?: string }
  | { type: 'pong'; requestId?: string }
  | { type: 'campaigns.snapshot'; topic: 'public.campaigns'; version: number; data: any[]; isStale: boolean; ts: string }
  | { type: 'campaigns.diff'; topic: 'public.campaigns'; since: number; version: number; ts: string; isStale: boolean; added: any[]; updated: Array<{ campaign_id: number; changes: any }>; removed: number[] }
  | { type: 'campaigns.resync'; topic: 'public.campaigns' }
  // Session messages (lobby)
  | { type: 'session.snapshot'; topic: string; members: Array<{ character_id: number; name?: string; role: 'coordinator' | 'line'; online: boolean }>; meta: { id: number; owner_id: number; created_at: number; ended_at?: number; campaigns: Array<{ campaign_id: number; side: 'offense' | 'defense' }>; campaign_snapshots?: Array<{ campaign_id: number; snapshot: any }> } }
  | { type: 'presence.joined'; topic: string; character_id: number }
  | { type: 'presence.left'; topic: string; character_id: number }
  | { type: 'presence.heartbeat'; topic: string; ts: number }
  | { type: 'member.kicked'; topic: string; character_id: number }
  | { type: 'member.left'; topic: string; character_id: number }
  | { type: 'codes.rotated'; topic: string; role: 'coordinator' | 'line'; rotated_at: number }
  | { type: 'session.ended'; topic: string }
  | { type: 'session.forced_leave' }
  // Toasters
  | { type: 'toaster.attached'; topic: string; toaster: any }
  | { type: 'toaster.detached'; topic: string; character_id: number }
  | { type: 'toaster.location_updated'; topic: string; character_id: number; system_id?: number; ship_type_id?: number; ship_type_name?: string; online?: boolean; last_seen_at?: number }
  | { type: 'toaster.updated'; topic: string; character_id: number; entosis_tier: 't1' | 't2' };

function toWsUrl(httpUrl: string): string {
  const u = new URL(httpUrl);
  u.pathname = (u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname) + '/ws';
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

function jitter(ms: number): number {
  const spread = ms * 0.3;
  return ms + (Math.random() * spread - spread / 2);
}

class WSClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxBackoff = 30000; // 30s
  private baseBackoff = 500; // ms
  private queue: Message[] = [];
  private handlers: Set<(msg: ServerMessage) => void> = new Set();
  private wantedSubs: Set<string> = new Set();
  connected = false;

  constructor(url: string) {
    this.url = url;
  }

  ensure() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }
    const ws = this.ws;
    ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      // Flush queue
      const q = this.queue;
      this.queue = [];
      for (const m of q) this.send(m);
      // Resubscribe topics
      for (const t of this.wantedSubs) this.send({ type: 'subscribe', topic: t });
    };
    ws.onclose = () => {
      this.connected = false;
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      // handled by onclose
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as ServerMessage;
        for (const h of this.handlers) h(msg);
      } catch {
        // ignore
      }
    };
  }

  private scheduleReconnect() {
    const attempt = this.reconnectAttempts++;
    const backoff = Math.min(this.maxBackoff, this.baseBackoff * Math.pow(2, attempt));
    const delay = Math.max(250, jitter(backoff));
    setTimeout(() => this.connect(), delay);
  }

  private send(msg: Message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push(msg);
      this.ensure();
      return;
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (e) {
      // requeue on transient error
      this.queue.push(msg);
    }
  }

  auth(token: string) {
    this.send({ type: 'auth', token });
  }

  subscribe(topic: string, opts?: { lastVersion?: number }) {
    this.wantedSubs.add(topic);
    this.send({ type: 'subscribe', topic, lastVersion: opts?.lastVersion });
  }

  unsubscribe(topic: string) {
    this.wantedSubs.delete(topic);
    this.send({ type: 'unsubscribe', topic });
  }

  addMessageHandler(cb: (msg: ServerMessage) => void) {
    this.handlers.add(cb);
    return () => this.handlers.delete(cb);
  }

  catchupCampaigns(since: number) {
    this.send({ type: 'campaigns.catchup', topic: 'public.campaigns', since });
  }
}

export const wsClient = new WSClient(toWsUrl(API_BASE_URL));
