import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { requestBroadcastNow, useBroadcast } from './useBroadcast';
import { AnchorWindow } from './AnchorWindow';
import './news.css';
import { yearShort } from '@terra/shared';

/** Trigger one bulletin now (lane b's top-bar button). */
export const requestBroadcast = requestBroadcastNow;

const SLIDE_MS = 200;

/** "Terra Nova News": the broadcast window with the anchor, on top of the lower-third. No props, no positioning: the parent places it. */
export function NewsBroadcast() {
  const { bulletin, visible, duration, preparing, noSound, footage } = useBroadcast();
  const [mounted, setMounted] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (visible) { setMounted(true); return; }
    const t = setTimeout(() => setMounted(false), SLIDE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  useLayoutEffect(() => {
    if (!mounted || !boxRef.current || !textRef.current) return;
    setShift(Math.max(0, textRef.current.scrollHeight - boxRef.current.clientHeight));
  }, [mounted, bulletin]);

  if (!mounted || (!bulletin && !preparing)) return null;
  const showPreparing = preparing || !bulletin;

  return (
    <div className={`tn-newscast ${visible ? 'tn-newscast-in' : 'tn-newscast-out'}`}>
    <AnchorWindow bulletin={showPreparing ? null : bulletin} footage={footage} />
    <section
      className={`tn-news tn-lacquer tn-frame ${visible ? 'tn-news-in' : 'tn-news-out'}`}
      aria-label="Terra Nova News"
      role="status"
    >
      <div className="tn-news-tag">
        <span className="tn-news-name">Terra Nova News</span>
        <span className="tn-news-air"><span className={`tn-news-dot ${showPreparing ? 'tn-news-dot-idle' : ''}`} />On air</span>
      </div>
      {showPreparing || !bulletin ? (
        <div className="tn-news-body">
          <div className="tn-news-prep">Preparing the bulletin...</div>
        </div>
      ) : (
        <div className="tn-news-body">
          <div className="tn-news-head">
            <span className="tn-news-title">{bulletin.headline}</span>
            <span className="tn-news-year">
              {bulletin.anchor && <span className="tn-news-anchor">with {bulletin.anchor}</span>}
              {noSound && <span className="tn-news-nosound">(no sound)</span>}
              {yearShort(bulletin.year)}
            </span>
          </div>
          <div className="tn-news-script" ref={boxRef}>
            <div
              key={bulletin.id}
              ref={textRef}
              className="tn-news-text"
              style={{
                ['--tn-news-shift' as string]: `${shift}px`,
                ['--tn-news-dur' as string]: `${duration}s`,
                animationName: shift > 0 ? 'tn-news-scroll' : 'none',
              }}
            >
              {bulletin.script}
            </div>
          </div>
        </div>
      )}
    </section>
    </div>
  );
}
