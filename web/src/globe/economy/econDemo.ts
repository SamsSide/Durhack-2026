// Dev-only: fill plausible B11 values into the store until the sim sends them. Run __econDemo() in the console.
import { useWorld } from '../../state/world';

export function installEconDemo(): void {
  if (!import.meta.env.DEV) return;
  (window as unknown as { __econDemo: (on?: boolean) => void }).__econDemo = (on = true) => {
    const s = useWorld.getState();
    const w = s.world;
    if (!w) return;
    if (!on) {
      delete w.devastation;
      for (const c of w.countries) { delete c.warReadiness; delete c.politics; }
    } else {
      w.devastation = w.tiles.map((t) => {
        const o = w.owner[t.id] ?? -1;
        return o < 0 || t.terrain === 'ocean' ? 0 : ((t.id * 37) % 11 === 0 ? 40 + ((t.id * 13) % 60) : (t.id % 7) * 3);
      });
      w.countries.forEach((c, i) => {
        c.warReadiness = [85, 62, 55, 75, 90, 95][i % 6];
        c.politics = { axis: [-90, 70, 0, -30, 100, 25][i % 6]!, radicalism: [80, 70, 10, 30, 90, 40][i % 6]! };
      });
    }
    useWorld.setState({ version: s.version + 1 });
  };
}
