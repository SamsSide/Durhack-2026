import type { ComponentType } from 'react';
import * as ui from '../ui';

// Lane c's economy widgets (A27); resolved at run time so the app builds before they land.
const reg = ui as unknown as Record<string, ComponentType<Record<string, unknown>> | undefined>;
export const EconomyCounter = reg.EconomyCounter;
export const LedgerPanel = reg.LedgerPanel;
// Lane c's picture-card feed (#148); placed by lane b on the left under the network tab.
export const EventFeed = reg.EventFeed;
