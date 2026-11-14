# Lane c plan — Multimodal: image prompt, spoken decrees, Terra Nova News

- **Rows:** C6, C7, C8 (lane a's request #73, for rows A17, A20, A21)
- **Branch:** `c/multimodal`
- **Paths allowed:** `web/src/ui/` only (anything else: NEEDS_OTHER_LANE for `web/src/globe/`,
  `web/src/audio/`, `App.tsx`; NEEDS_OWNER for `web/src/theme/`, `server/`, dependencies)
- **Contracts:** X3 `POST /api/world` `imageBase64`, `POST /api/decree/voice`,
  `POST /api/broadcast`, `GET /api/broadcast/:id/audio`; X5 `NewsBroadcast`; X6
  `audio.playBroadcast` and the `'broadcast'` state (arrive with A21); lane b's
  `captureGlobe()` in `web/src/globe/capture.ts` (not yet on main).
- **Done when:** on `main`:
  - a picture can be dropped on Create and is sent with the prompt;
  - holding the mic records a decree and shows the transcript;
  - the news lower-third runs every 2 minutes and on demand, against `npm run mock`.

Decisions from lane c (14 Nov):
- Build now against stubs; nobody waits.
- No Figma frames exist for these, so derive the look from the atlas tokens and
  `docs/design/reference.html`. The owner was asked on #73 whether to design frames; if
  frames come, we restyle.
- Three agents in parallel on Sonnet.

## Shared rules for all tasks

As in `docs/plans/c-design-restyle.md` *Shared rules*:
- variables only, never edit `tokens.css`;
- Cinzel for labels, EB Garamond for body text, Plex Mono for numbers;
- inline SVG icons only; no emojis, blur or sans-serif;
- `tn-` class prefix; no new dependencies; no browser dialogs;
- every fetch handles 404, 503 and network errors quietly. The server routes may not exist yet
  (lane a is building them), so a 404 must degrade gracefully, never crash.

`App.tsx` and lane a and b files must not change. Batched agents run `npm run -s typecheck` and
`npm run -s build -w web` only.

## Task 1: C6 Image drop zone on CreateScreen

- **Agent:** durhack-frontend · **Model:** sonnet · **Parallel with:** 2, 3
- **Files:** `web/src/ui/create/CreateScreen.tsx`, `create.css`, and a new
  `web/src/ui/create/imagePick.ts`
- **Build:**
  - **Drop zone:** an optional "Picture (optional)" plate under the prompt box, styled as a
    dashed 1px ink rectangle about 64 px tall, with the italic text "Drop a picture to set the
    mood, or choose one". It is keyboard reachable, a hidden `<input type="file"
    accept="image/jpeg,image/png,image/webp">` opens on click, Enter or Space, and dragover
    highlights the border with `--color-accent`.
  - **On a file:** in `imagePick.ts`, read it, and if larger than 4 MB or wider or taller than
    1600 px, downscale through a canvas to at most 1600 px on the long side as JPEG at quality
    0.85.
    - Produce `{ base64 (data-URL prefix stripped), mimeType, previewUrl }`.
    - Show a 64 x 64 thumbnail (1px ink frame), the file name in italic, and a small "Remove"
      text button.
    - A non-image or unreadable file shows the italic rubric line "That picture could not be
      read."
  - **Submit:** send `imageBase64` (no prefix) in the `POST /api/world` body only when a picture
    is set; otherwise send nothing. Everything else on the screen stays exactly as it is.
- **HUMAN_TEST:**
  - Drop a JPEG: the thumbnail shows, and Create sends `imageBase64` (Network tab).
  - Drop a 10 MB photo: it is sent downscaled (the request body is under about 2 MB).
  - Remove clears it.
  - Drop a .txt: the error line shows.

## Task 2: C7 Hold-to-speak mic on DecreeBox

- **Agent:** durhack-frontend · **Model:** sonnet · **Parallel with:** 1, 3
- **Files:** `web/src/ui/decree/DecreeBox.tsx`, `decree.css`, and a new
  `web/src/ui/decree/useRecorder.ts`
- **Build:**
  - **Mic button:** a square xs button with an inline SVG microphone, between the input and
    "Proclaim", labelled "Hold to speak a decree" (`aria-label` and `title`).
  - **Recording:**
    - It starts on press and hold (pointerdown, or keydown Space or Enter on the button) and
      stops on release (pointerup, pointerleave, keyup), or automatically at 15 s.
    - It uses `MediaRecorder` with `audio/webm;codecs=opus` when supported, else the browser
      default type.
    - While recording, the button gets a pulsing ring in `--color-danger`, and a mono countdown
      "0:15" replaces the input placeholder.
    - Recordings shorter than 0.5 s are dropped with the italic hint "Hold the button while you
      speak."
  - **Send:**
    - Post `{ audioBase64, mimeType }` to `POST /api/decree/voice`, showing "The herald
      listens..." while waiting.
    - On success, show for 4 s: the italic transcript in quotes, then "Proclaimed: <decree.text>".
    - On 503, 404 or an error, show "The herald could not hear you." for 4 s; the typed box keeps
      working.
  - **Permission denied or no `MediaRecorder`:** hide the mic button. Disabled when not
    connected.
  - **Cleanup:** stop the tracks after each recording and on unmount.
  - Keep the box at 380 x 48; the feedback line sits just above it, as the "Proclaimed." line
    does now.
- **HUMAN_TEST:**
  - Hold the mic and speak "a plague sweeps the south", then release: "The herald
    listens...", then the transcript and decree show (mock returns a canned answer once lane a's
    route is in).
  - Deny mic permission: the button hides and typing still works.
  - Hold for over 15 s: it stops by itself.

## Task 3: C8 NewsBroadcast lower-third

- **Agent:** durhack-frontend · **Model:** sonnet · **Parallel with:** 1, 2
- **Files:** `web/src/ui/news/NewsBroadcast.tsx`, `news.css`, `captureStub.ts`,
  `useBroadcast.ts` (create); `web/src/ui/index.ts` (add one line:
  `export { NewsBroadcast, requestBroadcast } from './news/NewsBroadcast';`)
- **Build:**
  - **`captureStub.ts`:** exports `captureGlobe(): Promise<{ imageBase64: string; mimeType:
    'image/jpeg' }>`, returning a tiny blank JPEG from an offscreen canvas (8 x 8, filled with
    the computed `--color-bg`). Add the comment: "Stub until lane b's
    web/src/globe/capture.ts lands; then import from there instead."
  - **`useBroadcast`:**
    - Every 2 minutes while a world exists and `!world.paused`, and on demand, it runs one
      cycle:
      1. `captureGlobe()`;
      2. `POST /api/broadcast` with `{ imageBase64, mimeType }`;
      3. on 200 `{ id, headline, script, audio, year }`, show the lower-third and play the audio.
    - Never run two cycles at once.
    - Skip the timer cycle while narration or the anthem is playing (`audio.getState().state`
      is not `idle`); try again 20 s later.
  - **Playing:** if `'playBroadcast' in audio`, call `audio.playBroadcast(url)` and follow
    `useAudio()` until the state leaves `'broadcast'`. Otherwise play the URL with a local
    `Audio` element and follow its `ended` and `error` events.
  - **Hiding:** hide the lower-third 1.5 s after the bulletin ends, or at once on 503, 404 or an
    error (quiet; one `console.warn`).
  - **`requestBroadcast()`:** an exported function that triggers a cycle now, for lane b's
    top-bar button. Implement it with a module-level event target.
  - **NewsBroadcast** (no props, no positioning; lane b places it): a parchment lower-third
    about 640 px wide by 84 px, `max-width: calc(100vw - 32px)`.
    - Left: a solid rubric cell with "TERRA NOVA NEWS" in Cinzel caps and a red on-air light
      (pulsing `--color-danger` dot, "On air").
    - Right: the headline (Cinzel 15 px) over the script, scrolling up slowly in EB Garamond,
      paced to finish when the audio ends (use the audio duration once known, else 25 s).
    - The year in rubric mono.
    - It slides up 200 ms on show and down on hide. It renders nothing when idle.
- **HUMAN_TEST:**
  - With `npm run mock` and lane a's route in, call `requestBroadcast()` (or wait 2 min): the
    lower-third slides up with headline and script, the audio plays, and it hides when done.
  - With the route missing (404), nothing shows and no error surfaces.
  - It does not start while a narration plays.
