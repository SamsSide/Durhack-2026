---
name: durhack-browser
description: Use in the DurHack repo when research needs a real browser — Chrome, "my browser", JS-heavy or logged-in pages (Devpost, sponsor dashboards, the DurHack site), live numbers, Googling with screenshots, or capturing screenshots of websites or of our own running app for the docs, Devpost or the pitch. Drives the user's own Chrome through the chrome-devtools MCP; includes setup for macOS, Linux, Windows and WSL, and the WSL fix for filePath saves failing with "is not within any of the configured workspace roots".
---

# Browsing with Chrome (chrome-devtools MCP)

The `chrome-devtools` MCP drives the user's **real Chrome**, signed in to their own accounts.
Any teammate can use it for research (`durhack-prizes`, `durhack-explain`) or to screenshot our
app for Devpost and the docs. **Core rule:** take screenshots inline and copy Claude Code's
saved copy with `save-shot.sh`. Never use `filePath`.

For plain reading, WebSearch/WebFetch are cheaper; use Chrome when the page needs JavaScript,
a login, live data, or a screenshot. **One agent drives Chrome at a time** on a laptop.

## Setup (once per laptop)

Check first: `ToolSearch` for `select:mcp__chrome-devtools__list_pages`. Found → skip setup.
Not found → tell the user the command for their OS (they run it, then restart Claude Code):

| OS | Command |
| --- | --- |
| macOS / Linux | `claude mcp add chrome-devtools --scope user -- npx -y chrome-devtools-mcp@latest --autoConnect` |
| Windows (native) | `claude mcp add chrome-devtools --scope user -- cmd /c npx -y chrome-devtools-mcp@latest --autoConnect` |
| WSL (Chrome on Windows) | `claude mcp add chrome-devtools --scope user -- cmd.exe /c npx -y chrome-devtools-mcp@latest --autoConnect` |

Needs Node.js (for `npx`) and Chrome running. `--autoConnect` attaches to the open Chrome; if
it can't, the user enables remote debugging at `chrome://inspect/#remote-debugging` (or drop
`--autoConnect` and the MCP starts its own, signed-out Chrome). Never block on this: no Chrome
MCP → use WebSearch/WebFetch and say so.

## Default run

1. **Load all the tools in one call**, even ones you may not need: `ToolSearch` with
   `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__new_page,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_snapshot,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__resize_page,mcp__chrome-devtools__click,mcp__chrome-devtools__fill,mcp__chrome-devtools__press_key,mcp__chrome-devtools__wait_for,mcp__chrome-devtools__close_page`.
   If the server is "still connecting", ToolSearch waits. Don't report Chrome missing before searching.
2. **Open your own tab** with `new_page` and the URL. Never navigate the user's existing tabs.
   Yours is the one marked `[selected]`; note its number, every later call needs it as `pageId`.
3. **Readable size:** `resize_page` 1400x1000.
4. **Read before you look:** `take_snapshot` gives text and uids, cheaper than an image. Pull
   data with `evaluate_script` (`waitForStableDom: false` for reads), e.g.
   `() => [...document.querySelectorAll('a[href*="/software/"]')].slice(0,15).map(a=>a.innerText.replace(/\n+/g,' | '))`.
5. **Frame the shot:** scroll the element into view (`el.scrollIntoView({block:'center'})`),
   then screenshot the viewport.
6. **Screenshot inline:** `take_screenshot` with `pageId`, `format: "jpeg"`, `quality: 80`,
   **no `filePath`**.
7. **Save it** (only if needed), straight after each shot:
   `bash .claude/skills/durhack-browser/scripts/save-shot.sh <dest-file-or-dir>` — prints the
   final path; the extension follows the real format. Research shots go in
   `docs/prizes/shots/` or `docs/research/shots/`; app shots for Devpost in `docs/shots/`.
8. **Close the tabs you opened** (`close_page`). Chrome won't close its last tab; leave it.
9. **Report** figures in a table with the date and the source of each.

## Saving screenshots: what works

| Approach | Result |
| --- | --- |
| `filePath` anywhere on WSL (`/tmp/...`, `/home/...`, `C:\...`, `\\wsl.localhost\...`) | Fails: "not within any of the configured workspace roots". Don't keep trying path styles |
| Inline shot, then `save-shot.sh` | Works on every OS: Claude Code saves every inline image under `~/.claude/projects/*/*/tool-results/mcp-chrome-devtools-blob-*` |
| A big PNG that came back as "Saved screenshot to ...Temp\..." | `save-shot.sh` finds it in the temp dir (Windows temp on WSL). Or retake as JPEG quality 80 so it shows inline |

On WSL, convert a Windows path with `wslpath 'C:\...'`.

## Finding things

- **Google:** `new_page` to `https://www.google.com/search?q=<terms+joined+with+plus>`.
- **The Google AI Overview is not a source.** Open the primary page (official site, docs,
  Devpost listing) and report its figures, noting disagreements.
- **Past hackathon winners:** Devpost project galleries (`<hackathon>.devpost.com/project-gallery`)
  and "winner" filters; read the project pages, not summaries.
- **Live numbers:** read them from the page with snapshot or evaluate, not off a picture.
- **Late-rendering pages:** `wait_for` with text you expect, then snapshot.

## Rules

- It is the user's signed-in browser. Ask (clickable) before purchases, posting, sending,
  deleting, changing settings, registering for anything or submitting forms (including the
  Devpost submission: a human submits it). Reading and screenshots are fine.
- Never type passwords or API keys; if a page needs a login, ask the user to log in themselves.
- An element screenshot of a tiny text node is a useless crop; shoot the viewport.
- If the user says shots were only a test, delete the copies you made.
