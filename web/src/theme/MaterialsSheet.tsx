// The living reference for the material system (theme/materials.css). Open /?materials.
// Every class is shown on a mock night-and-terrain background. No server needed.
import type { CSSProperties, ReactNode } from 'react';

const label: CSSProperties = { font: '500 11px/1.3 var(--font-mono)', color: 'var(--color-text-muted)', letterSpacing: 0 };
const labelInk: CSSProperties = { ...label, color: 'var(--color-ink-muted)' };
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };
const col: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 };

function Tag({ children, ink }: { children: ReactNode; ink?: boolean }) {
  return <code style={ink ? labelInk : label}>{children}</code>;
}

/** A dark framed panel holding one group of samples. */
function Group({ title, children, width }: { title: string; children: ReactNode; width?: number }) {
  return (
    <section className="tn-lacquer tn-frame" style={{ padding: '18px 18px 16px', width }}>
      <div className="tn-header-bar tn-header-bar--night" style={{ ['--tn-bleed' as string]: '18px', marginTop: 0 }}>{title}</div>
      <div style={{ ...col, gap: 12, marginTop: 10 }}>{children}</div>
    </section>
  );
}

function PaperGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tn-sheet tn-frame" style={{ padding: '16px 18px' }}>
      <div className="tn-caps tn-engraved" style={{ color: 'var(--color-rubric)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>{title}</div>
      <hr className="tn-rule" style={{ margin: '6px 0 10px' }} />
      <div style={{ ...col, gap: 12 }}>{children}</div>
    </section>
  );
}

function TopBar() {
  const modes = ['Political', 'Terrain', 'Diplomacy', 'Strength', 'Wealth', 'Politics'];
  return (
    <header className="tn-lacquer tn-lacquer--bar-top" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 'var(--topbar-height)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', zIndex: 3 }}>
      <span className="tn-gilt-text" style={{ font: '700 20px/1 var(--font-display)', letterSpacing: '0.12em' }}>TERRA NOVA</span>
      <span className="tn-sep" />
      <span className="tn-stat tn-stat--dark" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, padding: '3px 10px' }}>
        <span className="tn-stat__value" style={{ fontSize: 22 }}>723</span>
        <span className="tn-stat__label">Jan</span>
      </span>
      <span className="tn-roundel tn-roundel--dot" title="Live" />
      <span className="tn-sep" />
      <div className="tn-well" role="tablist">
        {modes.map((m, i) => (
          <button key={m} type="button" className={`tn-seg${i === 0 ? ' tn-seg--active' : ''}`}>{m}</button>
        ))}
      </div>
      <span className="tn-sep" />
      <button type="button" className="tn-button tn-button--lacquer tn-button--round" aria-label="Pause">II</button>
      <span className="tn-stat tn-stat--dark" style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, padding: '3px 10px' }}>
        <span className="tn-stat__value" style={{ fontSize: 16 }}>2</span>
        <span className="tn-stat__label">years/s</span>
      </span>
      <div style={{ flex: 1 }} />
      <button type="button" className="tn-button tn-button--lacquer">Auto</button>
      <button type="button" className="tn-button tn-button--lacquer tn-button--danger">On air</button>
      <span className="tn-chip tn-chip--lacquer tn-chip--caps">0 tokens</span>
      <span className="tn-chip tn-chip--gilt tn-chip--caps">Mock</span>
      <span className="tn-sep" />
      <button type="button" className="tn-button tn-button--gilt">New world</button>
    </header>
  );
}

