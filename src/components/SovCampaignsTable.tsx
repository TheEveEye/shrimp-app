import { useEffect, useMemo, useRef, useState } from 'react';
import { wsClient } from '../lib/ws';


type EnrichedCampaign = {
  campaign_id: number;
  solar_system_id: number;
  start_time: string;
  defender_id: number;
  defender_score: number;
  attackers_score: number;
  event_type: string;
  structure_id: number;
  system_name?: string;
  constellation_name?: string;
  region_name?: string;
  defender_name?: string;
  defender_category?: string;
  defender_icon?: string;
  out_time_utc: string;
  out_time_raw: string;
  def_pct?: number;
};

type Snapshot = {
  timestamp: number;
  isStale: boolean;
  campaigns: EnrichedCampaign[];
};

function toUnderscores(name?: string) {
  return (name ?? '').replace(/\s+/g, '_');
}

function formatETA(ms: number, opts?: { abs?: boolean }) {
  const val = opts?.abs ? Math.abs(ms) : ms;
  if (val <= 0) return '0:00:00:00';
  const totalSeconds = Math.floor(val / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

type SortKey = 'out' | 'region';
type SortDir = 'asc' | 'desc';

export default function SovCampaignsTable({ onUpdatedAgo }: { onUpdatedAgo?: (s: string) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ timestamp: 0, isStale: false, campaigns: [] });
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [sortKey, setSortKey] = useState<SortKey>('out');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const intervalRef = useRef<number | null>(null);
  const lastAnnounceRef = useRef<number>(0);
  const localVersionRef = useRef<number>(0);
  const rowsByIdRef = useRef<Map<number, EnrichedCampaign>>(new Map());
  const pendingCatchupRef = useRef<boolean>(false);

  useEffect(() => {
    // Connect shared WS and subscribe to public campaigns
    const off = wsClient.addMessageHandler((msg) => {
      if (msg.type === 'campaigns.snapshot') {
        // Replace entirely
        localVersionRef.current = msg.version;
        const byId = new Map<number, EnrichedCampaign>();
        for (const row of (msg.data as any[])) byId.set((row as any).campaign_id, row as any);
        rowsByIdRef.current = byId;
        const data: Snapshot = {
          timestamp: new Date(msg.ts).getTime(),
          isStale: msg.isStale,
          campaigns: Array.from(byId.values()),
        };
        setSnapshot(data);
        setConnected(true);
        pendingCatchupRef.current = false;
        const nowTs = Date.now();
        if (nowTs - lastAnnounceRef.current > 5000) {
          const live = document.getElementById('live-updates');
          if (live) live.textContent = 'Campaigns updated';
          lastAnnounceRef.current = nowTs;
          setTimeout(() => {
            const el = document.getElementById('live-updates');
            if (el) el.textContent = '';
          }, 500);
        }
      } else if (msg.type === 'campaigns.diff') {
        const local = localVersionRef.current;
        if (msg.since !== local) {
          // Request catch-up or wait for resync
          if (!pendingCatchupRef.current) {
            pendingCatchupRef.current = true;
            wsClient.catchupCampaigns(local);
          }
          return;
        }
        // Apply diff
        const byId = rowsByIdRef.current;
        // removals
        for (const id of msg.removed) byId.delete(id);
        // additions
        for (const row of msg.added as any[]) byId.set((row as any).campaign_id, row as any);
        // updates
        for (const upd of msg.updated) {
          const cur = byId.get(upd.campaign_id);
          if (cur) Object.assign(cur, upd.changes);
        }
        localVersionRef.current = msg.version;
        const data: Snapshot = {
          timestamp: new Date(msg.ts).getTime(),
          isStale: msg.isStale,
          campaigns: Array.from(byId.values()),
        };
        setSnapshot(data);
      } else if (msg.type === 'campaigns.resync') {
        // Wait for fresh snapshot that follows
        pendingCatchupRef.current = false;
      }
    });
    wsClient.ensure();
    wsClient.subscribe('public.campaigns', { lastVersion: localVersionRef.current });
    intervalRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      wsClient.unsubscribe('public.campaigns');
      off();
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const rows = useMemo(() => {
    const arr = [...(snapshot?.campaigns ?? [])];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'out') {
        cmp = new Date(a.out_time_raw).getTime() - new Date(b.out_time_raw).getTime();
      } else if (sortKey === 'region') {
        cmp = (a.region_name || '').localeCompare(b.region_name || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [snapshot, sortKey, sortDir]);

  const updatedAgo = (() => {
    if (!snapshot?.timestamp) return '';
    const ms = Math.max(now - snapshot.timestamp, 0);
    const s = Math.floor(ms / 1000);
    if (s < 2) return 'updated just now';
    if (s < 60) return `updated ${s}s ago`;
    const m = Math.floor(s / 60);
    return `Last changed ${m}m ago`;
  })();

  // Report updated text to page header
  const prevAgoRef = useRef<string>('');
  useEffect(() => {
    if (onUpdatedAgo && updatedAgo !== prevAgoRef.current) {
      onUpdatedAgo(updatedAgo);
      prevAgoRef.current = updatedAgo;
    }
  }, [updatedAgo, onUpdatedAgo]);

  if (!connected) {
    const sk = new Array(5).fill(0);
    return (
      <div className="panel" role="region" aria-label="Sovereignty campaigns">
        <div className="panel-header">
          <div className="panel-title">Current campaigns</div>
          <div className="controls"><span className="muted">connecting…</span></div>
        </div>
        <div className="panel-body">
          <table className="sov-table">
            <thead>
              <tr>
                <th scope="col">System</th>
                <th scope="col">Constellation</th>
                <th scope="col">Region</th>
                <th scope="col">Owner</th>
                <th scope="col">Time</th>
                <th scope="col">Relative</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {sk.map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td><div className="skeleton" style={{ height: 14, width: 120 }} /></td>
                  <td><div className="skeleton" style={{ height: 14, width: 160 }} /></td>
                  <td><div className="skeleton" style={{ height: 14, width: 140 }} /></td>
                  <td><div className="skeleton" style={{ height: 18, width: 220 }} /></td>
                  <td><div className="skeleton" style={{ height: 14, width: 160 }} /></td>
                  <td><div className="skeleton" style={{ height: 22, width: 120, borderRadius: 9999 }} /></td>
                  <td><div className="skeleton" style={{ height: 14, width: 120 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div id="live-updates" className="sr-only" aria-live="polite" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="panel" role="region" aria-label="Sovereignty campaigns">
        <div className="panel-header">
          <div className="panel-title">Current campaigns</div>
          <div className="controls">
            <span className="muted">{updatedAgo}</span>
            {snapshot.isStale && <span className="badge warn">STALE</span>}
          </div>
        </div>
        <div className="panel-body" style={{ padding: '24px', textAlign: 'center' }}>
          <div className="muted">No reinforced hubs found</div>
        </div>
        <div id="live-updates" className="sr-only" aria-live="polite" />
      </div>
    );
  }

  return (
    <div className="panel" role="region" aria-label="Sovereignty campaigns">
      <div className="panel-header">
        <div className="panel-title">Current campaigns</div>
        <div className="controls">
          <span className="muted">{updatedAgo}</span>
          {snapshot.isStale && <span className="badge warn">STALE</span>}
        </div>
      </div>
      <div className="panel-body">
      <table className="sov-table">
        <thead>
          <tr>
            <th scope="col">System</th>
            <th scope="col">Constellation</th>
            <th scope="col" role="button" tabIndex={0} onClick={() => { setSortKey('region'); setSortDir(sortKey==='region' && sortDir==='asc' ? 'desc' : 'asc'); }} aria-sort={sortKey==='region'? (sortDir==='asc'?'ascending':'descending') : 'none'}>Region {sortKey==='region' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
            <th scope="col">Owner</th>
            <th scope="col" role="button" tabIndex={0} onClick={() => { setSortKey('out'); setSortDir(sortKey==='out' && sortDir==='asc' ? 'desc' : 'asc'); }} aria-sort={sortKey==='out'? (sortDir==='asc'?'ascending':'descending') : 'none'} title="Sort by Time">Time {sortKey==='out' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
            <th scope="col">Relative</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const etaMs = new Date(r.out_time_raw).getTime() - now;
            const isLive = etaMs <= 0; // out time passed but campaign still present
            const eta = isLive ? formatETA(etaMs, { abs: true }) : formatETA(etaMs);
            const sys = r.system_name ?? String(r.solar_system_id);
            const con = r.constellation_name ?? '-';
            const reg = r.region_name ?? '-';
            const ownerName = r.defender_name ?? String(r.defender_id);
            const defPct = r.def_pct ?? Math.round(r.defender_score * 100);
            const etaWarn = etaMs > 0 && etaMs < 15 * 60 * 1000;
            const etaPillClass = `eta-pill mono${etaWarn ? ' warn pulse' : ''}${isLive ? ' live' : ''}`;
            // Recompute remaining nodes using symmetric 6.6667% per node model
            const ATTACKERS_TOTAL = 9;
            const DEFENDERS_TOTAL = 6;
            const NODE_PCT = 100 / 15; // 6.6667%
            const above = Math.max(defPct - 60, 0);
            const below = Math.max(60 - defPct, 0);
            const incAbove = Math.round(above / NODE_PCT - 1e-9); // nodes above 60% (round any fraction up)
            const incBelow = Math.round(below / NODE_PCT - 1e-9); // nodes below 60% (round any fraction up)
            const attacker_remaining = defPct >= 60
              ? ATTACKERS_TOTAL + incAbove
              : Math.max(ATTACKERS_TOTAL - incBelow, 0);
            const defender_remaining = defPct <= 60
              ? DEFENDERS_TOTAL + incBelow
              : Math.max(DEFENDERS_TOTAL - incAbove, 0);
            return (
              <tr key={r.campaign_id} tabIndex={0}>
                <td>
                  <a className="name-link" href={`https://evemaps.dotlan.net/map/${toUnderscores(reg)}/${toUnderscores(sys)}`} target="_blank" rel="noreferrer">{sys}</a>
                </td>
                <td>
                  {con !== '-' ? (
                    <a className="name-link" href={`https://evemaps.dotlan.net/map/${toUnderscores(reg)}/${toUnderscores(con)}`} target="_blank" rel="noreferrer">{con}</a>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {reg !== '-' ? (
                    <a className="name-link" href={`https://evemaps.dotlan.net/map/${toUnderscores(reg)}`} target="_blank" rel="noreferrer">{reg}</a>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  <div className="owner">
                    {r.defender_icon && (
                      <img className="icon" src={r.defender_icon} width={28} height={28} alt="owner icon" />
                    )}
                    <span className="name">{ownerName}</span>
                  </div>
                </td>
                <td className="mono">{r.out_time_utc}</td>
                <td>
                  <span className={etaPillClass}>{eta}</span>
                </td>
                <td>
                  <div className="score-wrap">
                    <div className="mono">
                      {defPct}% (
                      <span className="score-def">{defender_remaining}</span>
                      /
                      <span className="score-att">{attacker_remaining}</span>
                      )
                    </div>
                    <div className={`score-bar${snapshot.isStale ? ' stale' : ''}`}>
                      <div className="fill" style={{ width: `${defPct}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div id="live-updates" className="sr-only" aria-live="polite" />
    </div>
  );
}
