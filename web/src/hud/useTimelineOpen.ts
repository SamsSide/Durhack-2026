import { useEffect, useState } from 'react';

// The chronicle's timeline covers the bottom-right corner, so overlays there hide while it is open.
export function useTimelineOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector('.tn-chron-timeline'));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return open;
}
