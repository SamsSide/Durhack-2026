// Age of History style hover tooltip over the globe: a nation's flag, name, place and province
// count, or an unclaimed province's terrain and region. Follows the cursor; DOM, not WebGL. Lane b.
import { useEffect, useMemo, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useHover } from '../camera/usePicking';
import './hover.css';

const SHOW_DELAY = 160; // ms on one tile before the tooltip appears
const HIDE_DELAY = 90; // ms of nothing before it goes, so crossing a border does not flicker
const OFFSET = 18;

const TERRAIN_NAMES: Record<string, string> = {
  coast: 'Coast', plains: 'Plains', forest: 'Forest', desert: 'Desert', hills: 'Hills', mountain: 'Mountains', ice: 'Ice',
};

export function HoverTooltip() {
  const hovered = useHover((s) => s.tile);
  const world = useWorld((s) => s.world);
  const version = useWorld((s) => s.version);
  const [tile, setTile] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0, down: false });

  // Debounce: appear after a short rest, swap instantly once shown, leave after a short gap.
  useEffect(() => {
    if (hovered < 0) {
      const t = window.setTimeout(() => setTile(-1), HIDE_DELAY);
      return () => window.clearTimeout(t);
    }
    if (tile >= 0) { setTile(hovered); return; }
    const t = window.setTimeout(() => setTile(hovered), SHOW_DELAY);
    return () => window.clearTimeout(t);
  }, [hovered]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the cursor without re-rendering React.
  useEffect(() => {
    const place = () => {
      const el = box.current;
      if (!el) return;
      const { x, y } = pointer.current;
      const w = el.offsetWidth, h = el.offsetHeight;
      const left = x + OFFSET + w > window.innerWidth - 8 ? x - OFFSET - w : x + OFFSET;
      const top = y + OFFSET + h > window.innerHeight - 8 ? y - OFFSET - h : y + OFFSET;
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    const onMove = (e: PointerEvent) => { pointer.current.x = e.clientX; pointer.current.y = e.clientY; place(); };
    const onDown = () => { pointer.current.down = true; box.current?.classList.add('dragging'); };
    const onUp = () => { pointer.current.down = false; box.current?.classList.remove('dragging'); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    place();
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const info = useMemo(() => {
    if (!world || tile < 0) return null;
    const t = world.tiles[tile];
    if (!t || t.terrain === 'ocean') return null;
    const region = t.region >= 0 ? world.regions[t.region] : undefined;
    const owner = world.owner[tile] ?? -1;
    const country = owner >= 0 ? world.countries[owner] : undefined;
    if (!country) {
      return { kind: 'land' as const, title: TERRAIN_NAMES[t.terrain] ?? t.terrain, sub: region?.name || 'Unclaimed land' };
    }
    let provinces = 0;
    for (const o of world.owner) if (o === owner) provinces++;
    const capRegion = world.tiles[country.capitalTile]?.region ?? -1;
    const place = region?.name || (capRegion >= 0 ? world.regions[capRegion]?.name : '') || '';
    const flag = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flagSvg(country.flag, 60, 40));
    return { kind: 'nation' as const, title: country.name, sub: place, provinces, flag };
  }, [world, tile, version]);
  // Keep the last content while the panel fades out.
  const last = useRef(info);
  if (info) last.current = info;
  const shown = info ?? last.current;

  return (
    <div ref={box} className={`hover-tip${info ? ' on' : ''}`} aria-hidden>
      {shown?.kind === 'nation' && (
        <>
          <div className="ht-head">
            <img className="ht-flag" src={shown.flag} alt="" width={42} height={28} />
            <div className="ht-names">
              <div className="ht-title">{shown.title}</div>
              {shown.sub && <div className="ht-sub">{shown.sub}</div>}
            </div>
          </div>
          <div className="ht-row"><span className="ht-cap">Provinces</span><span className="ht-num">{shown.provinces}</span></div>
        </>
      )}
      {shown?.kind === 'land' && (
        <div className="ht-names">
          <div className="ht-title">{shown.title}</div>
          <div className="ht-sub">{shown.sub}</div>
        </div>
      )}
    </div>
  );
}
