import { useWorld } from '../state/world';
import { TokenMeter } from '../ui';
import type { WorldStore } from '../state/world';
import './hud.css';

export const MODES: WorldStore['mapMode'][] = ['political', 'terrain', 'diplomacy', 'strength'];
const MODE_LABELS: Record<WorldStore['mapMode'], string> = { political: 'Political', terrain: 'Terrain', diplomacy: 'Diplomacy', strength: 'Strength' };
const SPEEDS = [1, 2, 4, 8];

export function TopBar({ onCreate }: { onCreate: () => void }) {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);
  const connected = useWorld((s) => s.connected);
  const mapMode = useWorld((s) => s.mapMode);
  const setMapMode = useWorld((s) => s.setMapMode);
  const send = useWorld((s) => s.send);
  const conn = connected ? 'live' : world ? 'reconnecting' : 'offline';
  const connLabel = { live: 'Live', reconnecting: 'Reconnecting', offline: 'Offline' }[conn];
  return (
    <div className="topbar">
      <div className="tb-group">
        <span className="wordmark">Terra Nova</span>
        <span className="vsep" />
        {world && (
          <>
            <div className="tb-world">
              <div className="tb-name" title={world.name}>{world.name}</div>
              <div className="tb-era" title={world.era}>{world.era}</div>
            </div>
            <div className="tb-year"><span className="cap">Year</span><span className="num">{world.year}</span></div>
          </>
        )}
        <span className={`conn conn-${conn}`}><i />{connLabel}</span>
      </div>
      {world && (
        <div className="tb-group">
          <div className="segs">
            {MODES.map((m, i) => (
              <button key={m} className={`seg ${mapMode === m ? 'on' : ''}`} title={`Shortcut ${i + 1}`} onClick={() => setMapMode(m)}>{MODE_LABELS[m]}</button>
            ))}
          </div>
        </div>
      )}
      <div className="tb-group">
        {world && (
          <div className="segs">
            <button className={`seg icon ${world.paused ? 'on' : ''}`} title="Pause" aria-label="Pause" onClick={() => send({ type: 'control', action: 'pause', value: !world.paused })}>
              <svg width="10" height="11" viewBox="0 0 10 11"><rect width="3.5" height="11" fill="currentColor" /><rect x="6.5" width="3.5" height="11" fill="currentColor" /></svg>
            </button>
            {SPEEDS.map((v) => (
              <button key={v} className={`seg mono ${world.speed === v && !world.paused ? 'on' : ''}`} onClick={() => { send({ type: 'control', action: 'pause', value: false }); send({ type: 'control', action: 'speed', value: v }); }}>{v}x</button>
            ))}
          </div>
        )}
        {world && (
          <button className="btn onair" title="Terra Nova News" onClick={() => window.dispatchEvent(new CustomEvent('terra:news-broadcast'))}>
            <i className="onair-dot" />On air
          </button>
        )}
        <TokenMeter />
        <button className="btn primary-dark" onClick={onCreate}>New world</button>
      </div>
    </div>
  );
}
