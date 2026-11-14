// #311: the battle grid in the middle of the battle card, drawn from useBattleInfo(tile).line. Each side
// is a back rank behind a front rank with a flank on each end; the attackers stand on top facing down,
// the defenders below facing up. Squares that are lost fade and shrink (opacity and transform only):
// the front thins out evenly, the flanks fold in towards the front, and the back goes last.
import type { LineBlock, LineSide } from '../../state/battleInfo';

const CELL = 14;        // square size
const STEP = 17;        // square plus gap
const WING_GAP = 7;     // extra air between a flank and the front
const ROW_GAP = 7;      // between the front and back ranks
const MID = 16;         // half the no man's land between the two front ranks
const W = 300;

/** Which of a block's maxCells squares are still standing. */
function standing(b: LineBlock, keep: 'spread' | 'start' | 'end'): boolean[] {
  const n = b.maxCells, k = Math.max(0, Math.min(n, b.cells));
  const on = new Array<boolean>(n).fill(false);
  if (keep === 'start') for (let i = 0; i < k; i++) on[i] = true;
  else if (keep === 'end') for (let i = 0; i < k; i++) on[n - 1 - i] = true;
  else for (let i = 0; i < k; i++) on[Math.round(((i + 0.5) * n) / k - 0.5)] = true;
  return on;
}

interface Sq { x: number; y: number; on: boolean; key: string; title: string }

function sideSquares(line: LineSide, frontY: number, backY: number, tag: string): Sq[] {
  const out: Sq[] = [];
  const row = (b: LineBlock, keep: 'spread' | 'start' | 'end', x0: number, y: number, name: string) => {
    const on = standing(b, keep);
    on.forEach((v, i) => out.push({ x: x0 + i * STEP, y, on: v, key: `${tag}-${name}-${i}`, title: `${b.name}: ${b.soldiers.toLocaleString('en-GB')} of ${b.max.toLocaleString('en-GB')}` }));
  };
  const frontW = line.front.maxCells * STEP - (STEP - CELL);
  const flankW = (b: LineBlock) => b.maxCells * STEP - (STEP - CELL);
  const fx = (W - frontW) / 2;
  row(line.front, 'spread', fx, frontY, 'front');
  // flanks keep the squares nearest the front: the left one its right end, the right one its left end
  row(line.flankLeft, 'end', fx - WING_GAP - flankW(line.flankLeft), frontY, 'flankL');
  row(line.flankRight, 'start', fx + frontW + WING_GAP, frontY, 'flankR');
  const backW = line.back.maxCells * STEP - (STEP - CELL);
  row(line.back, 'spread', (W - backW) / 2, backY, 'back');
  return out;
}

export function BattleGrid({ line, attackerColor, defenderColor, active }: { line: { attacker: LineSide; defender: LineSide }; attackerColor: string; defenderColor: string; active: boolean }) {
  const pad = 9;
  const aBack = pad, aFront = pad + CELL + ROW_GAP;
  const mid = aFront + CELL + MID;
  const dFront = mid + MID, dBack = dFront + CELL + ROW_GAP;
  const H = dBack + CELL + pad;
  const squares = [
    ...sideSquares(line.attacker, aFront, aBack, 'a').map((s) => ({ ...s, color: attackerColor })),
    ...sideSquares(line.defender, dFront, dBack, 'd').map((s) => ({ ...s, color: defenderColor })),
  ];
  return (
    <div className={`tn-bgrid tn-well${active ? ' tn-bgrid--active' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="The battle line: attackers above, defenders below">
        {/* a faint surveyor's grid on the field */}
        <defs>
          <pattern id="tn-bgrid-p" width={STEP} height={STEP} patternUnits="userSpaceOnUse" x={(W % STEP) / 2} y="2">
            <path d={`M ${STEP} 0 H 0 V ${STEP}`} fill="none" stroke="rgba(201,162,75,.10)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#tn-bgrid-p)" />
        {/* no man's land: where the fronts meet */}
        <path d={`M 14 ${mid} H ${W - 14}`} stroke="rgba(201,162,75,.45)" strokeWidth="1" strokeDasharray="4 4" />
        <g className="tn-bgrid-swords" transform={`translate(${W / 2} ${mid})`}>
          <circle r="9" fill="#07090f" stroke="rgba(201,162,75,.7)" strokeWidth="1" />
          <path d="M -5 -5 L 5 5 M 5 -5 L -5 5" stroke="var(--gilt-hi)" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M -6 -2 L -2 -6 M 6 -2 L 2 -6" stroke="var(--gilt)" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        {squares.map((s) => (
          <g key={s.key}>
            <rect className="tn-bgrid-slot" x={s.x + 0.5} y={s.y + 0.5} width={CELL - 1} height={CELL - 1} rx="1" />
            <rect className={`tn-bgrid-sq${s.on ? '' : ' tn-lost'}`} x={s.x} y={s.y} width={CELL} height={CELL} rx="1.5"
              style={{ fill: s.color }}><title>{s.title}</title></rect>
          </g>
        ))}
      </svg>
    </div>
  );
}
