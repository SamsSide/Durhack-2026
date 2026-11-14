import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../../state/world';
import './decree.css';

export function DecreeBox() {
  const world = useWorld((s) => s.world);
  const connected = useWorld((s) => s.connected);
  const send = useWorld((s) => s.send);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!world) return null;

  const proclaim = () => {
    const t = text.trim();
    if (!t || !connected) return;
    send({ type: 'control', action: 'decree', text: t });
    setText('');
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 2000);
  };

  return (
    <div className="tn-decree">
      {done && <span className="tn-decree-done" role="status">Proclaimed.</span>}
      <span className="tn-decree-label">Decree</span>
      <input
        className="tn-decree-input"
        value={text}
        maxLength={140}
        placeholder="A plague, a meteor, a prophet..."
        disabled={!connected}
        aria-label="Decree"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') proclaim(); }}
      />
      <button className="btn primary" disabled={!connected || !text.trim()} onClick={proclaim}>Proclaim</button>
    </div>
  );
}
