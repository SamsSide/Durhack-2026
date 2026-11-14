import type { ReactNode } from 'react';
import { MapModeIcon } from '../../hud/mapModeIcons';
import type { MapMode } from '../../hud/mapModeIcons';
import { HourglassIcon, QuillIcon, ScrollIcon } from '../collapse/icons';
import '../feed/feed.css';
import '../economy/economy.css';
import '../meter/meter.css';
import './help.css';
import { useHelp } from './useHelp';

const QIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4" /><path d="M12 17.5v.5" />
  </svg>
);

/** The round "?" button, beside the chronicle and history buttons in the bottom-left corner. */
export function HelpButton() {
  const set = useHelp((s) => s.set);
  return (
    <button
      type="button"
      className="tn-button tn-button--round tn-button--lacquer tn-collapsed-icon tn-collapsed-icon--help"
      title="Help (? or F1)"
      aria-label="Show the help screen"
      onClick={() => set(true)}
    >
      <QIcon />
      <span className="tn-tooltip tn-collapsed-tip" role="tooltip">Help (? or F1)</span>
    </button>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="tn-help-row">
      <span className="tn-help-icon">{icon}</span>
      <span className="tn-help-text"><b>{label}</b> {children}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tn-help-sec">
      <h3 className="tn-help-h">{title}</h3>
      <ul className="tn-help-list">{children}</ul>
    </section>
  );
}

const Dot = ({ cls = '' }: { cls?: string }) => <i className={`tn-roundel tn-roundel--dot tn-help-dot ${cls}`} />;
const Round = ({ children }: { children: ReactNode }) => (
  <span className="tn-button tn-button--round tn-button--lacquer tn-help-round" aria-hidden="true">{children}</span>
);
const Tag = ({ tag }: { tag: string }) => <span className={`tn-feed-tag tn-feed-tag-${tag.toLowerCase()}`}>{tag}</span>;
const Chip = ({ children }: { children: ReactNode }) => <span className="tn-help-chip tn-lacquer">{children}</span>;
const Key = ({ k }: { k: string }) => <kbd className="tn-help-key">{k}</kbd>;

const MODES: [MapMode, string][] = [
  ['political', 'Political: who owns which land'],
  ['terrain', 'Terrain: land, sea, mountains'],
  ['diplomacy', 'Diplomacy: wars, treaties, alliances'],
  ['strength', 'Strength: armies and power'],
  ['wealth', 'Wealth: rich and poor nations'],
  ['politics', 'Politics: how each nation is ruled'],
];

const KEYS: [string, string][] = [
  ['1 to 6', 'Map mode'],
  ['P', 'Presentation mode (hides every panel)'],
  ['S', 'Spotlight tour of big moments'],
  ['H', 'Chronicle timeline'],
  ['End', 'Closing card: what this world cost'],
  ['? or F1', 'This help screen'],
  ['Esc', 'Close the panel in front'],
];

