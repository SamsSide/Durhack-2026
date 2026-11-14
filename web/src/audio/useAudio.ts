import { useSyncExternalStore } from 'react';
import { audio } from './index';

export function useAudio() {
  return useSyncExternalStore(audio.subscribe, audio.getState);
}
