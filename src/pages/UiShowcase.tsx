import { useMemo, useState } from 'react'
import Panel from '../components/ui/Panel'
import Badge from '../components/ui/Badge'
import TierToggle from '../components/ui/TierToggle'
import CharacterAvatar from '../components/ui/CharacterAvatar'
import CharacterRow from '../components/ui/CharacterRow'
import IconButton from '../components/ui/IconButton'
import SovCampaignBar from '../components/SovCampaignBar'
import type { EnrichedCampaign } from '../components/SovCampaignsTable'

function buildCampaign(base: EnrichedCampaign, overrides: Partial<EnrichedCampaign>): EnrichedCampaign {
  return { ...base, ...overrides }
}

export default function UiShowcase() {
  const [tier, setTier] = useState<'t1' | 't2' | null>(null)
  const now = Date.now()
  const baseCampaign: EnrichedCampaign = {
    campaign_id: 1,
    solar_system_id: 30000142,
    start_time: new Date(now - 60 * 60 * 1000).toISOString(),
    defender_id: 99000006,
    defender_score: 0.7,
    attackers_score: 0.3,
    event_type: 'ihub',
    structure_id: 1,
    system_name: 'Jita',
    constellation_name: 'Kimotoro',
    region_name: 'The Forge',
    defender_name: 'Caldari State',
    defender_icon: 'https://images.evetech.net/alliances/99000006/logo?size=64',
    out_time_utc: new Date(now + 60 * 60 * 1000).toISOString(),
    out_time_raw: new Date(now + 60 * 60 * 1000).toISOString(),
    def_pct: 70,
    adm: 5.0,
  }

  const campaigns = useMemo(() => {
    const soon = buildCampaign(baseCampaign, {
      campaign_id: 2,
      out_time_utc: new Date(now + 4 * 60 * 1000).toISOString(),
      out_time_raw: new Date(now + 4 * 60 * 1000).toISOString(),
      def_pct: 58,
      defender_score: 0.58,
      system_name: 'HED-GP',
      constellation_name: 'Y-2ANO',
      region_name: 'Catch',
    })
    const pending = buildCampaign(baseCampaign, {
      campaign_id: 3,
      out_time_utc: new Date(now + 22 * 60 * 1000).toISOString(),
      out_time_raw: new Date(now + 22 * 60 * 1000).toISOString(),
      def_pct: 66,
      defender_score: 0.66,
      system_name: '4-07MU',
      constellation_name: 'PAR-0S',
      region_name: 'Esoteria',
    })
    const active = buildCampaign(baseCampaign, {
      campaign_id: 4,
      out_time_utc: new Date(now - 6 * 60 * 1000).toISOString(),
      out_time_raw: new Date(now - 6 * 60 * 1000).toISOString(),
      def_pct: 42,
      defender_score: 0.42,
      system_name: '1DQ1-A',
      constellation_name: 'QV28-G',
      region_name: 'Delve',
    })
    const stale = buildCampaign(baseCampaign, {
      campaign_id: 5,
      out_time_utc: new Date(now - 12 * 60 * 1000).toISOString(),
      out_time_raw: new Date(now - 12 * 60 * 1000).toISOString(),
      def_pct: 80,
      defender_score: 0.8,
      system_name: 'V-3YG7',
      constellation_name: 'U-HYZN',
      region_name: 'Fountain',
    })
    return { soon, pending, active, stale }
  }, [baseCampaign, now])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <header className="page-header">
        <div>
          <h1 className="title">UI States</h1>
          <p className="subtitle">Mock states for components and UI elements.</p>
        </div>
      </header>

      <Panel title="Buttons" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button className="button">Default</button>
          <button className="button primary">Primary</button>
          <button className="button danger">Danger</button>
          <button className="button" disabled>Disabled</button>
          <button className="button tier-ok">T2</button>
          <button className="button tier-warn">T1</button>
          <button className="button tier-ghost-ok">T2 Ghost</button>
          <button className="button tier-ghost-warn">T1 Ghost</button>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <IconButton icon="gear" aria-label="Settings" />
          <IconButton icon="copy" iconKind="mask" aria-label="Copy" />
          <IconButton icon="unlink" iconKind="mask" tone="danger" aria-label="Unlink" />
          <IconButton icon="ellipsis" variant="plain" aria-label="More" />
          <IconButton icon="rotate" iconKind="mask" disabled aria-label="Disabled rotate" />
        </div>
      </Panel>

      <Panel title="Badges" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Badge variant="ok">OK</Badge>
          <Badge variant="warn">Warn</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge className="stale-badge" variant="warn">STALE</Badge>
        </div>
      </Panel>

      <Panel title="Form Inputs" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
          <input className="input" placeholder="Default input" />
          <input className="input" placeholder="Disabled input" disabled />
        </div>
      </Panel>

      <Panel title="Character Rows" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <CharacterRow
            characterId={1001}
            portraitUrl="https://images.evetech.net/characters/1001/portrait?size=64"
            name="Online Pilot"
            subtitle="Online"
            online
          />
          <CharacterRow
            characterId={1002}
            portraitUrl="https://images.evetech.net/characters/1002/portrait?size=64"
            name="Offline Pilot"
            subtitle="Offline"
            online={false}
          />
          <CharacterRow
            characterId={1003}
            portraitUrl="https://images.evetech.net/characters/1003/portrait?size=64"
            name="Unknown Status"
            subtitle="Unknown"
            online={null}
          />
          <CharacterRow
            characterId={1004}
            portraitUrl="https://images.evetech.net/characters/1004/portrait?size=64"
            name="With Accessory"
            subtitle="Accessory example"
            online
            rightAccessory={<Badge variant="ok">COORD</Badge>}
          />
        </div>
      </Panel>

      <Panel title="Character Avatars" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <CharacterAvatar characterId={2001} portraitUrl="https://images.evetech.net/characters/2001/portrait?size=64" size={44} online />
          <CharacterAvatar characterId={2002} portraitUrl="https://images.evetech.net/characters/2002/portrait?size=64" size={44} online={false} />
          <CharacterAvatar characterId={2003} portraitUrl="https://images.evetech.net/characters/2003/portrait?size=64" size={44} online={null} />
        </div>
      </Panel>

      <Panel title="Tier Toggle" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <TierToggle value={tier} onChange={setTier} />
          <TierToggle value="t2" onChange={() => {}} />
          <TierToggle value="t1" onChange={() => {}} />
          <TierToggle value={null} onChange={() => {}} disabled />
        </div>
      </Panel>

      <Panel title="Campaign Bars" style={{ marginTop: 8 }} bodyStyle={{ padding: 16 }}>
        <div className="camp-list">
          <SovCampaignBar row={campaigns.soon} now={now} isStale={false} />
          <SovCampaignBar row={campaigns.pending} now={now} isStale={false} />
          <SovCampaignBar row={campaigns.active} now={now} isStale={false} />
          <SovCampaignBar row={campaigns.stale} now={now} isStale />
          <SovCampaignBar row={campaigns.active} now={now} isStale={false} completedStatus="defense" />
          <SovCampaignBar row={campaigns.pending} now={now} isStale={false} completedStatus="offense" />
          <SovCampaignBar row={campaigns.soon} now={now} isStale={false} completedStatus="unknown" />
        </div>
      </Panel>
    </div>
  )
}
