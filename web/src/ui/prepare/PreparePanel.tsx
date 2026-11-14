// C12: demo "prepare" mode (X2 Prepare). The world waits paused while lore, voices, chants, anthems
// and first ruler decisions are made; this panel shows each nation's progress and a Play button.
import { useEffect } from 'react';
import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import type { PrepareItem } from '../../state/world';
import { isPaused, playedBefore, requestPrepare, usePrepareUi } from './state';
import './prepare.css';

const KINDS: { kind: PrepareItem['kind']; label: string }[] = [
  { kind: 'lore', label: 'Lore' },
  { kind: 'narration', label: 'Voice' },
  { kind: 'chant', label: 'Chant' },
  { kind: 'anthem', label: 'Anthem' },
  { kind: 'ruler', label: 'Ruler' },
];
const STATUS_WORD: Record<PrepareItem['status'], string> = { pending: 'waiting', working: 'being made', ready: 'ready', failed: 'failed' };

function Mark({ status }: { status: PrepareItem['status'] | 'none' }) {
  if (status === 'ready') return <svg width="11" height="9" viewBox="0 0 12 10" aria-hidden="true"><path d="M1 5L4.5 8.5L11 1" stroke="currentColor" strokeWidth="2" fill="none" /></svg>;
  if (status === 'failed') return <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>;
  return <i className="tn-prep-dot" aria-hidden="true" />;
}

/** What to show: the open panel, the top-bar pill, or nothing. */
function usePrepareView() {
  const prepare = useWorld((s) => s.prepare);
  const paused = useWorld(isPaused);
  const hidden = usePrepareUi((s) => s.hidden);
  const played = usePrepareUi((s) => s.played) || playedBefore(prepare?.worldId);
  const live = !!prepare && !played && (!prepare.done || paused);   // still worth a Play button
  return { prepare, panel: live && !hidden, pill: !!prepare && ((live && hidden) || (played && !prepare.done)) };
}

export function PreparePanel() {
  const { prepare, panel } = usePrepareView();
  const world = useWorld((s) => s.world);
  const hide = usePrepareUi((s) => s.hide);
  const play = usePrepareUi((s) => s.play);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); hide(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, hide]);

  if (!prepare || !panel || !world) return null;
  const { done, ready, total, items } = prepare;
  const failed = items.filter((it) => it.status === 'failed').length;
  const ids = [...new Set(items.map((it) => it.countryId))];
  const nations = world.countries.filter((c) => ids.includes(c.id));
  const pct = total > 0 ? Math.min(100, ((ready + failed) / total) * 100) : 0;

  return (
    <div className="tn-prep-veil" onClick={hide}>
      <section className={`tn-lacquer tn-frame tn-prep${done ? ' done' : ''}`} role="dialog" aria-label="Preparing the world" onClick={(e) => e.stopPropagation()}>
        <span className="tn-cartouche">{done ? 'Ready for the demo' : 'Before the demo'}</span>
        <header className="tn-prep-head">
          <div>
            <h2 className="tn-prep-title">{done ? 'The world is ready' : 'Preparing the world'}</h2>
            <p className="tn-prep-sub">{done
              ? `${world.name} waits paused. Press play to begin.`
              : 'The world waits paused while lore, voices, chants and anthems are made.'}</p>
          </div>
          <button type="button" className="tn-button tn-button--lacquer tn-button--sm tn-prep-hide" onClick={hide} title="Hide (Esc)">Hide</button>
        </header>

        <div className="tn-prep-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={ready}>
          <div className="tn-trough tn-trough--lg tn-trough--seg tn-prep-bar"><i className="tn-trough__fill" style={{ width: `${pct}%` }} /></div>
          <span className="tn-prep-count"><b>{ready}</b> of {total} ready{failed > 0 && <em> · {failed} failed</em>}</span>
        </div>

        <ul className="tn-prep-list">
          {nations.map((c) => (
            <li key={c.id} className="tn-prep-row">
              <span className="tn-flag-plate tn-prep-flag" dangerouslySetInnerHTML={{ __html: flagSvg(c.flag, 30, 20) }} />
              <span className="tn-prep-name" title={c.name}>{c.name}</span>
              <span className="tn-prep-chips">
                {KINDS.map(({ kind, label }) => {
                  const status = items.find((it) => it.countryId === c.id && it.kind === kind)?.status ?? 'none';
                  const word = status === 'none' ? 'not made for this nation' : STATUS_WORD[status];
                  return (
                    <span key={kind} className={`tn-chip tn-chip--lacquer tn-prep-chip ${status}`} title={`${label}: ${word}`} aria-label={`${label}: ${word}`}>
                      <Mark status={status} />{label}
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>

        <footer className="tn-prep-foot">
          <p className="tn-prep-note">{done
            ? (failed > 0 ? 'What failed will be made again when it is first needed.' : 'Every voice, chant and anthem is waiting.')
            : 'You can start at any time. The rest carries on in the background.'}</p>
          <button type="button" className={`tn-button tn-button--gilt tn-button--lg tn-prep-play${done ? ' ready' : ''}`} onClick={play} autoFocus>
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1L11 7L1 13Z" fill="currentColor" /></svg>
            {done ? 'Play' : 'Play now'}
          </button>
        </footer>
      </section>
    </div>
  );
}

/** The collapsed panel: a small pill for the top bar that still shows progress. */
export function PreparePill() {
  const { prepare, pill } = usePrepareView();
  const show = usePrepareUi((s) => s.show);
  const played = usePrepareUi((s) => s.played);
  if (!prepare || !pill) return null;
  const { done, ready, total } = prepare;
  const pct = total > 0 ? Math.min(100, (ready / total) * 100) : 0;
  return (
    <button type="button" className={`tn-button tn-button--lacquer tn-prep-pill${done ? ' ready' : ''}`} onClick={show} disabled={played} title={played ? 'Still being made in the background' : 'Open the prepare panel'}>
      <span className="tn-prep-pill-bar"><i style={{ width: `${pct}%` }} /></span>
      <span className="tn-prep-pill-word">{done ? 'Ready' : 'Preparing'}</span>
      <span className="tn-prep-pill-num">{ready}/{total}</span>
    </button>
  );
}

/** Network panel row: prepare the world that is already running (X2 `prepare` control). */
export function PrepareSwitch() {
  const prepare = useWorld((s) => s.prepare);
  const show = usePrepareUi((s) => s.show);
  const played = usePrepareUi((s) => s.played);
  const running = !!prepare && !prepare.done;
  const onClick = () => {
    if (running) { if (!played) show(); return; }
    requestPrepare();
  };
  return (
    <button type="button" className={`tn-net-switch tn-prep-switch${running ? ' on' : ''}`} onClick={onClick}>
      <span>
        <span className="tn-sw-title">Prepare for a demo</span>
        <span className="tn-sw-sub">{running ? `Making lore, voices and anthems · ${prepare.ready} of ${prepare.total}` : 'Pause and pre-make lore, voices and anthems'}</span>
      </span>
      <span className="tn-prep-switch-go">{running ? 'Working' : 'Prepare'}</span>
    </button>
  );
}
