import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { requestBroadcastNow, useBroadcast } from './useBroadcast';
import './news.css';

/** Trigger one bulletin now (lane b's top-bar button). */
export const requestBroadcast = requestBroadcastNow;

const SLIDE_MS = 200;

/** The "Terra Nova News" lower-third. No props, no positioning: the parent places it. */
export function NewsBroadcast() {
  const { bulletin, visible, duration } = useBroadcast();
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

  if (!mounted || !bulletin) return null;

  return (
    <section
      className={`tn-news ${visible ? 'tn-news-in' : 'tn-news-out'}`}
      aria-label="Terra Nova News"
      role="status"
    >
      <div className="tn-news-tag">
        <span className="tn-news-name">Terra Nova News</span>
        <span className="tn-news-air"><span className="tn-news-dot" />On air</span>
      </div>
      <div className="tn-news-body">
        <div className="tn-news-head">
          <span className="tn-news-title">{bulletin.headline}</span>
          <span className="tn-news-year">Y{bulletin.year}</span>
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
    </section>
  );
}
