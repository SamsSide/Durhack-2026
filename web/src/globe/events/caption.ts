// The spotlight caption banner: a plain DOM element laid over the globe canvas. Lane b.
import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import { iconUrl } from './icons';
import { KIND_META } from './kinds';
import type { Story } from './kinds';
import { yearLabel } from '@terra/shared';

export interface CaptionUi { show(s: Story): void; hide(): void; setOn(on: boolean): void; destroy(): void }

export function mountCaption(parent: HTMLElement): CaptionUi {
  const root = document.createElement('div');
  root.className = 'ev-spot';
  root.setAttribute('aria-live', 'polite');
  const pill = document.createElement('div');
  pill.className = 'ev-spot-pill';
  pill.textContent = 'Spotlight on. Press S to stop';
  const card = document.createElement('div');
  card.className = 'ev-caption';
  root.append(pill, card);
  parent.appendChild(root);

  return {
    show(s) {
      card.replaceChildren();
      card.style.setProperty('--ev-color', KIND_META[s.kind].color);
      const icon = document.createElement('img');
      icon.className = 'ev-c-icon';
      icon.src = iconUrl(s.kind);
      icon.alt = '';
      card.appendChild(icon);
      const c = s.countryId != null ? useWorld.getState().world?.countries[s.countryId] : undefined;
      if (c) {
        const flag = document.createElement('span');
        flag.className = 'ev-c-flag';
        flag.innerHTML = flagSvg(c.flag, 36, 24); // generated from a FlagSpec, not user text
        card.appendChild(flag);
      }
      const text = document.createElement('div');
      text.className = 'ev-c-text';
      const kind = document.createElement('span');
      kind.className = 'ev-c-kind';
      kind.textContent = `${KIND_META[s.kind].label}, ${yearLabel(s.year)}`;
      const title = document.createElement('span');
      title.className = 'ev-c-title';
      title.textContent = s.title;
      text.append(kind, title);
      if (s.sub) {
        const sub = document.createElement('span');
        sub.className = 'ev-c-sub';
        sub.textContent = s.sub;
        text.appendChild(sub);
      }
      card.appendChild(text);
      card.classList.add('show');
    },
    hide() { card.classList.remove('show'); },
    setOn(on) { root.classList.toggle('on', on); if (!on) card.classList.remove('show'); },
    destroy() { root.remove(); },
  };
}