function NationCard() {
  return (
    <article className="tn-sheet tn-frame tn-frame--corners" style={{ width: 'var(--net-width)', padding: '26px 24px 18px' }}>
      <span className="tn-cartouche">Theocracy</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="tn-flag-plate" style={{ width: 62, height: 42, ['--flag-colour' as string]: '#c8412f' }}>
          <svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#c8412f" /><rect y="15" width="60" height="10" fill="#e9c46a" /><circle cx="30" cy="20" r="7" fill="#7a1f16" stroke="#e9c46a" strokeWidth="2" /></svg>
        </span>
        <h2 className="tn-engraved" style={{ margin: 0, font: '700 24px/1.05 var(--font-display)', letterSpacing: 'var(--tracking-caps)' }}>The Belmar Dominion</h2>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <span className="tn-roundel"><span className="tn-roundel__face">SS</span></span>
        <div style={{ flex: 1 }}>
          <div className="tn-stat__label">Ruler</div>
          <div style={{ font: '500 19px/1.2 var(--font-serif)' }}>Lord Sora Sato</div>
        </div>
        <span style={{ font: 'italic 14px var(--font-serif)', color: 'var(--color-ink-muted)' }}>aged 40</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 14 }}>
        <div className="tn-stat"><span className="tn-stat__label">Provinces</span><span className="tn-stat__value">110</span></div>
        <div className="tn-stat"><span className="tn-stat__label">Population</span><span className="tn-stat__value">680.1K</span></div>
        <div className="tn-stat"><span className="tn-stat__label">Treasury</span><span className="tn-stat__value">14,515<small>TNC</small></span></div>
      </div>
      <div style={{ ...col, gap: 6, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="tn-stat__label">Readiness</span><span style={{ font: '500 12px var(--font-mono)' }}>100%</span></div>
        <div className="tn-trough"><i className="tn-trough__fill" style={{ width: '100%', ['--fill' as string]: 'var(--color-ok)' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="tn-stat__label">Unrest</span><span style={{ font: '500 12px var(--font-mono)' }}>42%</span></div>
        <div className="tn-trough tn-trough--seg"><i className="tn-trough__fill" style={{ width: '42%', ['--fill' as string]: 'var(--color-warn)' }} /></div>
      </div>
      <div className="tn-header-bar">Diplomacy</div>
      <div style={{ ...row, gap: 6 }}>
        <span className="tn-chip tn-chip--war tn-chip--caps">Total war</span>
        <span className="tn-chip tn-chip--alliance tn-chip--caps">Alliance</span>
        <span className="tn-chip tn-chip--trade tn-chip--caps">Trade</span>
        <span className="tn-chip">Short of: food, timber</span>
      </div>
      <div className="tn-header-bar">The council</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="tn-roundel tn-roundel--sm"><span className="tn-roundel__face">YU</span></span>
        <div style={{ flex: 1 }}>
          <div className="tn-stat__label">General</div>
          <div style={{ font: '500 16px/1.2 var(--font-serif)' }}>Captain Yue</div>
        </div>
        <button type="button" className="tn-button tn-button--sm">Cut</button>
        <button type="button" className="tn-button tn-button--sm tn-button--danger">Kill</button>
      </div>
      <div className="tn-booktabs" role="tablist" style={{ marginTop: 16 }}>
        {['Culture', 'Economy', 'History'].map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={i === 0} className={`tn-booktab${i === 0 ? ' tn-booktab--active' : ''}`}>{t}</button>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', font: '16px/1.4 var(--font-serif)' }}>
        Dawn processions climb to the gilded shrines, and every harvest is blessed before it is sold.
      </p>
      <hr className="tn-rule" />
      <div style={{ ...row, gap: 6 }}>
        <button type="button" className="tn-chip">dawn processions</button>
        <button type="button" className="tn-chip is-active">gilded shrines</button>
      </div>
    </article>
  );
}

function Chronicle() {
  return (
    <footer className="tn-lacquer tn-lacquer--bar-bottom" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 'var(--ticker-height)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', zIndex: 3 }}>
      <span className="tn-cartouche tn-cartouche--inline">Chronicle</span>
      <span className="tn-sep" />
      <span style={{ font: '16px var(--font-serif)' }}>The armies of The Belmar Dominion take Salt Heights from The Corvane Pact.</span>
      <span style={{ font: '500 13px var(--font-mono)', color: 'var(--gilt)' }}>Y683</span>
      <span style={{ font: '16px var(--font-serif)' }}>Captain Yue takes command of the armies of the Belmar Dominion.</span>
      <div style={{ flex: 1 }} />
      <button type="button" className="tn-button tn-button--lacquer tn-button--sm">Timeline</button>
    </footer>
  );
}

export function MaterialsSheet() {
  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'auto',
      // A stand-in for the globe: bright terrain under the panels, to judge separation.
      background: 'radial-gradient(ellipse 55% 60% at 62% 55%, #c8442f 0, #b5432c 40%, #5f8f52 41%, #6f9a5a 60%, #1c3550 61%, #0b1828 75%, #090b12 100%)',
    }}>
      <div className="tn-scrim" />
      <TopBar />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 22, alignItems: 'flex-start', padding: '82px 16px 70px' }}>
        <div style={col}>
          <NationCard />
          <Tag>tn-sheet tn-frame tn-frame--corners + tn-cartouche</Tag>
        </div>

        <div style={{ ...col, gap: 22, width: 470 }}>
          <Group title="Buttons on lacquer">
            <div style={row}>
              <button type="button" className="tn-button tn-button--lacquer">Rest</button>
              <button type="button" className="tn-button tn-button--lacquer is-hover">Hover</button>
              <button type="button" className="tn-button tn-button--lacquer is-pressed">Pressed</button>
              <button type="button" className="tn-button tn-button--lacquer" disabled>Disabled</button>
              <button type="button" className="tn-button tn-button--lacquer tn-button--danger">Danger</button>
            </div>
            <Tag>tn-button tn-button--lacquer (.is-hover / .is-pressed only on this sheet)</Tag>
            <div style={row}>
              <button type="button" className="tn-button tn-button--gilt">Proclaim</button>
              <button type="button" className="tn-button tn-button--gilt is-hover">Hover</button>
              <button type="button" className="tn-button tn-button--gilt is-pressed">Pressed</button>
              <button type="button" className="tn-button tn-button--gilt" disabled>Disabled</button>
              <button type="button" className="tn-button tn-button--gilt tn-button--lg">New world</button>
            </div>
            <Tag>tn-button tn-button--gilt (one per screen) | --sm | --lg</Tag>
            <div style={row}>
              <button type="button" className="tn-button tn-button--lacquer tn-button--round" aria-label="Close">x</button>
              <button type="button" className="tn-button tn-button--lacquer tn-button--round" aria-label="Back">&lt;</button>
              <Tag>tn-button tn-button--lacquer tn-button--round</Tag>
            </div>
          </Group>

          <PaperGroup title="Buttons on parchment">
            <div style={row}>
              <button type="button" className="tn-button">Rest</button>
              <button type="button" className="tn-button is-hover">Hover</button>
              <button type="button" className="tn-button is-pressed">Pressed</button>
              <button type="button" className="tn-button" disabled>Disabled</button>
              <button type="button" className="tn-button tn-button--danger">Kill</button>
            </div>
            <Tag ink>tn-button | tn-button--danger | tn-button--sm</Tag>
            <div className="tn-booktabs">
              <button type="button" className="tn-booktab tn-booktab--active">Culture</button>
              <button type="button" className="tn-booktab is-hover">Economy</button>
              <button type="button" className="tn-booktab">Politics</button>
              <button type="button" className="tn-booktab">Relations</button>
            </div>
            <Tag ink>tn-booktabs &gt; tn-booktab / tn-booktab--active</Tag>
            <div className="tn-well tn-well--paper">
              <button type="button" className="tn-seg tn-seg--active">Years</button>
              <button type="button" className="tn-seg">Decades</button>
              <button type="button" className="tn-seg">Ages</button>
            </div>
            <Tag ink>tn-well tn-well--paper &gt; tn-seg / tn-seg--active</Tag>
          </PaperGroup>

          <section className="tn-sheet tn-frame tn-frame--slim" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tn-caps" style={{ color: 'var(--color-rubric)', fontSize: 'var(--text-xs)' }}>Decree</span>
            <input className="tn-input" style={{ flex: 1, minWidth: 0 }} placeholder="A plague, a meteor, a prophet..." />
            <button type="button" className="tn-button tn-button--gilt">Proclaim</button>
          </section>
          <Tag>tn-sheet tn-frame tn-frame--slim + tn-input + tn-button--gilt</Tag>
        </div>

        <div style={{ ...col, gap: 22, width: 420 }}>
          <Group title="Data">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <div className="tn-stat tn-stat--dark"><span className="tn-stat__label">Army</span><span className="tn-stat__value">474</span></div>
              <div className="tn-stat tn-stat--dark"><span className="tn-stat__label">Paid</span><span className="tn-stat__value">31.9k</span></div>
              <div className="tn-stat tn-stat--dark"><span className="tn-stat__label">Pending</span><span className="tn-stat__value">25</span></div>
            </div>
            <Tag>tn-stat tn-stat--dark (__label, __value)</Tag>
            <div className="tn-trough tn-trough--lg"><i className="tn-trough__fill" style={{ width: '64%' }} /></div>
            <div className="tn-trough tn-trough--seg"><i className="tn-trough__fill" style={{ width: '30%', ['--fill' as string]: 'var(--color-danger)' }} /></div>
            <Tag>tn-trough &gt; tn-trough__fill (--fill, width) | --seg | --lg</Tag>
            <div style={row}>
              <span className="tn-chip tn-chip--lacquer tn-chip--caps">6 up</span>
              <span className="tn-chip tn-chip--war tn-chip--caps">1 cut</span>
              <span className="tn-chip tn-chip--gilt tn-chip--caps">Mock</span>
            </div>
            <Tag>tn-chip--lacquer | --gilt | --war (+ --caps)</Tag>
            <hr className="tn-rule tn-rule--gilt" style={{ margin: 0 }} />
            <Tag>tn-rule tn-rule--gilt</Tag>
            <div className="tn-tooltip">
              <span className="tn-tooltip__title">Salt Heights</span>
              Held by <b>The Belmar Dominion</b> since Y683. Fish and timber; unrest 42%.
            </div>
            <Tag>tn-tooltip (+ __title, b)</Tag>
          </Group>

          <PaperGroup title="Chips, roundels, flags">
            <div style={row}>
              <span className="tn-chip">outline</span>
              <span className="tn-chip tn-chip--ink">ink</span>
              <span className="tn-chip tn-chip--war">war</span>
              <span className="tn-chip tn-chip--hostile">hostile</span>
              <span className="tn-chip tn-chip--neutral">neutral</span>
              <span className="tn-chip tn-chip--trade">trade</span>
              <span className="tn-chip tn-chip--alliance">alliance</span>
            </div>
            <Tag ink>tn-chip | --ink --war --hostile --neutral --trade --alliance | button.tn-chip.is-active</Tag>
            <div style={{ ...row, gap: 14 }}>
              <span className="tn-roundel tn-roundel--lg"><span className="tn-roundel__face">LS</span></span>
              <span className="tn-roundel"><span className="tn-roundel__face">CY</span></span>
              <span className="tn-roundel tn-roundel--sm"><span className="tn-roundel__face">A</span></span>
              <span className="tn-roundel tn-roundel--dot" />
              <span className="tn-roundel tn-roundel--dot" style={{ ['--dot' as string]: 'var(--color-danger)' }} />
              <span className="tn-flag-plate" style={{ width: 48, height: 32, ['--flag-colour' as string]: '#2f6d9a' }} />
              <span className="tn-flag-plate" style={{ width: 30, height: 20, ['--flag-colour' as string]: '#4d7a3a' }} />
            </div>
            <Tag ink>tn-roundel (--lg --sm --dot, __face) | tn-flag-plate (--flag-colour)</Tag>
            <div style={{ ...row, alignItems: 'flex-start' }}>
              <div className="tn-stat" style={{ flex: 1 }}><span className="tn-stat__label">Population</span><span className="tn-stat__value">680.1K</span></div>
              <div className="tn-stat" style={{ flex: 1 }}><span className="tn-stat__label">Devastation</span><span className="tn-stat__value">0%</span></div>
            </div>
            <Tag ink>tn-stat (on parchment)</Tag>
          </PaperGroup>
        </div>

        <div style={{ ...col, gap: 22, width: 360 }}>
          <Group title="Text and plates">
            <div className="tn-gilt-text" style={{ font: '700 34px/1 var(--font-display)', letterSpacing: '0.1em' }}>Year 723</div>
            <Tag>tn-gilt-text (dark only)</Tag>
            <div className="tn-engraved--dark tn-caps" style={{ fontSize: 'var(--text-sm)' }}>Engraved on lacquer</div>
            <Tag>tn-engraved--dark tn-caps</Tag>
            <div style={{ ...row, alignItems: 'flex-start', gap: 18 }}>
              <span className="tn-pennant">The Corvane Pact</span>
              <span className="tn-cartouche tn-cartouche--inline">Republic</span>
            </div>
            <Tag>tn-pennant | tn-cartouche--inline</Tag>
            <div className="tn-well">
              <button type="button" className="tn-seg tn-seg--active">1x</button>
              <button type="button" className="tn-seg is-hover">2x</button>
              <button type="button" className="tn-seg">5x</button>
            </div>
            <Tag>tn-well &gt; tn-seg / tn-seg--active</Tag>
          </Group>
          <section className="tn-sheet" style={{ padding: '14px 16px' }}>
            <div className="tn-caps tn-engraved" style={{ color: 'var(--color-rubric)', fontWeight: 700 }}>Plain sheet</div>
            <p style={{ margin: '6px 0 0', font: '16px/1.4 var(--font-serif)' }}>A bare tn-sheet: grain, mottling, a warm vignette and a dark edge line, no gilt band.</p>
          </section>
          <Tag>tn-sheet</Tag>
          <section className="tn-lacquer tn-frame tn-frame--corners" style={{ padding: '26px 18px 16px' }}>
            <span className="tn-cartouche">Dispatch</span>
            <p style={{ margin: 0, font: '16px/1.4 var(--font-serif)' }}>A dark framed panel with corner brackets, for a closing card or a herald.</p>
          </section>
          <Tag>tn-lacquer tn-frame tn-frame--corners</Tag>
        </div>
      </div>
      <Chronicle />
    </div>
  );
}
