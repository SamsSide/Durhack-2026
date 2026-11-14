// The era music on/off medallion for the top bar (X6 music bus). Remembered in localStorage.
import { audio } from './index';
import { useAudio } from './useAudio';

export function MusicToggle() {
  const { music } = useAudio();
  const label = music ? 'Music on (click to mute)' : 'Music off (click to play)';
  return (
    <button
      className="tn-button tn-button--lacquer tn-button--round"
      title={label}
      aria-label={label}
      aria-pressed={music}
      onClick={() => audio.setMusicEnabled(!music)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" style={{ opacity: music ? 1 : 0.55 }}>
        <path d="M6 2.5 14 1v9.6a2.2 2.2 0 1 1-1.4-2V4L7.4 5v7.1A2.2 2.2 0 1 1 6 10.1z" />
        {!music && <path d="M1.5 1.5 14.5 14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
