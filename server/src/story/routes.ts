// X3 story routes: lore, narration, anthem, chant, painted flag. Mock mode serves bundled samples.
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorldRunner } from '../runner';
import { countryLore, regionLore } from './lore';

const SAMPLES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'samples');

export function storyRoutes(runner: WorldRunner): Router {
  const r = Router();
  const countryId = (s: string | undefined) => {
    const id = Number(s);
    const w = runner.getWorld();
    return w && Number.isInteger(id) && w.countries[id] ? id : null;
  };

  r.get('/country/:id/lore', (req, res) => {
    const id = countryId(req.params.id);
    const w = runner.getWorld();
    if (id === null || !w) return void res.status(404).json({ error: 'no such country' });
    res.json(countryLore(w, id));
  });

  for (const kind of ['narration', 'anthem', 'chant'] as const) {
    r.get(`/country/:id/${kind}`, (req, res) => {
      if (countryId(req.params.id) === null) return void res.status(404).json({ error: 'no such country' });
      res.type('audio/mpeg').sendFile(path.join(SAMPLES, `${kind}.mp3`));
    });
  }

  r.get('/country/:id/flag', (req, res) => {
    if (countryId(req.params.id) === null) return void res.status(404).json({ error: 'no such country' });
    res.status(503).json({ error: 'image generation off' });
  });

  r.get('/region/:id/lore', (req, res) => {
    const w = runner.getWorld();
    const lore = w ? regionLore(w, Number(req.params.id)) : null;
    if (!lore) return void res.status(404).json({ error: 'no such region' });
    res.json(lore);
  });
  return r;
}
