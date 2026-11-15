// #311 dev preview only: a plain card that prints useArmyInfo / useBattleInfo and draws the battle
// line as a grid of squares. Lane a's ArmyCard and BattleCard (web/src/ui/) replace it. Lane b.
import type { CSSProperties } from 'react';
import { formatSoldiers, useArmyInfo } from '../state/armyInfo';
import { useBattleInfo } from '../state/battleInfo';
import type { LineBlock, LineSide } from '../state/battleInfo';
import { useWorld } from '../state/world';
import { yearShort } from '@terra/shared';

const box: CSSProperties = {
  width: 'var(--left-panel-width, 340px)', maxHeight: '100%', overflow: 'auto', boxSizing: 'border-box',
  padding: 12, background: 'rgba(12, 14, 22, 0.94)', color: '#e8e2d0', border: '1px solid #555',
  font: '12px/1.45 var(--font-mono, monospace)',
};
const h: CSSProperties = { font: '700 14px/1.3 var(--font-display, serif)', margin: '0 0 6px' };
const muted: CSSProperties = { opacity: 0.65 };

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={h}>{title}</div>
      <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid #666', color: 'inherit', cursor: 'pointer' }}>close</button>
    </div>
  );
}

function ArmyDebug({ unitId }: { unitId: string }) {
  const a = useArmyInfo(unitId);
  const close = () => useWorld.getState().selectUnit(null);
  if (!a) return <div style={box}><Header title="Army" onClose={close} /><div style={muted}>This army is gone.</div></div>;
  return (
    <div style={box}>
      <Header title={`Army of ${a.nation}`} onClose={close} />
      <div>{a.status.text}</div>
      <div>General: {a.general?.name ?? 'none'}</div>
      <div>Age: {a.techAge} · strength {a.strength} ({formatSoldiers(a.soldiers)} soldiers)</div>
      <div>War readiness: {Math.round(a.readiness)} ({a.readinessBand})</div>
      <div style={{ marginTop: 6 }}>
        {a.composition.map((g) => <div key={g.role}>{g.role}: {g.name} {g.soldiers.toLocaleString('en-GB')} ({g.figures} figures)</div>)}
      </div>
    </div>
  );
}

function Cells({ b, color, vertical }: { b: LineBlock; color: string; vertical?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 2 }} title={`${b.name} ${b.soldiers} of ${b.max}`}>
      {Array.from({ length: b.maxCells }, (_, i) => (
        <span key={i} style={{ width: 9, height: 9, background: i < b.cells ? color : 'transparent', border: `1px solid ${color}`, opacity: i < b.cells ? 1 : 0.3 }} />
      ))}
    </div>
  );
}

/** One side's line: the back row, then flank | front | flank. `facing` puts the front towards the middle. */
function Side({ line, color, facing }: { line: LineSide; color: string; facing: 'down' | 'up' }) {
  const back = <div style={{ display: 'flex', justifyContent: 'center' }}><Cells b={line.back} color={color} /></div>;
  const mid = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
      <Cells b={line.flankLeft} color={color} vertical />
      <Cells b={line.front} color={color} />
      <Cells b={line.flankRight} color={color} vertical />
    </div>
  );
  return <div style={{ display: 'grid', gap: 4 }}>{facing === 'down' ? <>{back}{mid}</> : <>{mid}{back}</>}</div>;
}

function BattleDebug({ tile }: { tile: number }) {
  const b = useBattleInfo(tile);
  const close = () => useWorld.getState().selectBattle(null);
  if (!b) return <div style={box}><Header title="Battle" onClose={close} /><div style={muted}>No battle seen here yet.</div></div>;
  const side = (s: typeof b.attacker, label: string) => (
    <div>
      <div><b style={{ color: s.color }}>{label}: {s.nation}</b></div>
      <div>General: {s.general?.name ?? 'none'}</div>
      <div>{formatSoldiers(s.startSoldiers)} at the start, {formatSoldiers(s.soldiers)} now, lost {formatSoldiers(s.lostSoldiers)}</div>
      <div style={muted}>{s.troops.map((t) => `${t.name} ${formatSoldiers(t.soldiers)}`).join(' · ')}</div>
    </div>
  );
  return (
    <div style={box}>
      <Header title={`Battle of ${b.province}`} onClose={close} />
      <div style={muted}>Since {yearShort(b.startYear)}, {b.durationText}{b.active ? '' : ' (over)'} · {b.clashes.length} {b.clashes.length === 1 ? 'clash' : 'clashes'} · {b.leader === 'even' ? 'even' : `${b.leader} ahead`}</div>
      <div style={{ margin: '8px 0' }}>{side(b.attacker, 'Attacker')}</div>
      <div style={{ display: 'grid', gap: 10, padding: 8, border: '1px solid #444', margin: '6px 0' }}>
        <Side line={b.line.attacker} color={b.attacker.color} facing="down" />
        <div style={{ borderTop: '1px dashed #777' }} />
        <Side line={b.line.defender} color={b.defender.color} facing="up" />
      </div>
      <div>{side(b.defender, 'Defender')}</div>
    </div>
  );
}

export function ArmyBattleDebug(props: { unitId?: string; tile?: number }) {
  if (props.unitId != null) return <ArmyDebug unitId={props.unitId} />;
  if (props.tile != null) return <BattleDebug tile={props.tile} />;
  return null;
}
