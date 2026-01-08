import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, MouseEvent } from 'react';
import { wsClient } from '../lib/ws';
import Panel from './ui/Panel';
import Badge from './ui/Badge';

export type EnrichedCampaign = {
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
  adm?: number;
  adm_observed_at?: string;
};

type Snapshot = {
  timestamp: number;
  isStale: boolean;
  campaigns: EnrichedCampaign[];
};

function toUnderscores(name?: string) {
  return (name ?? '').replace(/\s+/g, '_');
}

function formatT(ms: number) {
  const sign = ms > 0 ? '-' : '+'; // T- if in future, T+ if passed
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (totalSeconds < 86400) {
    // < 1d -> hh:mm:ss
    const hh = Math.floor(totalSeconds / 3600);
    return `T${sign}${pad(hh)}:${pad(minutes)}:${pad(seconds)}`;
  } else {
    // >= 1d -> d:hh:mm:ss
    return `T${sign}${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
}

type SortKey = 'time' | 'region' | 'adm';
type SortDir = 'asc' | 'desc';

export default function SovCampaignsTable({
  onUpdatedAgo,
  rowOverlay,
  rowClassName,
  snapshotOverride,
  connectedOverride,
}: {
  onUpdatedAgo?: (s: string) => void;
  rowOverlay?: (row: EnrichedCampaign) => ReactNode;
  rowClassName?: (row: EnrichedCampaign) => string | undefined;
  snapshotOverride?: Snapshot;
  connectedOverride?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ timestamp: 0, isStale: false, campaigns: [] });
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showRelative, setShowRelative] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const lastAnnounceRef = useRef<number>(0);
  const localVersionRef = useRef<number>(0);
  const rowsByIdRef = useRef<Map<number, EnrichedCampaign>>(new Map());
  const pendingCatchupRef = useRef<boolean>(false);
  const usingOverride = !!snapshotOverride;
  const liveSnapshot = snapshotOverride ?? snapshot;
  const isConnected = connectedOverride ?? (usingOverride ? true : connected);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    if (usingOverride) {
      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
      };
    }
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
    return () => {
      wsClient.unsubscribe('public.campaigns');
      off();
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [usingOverride]);

  const rows = useMemo(() => {
    const arr = [...(liveSnapshot?.campaigns ?? [])];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'time') {
        cmp = new Date(a.out_time_raw).getTime() - new Date(b.out_time_raw).getTime();
      } else if (sortKey === 'region') {
        cmp = (a.region_name || '').localeCompare(b.region_name || '');
      } else if (sortKey === 'adm') {
        const av = Number.isFinite(a.adm as number) ? (a.adm as number) : -Infinity;
        const bv = Number.isFinite(b.adm as number) ? (b.adm as number) : -Infinity;
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [liveSnapshot, sortKey, sortDir]);

  const updatedAgo = (() => {
    if (!liveSnapshot?.timestamp) return '';
    if (!showRelative) {
      const d = new Date(liveSnapshot.timestamp);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `Last change ${hh}:${mm}:${ss}`;
    }
    const ms = Math.max(now - liveSnapshot.timestamp, 0);
    const s = Math.floor(ms / 1000);
    if (s < 2) return 'Last change just now';
    if (s < 60) return `Last change ${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `Last change ${m}min ago`;
    const h = Math.floor(m / 60);
    return `Last change ${h}h ago`;
  })();

  // Report updated text to page header
  const prevAgoRef = useRef<string>('');
  useEffect(() => {
    if (onUpdatedAgo && updatedAgo !== prevAgoRef.current) {
      onUpdatedAgo(updatedAgo);
      prevAgoRef.current = updatedAgo;
    }
  }, [updatedAgo, onUpdatedAgo]);

  if (!isConnected) {
    const sk = new Array(5).fill(0);
    return (
      <Panel
        title="Current campaigns"
        controls={<span className="muted">connecting…</span>}
        role="region"
        ariaLabel="Sovereignty campaigns"
      >
        <table className="sov-table">
          <thead>
            <tr>
              <th scope="col">System</th>
              <th scope="col">Constellation</th>
              <th scope="col">Region</th>
              <th scope="col">Owner</th>
              <th scope="col" className="col-adm">ADM</th>
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
                <td className="col-adm"><div className="skeleton" style={{ height: 22, width: 86, borderRadius: 9999 }} /></td>
                <td><div className="skeleton" style={{ height: 14, width: 160 }} /></td>
                <td><div className="skeleton" style={{ height: 22, width: 120, borderRadius: 9999 }} /></td>
                <td><div className="skeleton" style={{ height: 14, width: 120 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div id="live-updates" className="sr-only" aria-live="polite" />
      </Panel>
    );
  }

  if (!rows.length) {
    return (
      <Panel
        title="Current campaigns"
        controls={(
          <>
            <button
              type="button"
              className="muted text-button"
              onClick={() => setShowRelative((v) => !v)}
              style={{ whiteSpace: 'nowrap' }}
              title="Toggle last change display"
            >
              {updatedAgo}
            </button>
            {liveSnapshot.isStale && <Badge variant="warn">STALE</Badge>}
          </>
        )}
        role="region"
        ariaLabel="Sovereignty campaigns"
        bodyStyle={{ padding: '24px', textAlign: 'center' }}
      >
        <div className="muted">No reinforced hubs found</div>
        <div id="live-updates" className="sr-only" aria-live="polite" />
      </Panel>
    );
  }

  return (
    <Panel
      title="Current campaigns"
      controls={(
        <>
          <button
            type="button"
            className="muted text-button"
            onClick={() => setShowRelative((v) => !v)}
            style={{ whiteSpace: 'nowrap' }}
            title="Toggle last change display"
          >
            {updatedAgo}
          </button>
          {liveSnapshot.isStale && <Badge variant="warn">STALE</Badge>}
        </>
      )}
      role="region"
      ariaLabel="Sovereignty campaigns"
    >
      <table className="sov-table">
        <thead>
          <tr>
            <th scope="col">System</th>
            <th scope="col">Constellation</th>
            <th scope="col" role="button" tabIndex={0} onClick={() => { setSortKey('region'); setSortDir(sortKey==='region' && sortDir==='asc' ? 'desc' : 'asc'); }} aria-sort={sortKey==='region'? (sortDir==='asc'?'ascending':'descending') : 'none'}>Region {sortKey==='region' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
            <th scope="col">Owner</th>
            <th scope="col" className="col-adm" role="button" tabIndex={0} onClick={() => { setSortKey('adm'); setSortDir(sortKey==='adm' && sortDir==='asc' ? 'desc' : 'asc'); }} aria-sort={sortKey==='adm'? (sortDir==='asc'?'ascending':'descending') : 'none'} title="Sort by ADM">ADM {sortKey==='adm' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
            <th scope="col" role="button" tabIndex={0} onClick={() => { setSortKey('time'); setSortDir(sortKey==='time' && sortDir==='asc' ? 'desc' : 'asc'); }} aria-sort={sortKey==='time'? (sortDir==='asc'?'ascending':'descending') : 'none'} title="Sort by Time">Time {sortKey==='time' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
            <th scope="col">Relative</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const etaMs = new Date(r.out_time_raw).getTime() - now;
            const isLive = etaMs <= 0; // out time passed but campaign still present
            const eta = formatT(etaMs);
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
            const attacker_score = defPct <= 60
              ? DEFENDERS_TOTAL + incBelow
              : Math.max(DEFENDERS_TOTAL - incAbove, 0);
            const defnder_score = defPct >= 60
              ? ATTACKERS_TOTAL + incAbove
              : Math.max(ATTACKERS_TOTAL - incBelow, 0);
            const trClass = rowClassName ? rowClassName(r) : undefined;
            const onRowMouseDown = (e: MouseEvent<HTMLTableRowElement>) => {
              if (!rowOverlay) return;
              const target = e.target as HTMLElement | null;
              if (target && target.closest('a, button, input, select, textarea, [role="button"], [role="link"]')) return;
              const rowEl = e.currentTarget;
              if (document.activeElement === rowEl) {
                e.preventDefault();
                rowEl.blur();
              }
            };
            return (
              <tr key={r.campaign_id} tabIndex={0} className={trClass} onMouseDown={onRowMouseDown}>
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
                <td className="col-adm">
                  {Number.isFinite(r.adm as number) ? (
                    <span className="adm-pill mono">{(r.adm as number).toFixed(1)}×</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="mono">{r.out_time_utc}</td>
                <td>
                  <span className={etaPillClass}>{eta}</span>
                </td>
                <td>
                  <div className="score-wrap">
                    <div className="mono">
                      {defPct}% (
                      <span className="score-def">{defnder_score}</span>
                      /
                      <span className="score-att">{attacker_score}</span>
                      )
                    </div>
                    <div className={`score-bar${liveSnapshot.isStale ? ' stale' : ''}`}>
                      <div className="fill" style={{ width: `${defPct}%` }} />
                    </div>
                  </div>
                  {rowOverlay ? (
                    <div className="row-actions">
                      {rowOverlay(r)}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div id="live-updates" className="sr-only" aria-live="polite" />
    </Panel>
  );
}
