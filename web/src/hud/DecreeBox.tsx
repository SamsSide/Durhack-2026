import { useEffect, useRef, useState } from 'react';
import { useWorld } from '../state/world';
import './hud.css';

export function DecreeBox() {
  const hasWorld = useWorld((s) => s.world != null);
  const connected = useWorld((s) => s.connected);
  const send = useWorld((s) => s.send);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const disabled = !hasWorld || !connected;
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    send({ type: 'control', action: 'decree', text: t });
    setText('');
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 2000);
  };
  return (
    <form className="hud decree" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <span className="cap">Decree</span>
      <input value={text} disabled={disabled} maxLength={280} placeholder={disabled ? 'Not connected' : 'A plague, a meteor, a prophet...'} onChange={(e) => setText(e.target.value)} />
      {done ? <span className="done">Decreed</span> : null}
      <button type="submit" className="btn" disabled={disabled || !text.trim()}>Proclaim</button>
    </form>
  );
}