export function HelpScreen() {
  const open = useHelp((s) => s.open);
  const set = useHelp((s) => s.set);
  if (!open) return null;
  return (
    <div className="tn-help-veil" onClick={() => set(false)}>
      <div className="tn-help tn-sheet tn-frame tn-frame--corners" role="dialog" aria-modal="true" aria-label="Help" onClick={(e) => e.stopPropagation()}>
        <header className="tn-help-head">
          <h2 className="tn-help-title">How to read Terra Nova</h2>
          <p className="tn-help-sub">A living planet. Every nation is ruled by its own AI. Press <Key k="?" /> or <Key k="Esc" /> to close.</p>
          <button type="button" className="tn-button tn-button--round tn-help-close" aria-label="Close help" title="Close (Esc)" onClick={() => set(false)}>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
          </button>
        </header>
        <div className="tn-help-grid">
          <Section title="Top bar">
            <Row icon={<b className="tn-help-name">Name</b>} label="World name and age">at the left, with the year and date beside them.</Row>
            <Row icon={<Dot cls="live" />} label="Live">the server connection. Reconnecting or Offline if it drops.</Row>
            <Row icon={<Round><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z" /></svg></Round>} label="Pause">stop or resume time.</Row>
            <Row icon={<Chip>1w to 10y</Chip>} label="Speed gears">drag the slider: a week to ten years per second.</Row>
            <Row icon={<Chip>Auto</Chip>} label="Auto">the director slows time for big moments.</Row>
            <Row icon={<Chip><Dot cls="onair" />On air</Chip>} label="On air">play the Terra Nova News broadcast.</Row>
            <Row icon={<Round><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M6 2.5 14 1v9.6a2.2 2.2 0 1 1-1.4-2V4L7.4 5v7.1A2.2 2.2 0 1 1 6 10.1z" /></svg></Round>} label="Music">turn the soundtrack on or off.</Row>
            <Row icon={<span className="tn-meter tn-help-meter"><span className="num">12</span> calls<span className="dot">·</span><span className="mode">Mock</span></span>} label="Calls and tokens">how much AI the world has used. Mock is scripted, Live is real. Click it for the closing card.</Row>
            <Row icon={<Chip>New world</Chip>} label="New world">found another world.</Row>
          </Section>

          <Section title="News and dispatches">
            <Row icon={<Tag tag="WAR" />} label="War, fall, peace">cards in the feed down the left. Click one to fly to the place.</Row>
            <Row icon={<Tag tag="DECREE" />} label="Decree, wonder">what a ruler or you proclaimed, and great works.</Row>
            <Row icon={<Tag tag="DECADE" />} label="Decade">quiet growth rolled into one card.</Row>
            <Row icon={<span className="tn-help-tags"><Tag tag="SECESSION" /><Tag tag="COUP" /><Tag tag="CAPITAL" /></span>} label="Secession, coup, capital">a nation splits, a ruler is overthrown, a capital moves.</Row>
            <Row icon={<span className="tn-help-tags"><Tag tag="SILENCE" /><Tag tag="RETURN" /><Tag tag="TRADE" /><Tag tag="PEACE" /></span>} label="Silence, return, trade, peace">a nation goes quiet and may come back; payments; treaties.</Row>
            <Row icon={<Chip>War tabs</Chip>} label="Dispatch tabs">top right: wars, falls, returns and decree results. Click to fly there.</Row>
          </Section>

          <Section title="Map and globe">
            <Row icon={<span className="tn-help-minimap" />} label="Minimap">flat map of the world. Click or drag to turn the globe.</Row>
            {MODES.map(([m, text], i) => (
              <Row key={m} icon={<Round><MapModeIcon mode={m} size={16} /></Round>} label={`Key ${i + 1}`}>{text}.</Row>
            ))}
            <Row icon={<span className="tn-help-council" />} label="Council marker">a nation's seat on the globe. Click to select it.</Row>
            <Row icon={<Chip>12.0k</Chip>} label="Armies and battles">click an army's counter for its troops and general, or a battle's badge for both sides and their losses.</Row>
            <Row icon={<span className="tn-help-arc" />} label="Payment arc">money moving between nations. Click for the Solana Explorer.</Row>
            <Row icon={<span className="tn-help-seal" />} label="Wax seal">a payment confirmed on Solana. Click it to see the transaction.</Row>
          </Section>

          <Section title="Panels">
            <Row icon={<span className="tn-help-net tn-lacquer">The Network</span>} label="Network">top left. Every nation as a node; cut or restore its link.</Row>
            <Row icon={<span className="tn-chip tn-chip--caps tn-chip--lacquer tn-state up"><i />3 up</span>} label="UP badge">how many nations are connected.</Row>
            <Row icon={<span className="tn-help-chip tn-lacquer">TNC 12 paid</span>} label="TNC paid">payments made between nations, in Terra Nova coin.</Row>
            <Row icon={<span className="tn-help-card tn-sheet">Nation</span>} label="Nation card">click a province. Ruler, laws, wealth and relations.</Row>
            <Row icon={<Round><QuillIcon /></Round>} label="Decree box">bottom right. Write your decree, or hold the microphone to speak it, then Proclaim.</Row>
          </Section>

          <Section title="Bottom left">
            <Row icon={<Round><ScrollIcon /></Round>} label="Chronicle">the ticker of what happened. Press H for the full timeline.</Row>
            <Row icon={<Round><HourglassIcon /></Round>} label="History">the scrubber: rebuild the globe at any past year.</Row>
            <Row icon={<Round><QIcon /></Round>} label="Help">this screen.</Row>
          </Section>

          <Section title="Keys, anywhere">
            {KEYS.map(([k, text]) => (
              <Row key={k} icon={<Key k={k} />} label="">{text}</Row>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
