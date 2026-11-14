import { useEffect, useState } from 'react';
import { useWorld } from '../state/world';
import { useSlowVersion } from '../ui/useSlowVersion';
import { PreparePill, TokenMeter } from '../ui';
import { SpeedControl } from './SpeedControl';
import { Calendar } from './Calendar';
import { MusicToggle } from '../audio/MusicToggle';
import type { WorldStore } from '../state/world';
import './hud.css';

// The map modes, in shortcut order (keys 1 to 6). Their buttons are the icon strip on the minimap.
export const MODES: WorldStore['mapMode'][] = ['political', 'terrain', 'diplomacy', 'strength', 'wealth', 'politics'];

function useCompact(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1400px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1400px)');
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}

const openClosing = () => window.dispatchEvent(new CustomEvent('terra:closing'));

export function TopBar({ onCreate }: { onCreate: () => void }) {
  const world = useWorld((s) => s.world);
  useSlowVersion();
  const connected = useWorld((s) => s.connected);
  const compact = useCompact();
  const conn = connected ? 'live' : world ? 'reconnecting' : 'offline';
  const connLabel = { live: 'Live', reconnecting: 'Reconnecting', offline: 'Offline' }[conn];
  return (
    <div className={`topbar tn-lacquer tn-lacquer--bar-top${compact ? ' compact' : ''}`}>
      <div className="tb-group tb-left">
        <span className="wordmark tn-gilt-text">Terra Nova</span>
        <span className="tn-sep" />
        {world && (
          <>
            <div className="tb-world">
              <div className="tb-name" title={world.name}>{world.name}</div>
              <div className="tb-era" title={world.era}>{world.era}</div>
            </div>
            <Calendar />
          </>
        )}
        <span className={`conn conn-${conn}`}><i className="tn-roundel tn-roundel--dot" /><span className="conn-word">{connLabel}</span></span>
      </div>
      <div className="tb-group tb-right">
        {world && <PreparePill />}
        {world && <SpeedControl />}
        {world && (
          <button className="tn-button tn-button--lacquer onair" title="Terra Nova News" onClick={() => window.dispatchEvent(new CustomEvent('terra:news-broadcast'))}>
            <i className="onair-dot tn-roundel tn-roundel--dot" />On air
          </button>
        )}
        <MusicToggle />
        <span className="meter-hit" role="button" tabIndex={0} title="What this world cost" onClick={openClosing} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openClosing(); }}><TokenMeter /></span>
        <button className="tn-button tn-button--gilt tb-new" onClick={onCreate}>New world</button>
      </div>
    </div>
  );
}
