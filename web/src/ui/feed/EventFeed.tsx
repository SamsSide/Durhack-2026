import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useFeed } from './useFeed';
import type { FeedCard, FeedKind } from './useFeed';
import './feed.css';

const ICONS: Record<FeedKind, JSX.Element> = {
  // city tower
  city: <path d="M5 20V9l2-1V5h2v3l2 1v11zm9 0V12l3-1.5V8h2v2.5L21 12v8zM8 14h2v2H8zm9 2h2v2h-2z" />,
  // crossed swords
  war: <path d="M4 4l6 6-1.5 1.5L4 7zm16 0v3l-4.5 4.5L14 10zM9 13l2 2-5 5H4v-2zm6 0l5 5v2h-2l-5-5z" />,
  // scroll
  treaty: <path d="M7 4h11a2 2 0 012 2v1h-2v9a3 3 0 01-3 3H6a3 3 0 003-3V7a3 3 0 00-2-3zm3 5h6v1.5h-6zm0 3h6v1.5h-6z" />,
  alliance: <path d="M7 4h11a2 2 0 012 2v1h-2v9a3 3 0 01-3 3H6a3 3 0 003-3V7a3 3 0 00-2-3zm3 5h6v1.5h-6zm0 3h6v1.5h-6z" />,
  // broken crown
  fall: <path d="M3 18V8l4 4 3-6 1.5 4L9 14l3 2-2 2zm9.5 0l2-2-2-3 2.5-3.5L17 12l4-4v10z" />,
  // banner
  born: <path d="M6 3h2v18H6zm3 1h10l-3 4 3 4H9z" />,
  // seal
  decree: <path d="M12 3l2 2 3-.5.5 3 2.5 1.5-1.5 2.5L20 15l-2.5 1.5-.5 3-3-.5-2 2-2-2-3 .5-.5-3L4 15l1.5-2.5L4 10l2.5-1.5.5-3 3 .5zm0 6a3 3 0 100 6 3 3 0 000-6z" />,
  // star
  wonder: <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />,
  // dark mark
  death: <path d="M12 3a8 8 0 00-8 8c0 2.6 1.3 4.9 3.3 6.3V21h9.4v-3.7A8 8 0 0012 3zM9 10a1.8 1.8 0 110 3.6A1.8 1.8 0 019 10zm6 0a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6zm-4 5h2l-1 2z" />,
  // crown
  succession: <path d="M3 18l-1-11 5 4 5-7 5 7 5-4-1 11zm1 1.5h16V21H4z" />,
};

function Icon({ kind }: { kind: FeedKind }) {
  return (
    <svg className={`tn-feed-icon tn-feed-${kind}`} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

function open(card: FeedCard) {
  const main = card.countries[0];
  if (!main) return;
  useWorld.getState().flyTo(main.id);
  if (card.tileId != null) {
    window.dispatchEvent(new CustomEvent('terra:focus-tile', { detail: { tileId: card.tileId } }));
  }
}

function Card({ card }: { card: FeedCard }) {
  return (
    <button type="button" className={`tn-feed-card tn-lacquer tn-frame tn-frame--slim${card.gone ? ' tn-feed-out' : ''}`} onClick={() => open(card)} title={card.title}>
      <span className="tn-feed-thumb">
        {card.thumb && <img src={card.thumb} alt="" width={144} height={81} />}
        <Icon kind={card.kind} />
      </span>
      <span className="tn-feed-text">
        <span className="tn-feed-flags">
          {card.countries.map((c) => (
            <span key={c.id} className="tn-feed-flag tn-flag-plate" dangerouslySetInnerHTML={{ __html: flagSvg(c.flag, 30, 20) }} />
          ))}
          <span className="tn-feed-year">Y{card.year}</span>
        </span>
        <span className="tn-feed-title">{card.title}</span>
      </span>
    </button>
  );
}

/** Picture cards for the world's big moments, newest on top. Placed by its parent (lane b). */
export function EventFeed() {
  const { cards, world } = useFeed();
  if (!world || cards.length === 0) return null;
  return (
    <div className="tn-feed" role="log" aria-label="World events">
      {cards.map((c) => <Card key={c.id} card={c} />)}
    </div>
  );
}
