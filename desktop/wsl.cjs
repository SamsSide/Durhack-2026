// Runs bash scripts inside WSL from the Windows app, with the right Node on PATH.
//
// The script goes to `bash -s` on stdin, so no Windows command-line quoting touches it. The whole
// script is wrapped in a function that is called with stdin from /dev/null: bash reads the full
// function before it runs anything, so a child that reads stdin cannot eat the rest of the script.
//
// Node trap: `wsl.exe` starts a non-interactive shell, which gets the system Node (v18 on the demo
// laptop) instead of nvm's Node 22. Every script here puts a Node 22+ bin first on PATH: the one the
// launcher passed (`--node-bin`, from `which node` in the owner's WSL shell), else the newest nvm
// v22+ install.
'use strict';

const { spawn } = require('node:child_process');

/** Single-quotes a value for bash. */
function q(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function prelude(nodeBin) {
  return [
    'NB=""',
    nodeBin ? `[ -x ${q(nodeBin)}/node ] && NB=${q(nodeBin)}` : ':',
    'if [ -z "$NB" ]; then for d in "$HOME"/.nvm/versions/node/v2[2-9]*/bin; do [ -x "$d/node" ] && NB="$d"; done; fi',
    '[ -n "$NB" ] && export PATH="$NB:$PATH"',
  ].join('\n');
}

/**
 * Runs `body` in bash inside WSL, in `repo`, with `env` exported first.
 * opts: { distro, repo, nodeBin, env, onLine(line, stream), onExit(code) }
 * Returns the ChildProcess (kill() ends wsl.exe).
 */
function runInWsl(body, opts) {
  const { distro, repo, nodeBin, env = {}, onLine = () => {}, onExit = () => {} } = opts;
  const exports = Object.entries(env)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `export ${k}=${q(v)}`)
    .join('\n');
  const script = [
    'terra_main() {',
    prelude(nodeBin),
    `cd ${q(repo)} || { echo "FAILED: the repo folder ${repo.replace(/[^\w./ -]/g, '')} is not there in WSL"; exit 1; }`,
    exports || ':',
    body,
    '}',
    'terra_main </dev/null',
    '',
  ].join('\n');

  const args = [];
  if (distro) args.push('-d', distro);
  args.push('-e', 'bash', '-s');
  const child = spawn('wsl.exe', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

  const pipe = (stream, name) => {
    let buf = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        onLine(line, name);
      }
    });
    stream.on('end', () => { if (buf) onLine(buf.replace(/\r$/, ''), name); buf = ''; });
  };
  pipe(child.stdout, 'out');
  pipe(child.stderr, 'err');

  let done = false;
  const finish = (code) => { if (!done) { done = true; onExit(code); } };
  child.on('error', (e) => { onLine(`FAILED: could not run wsl.exe (${e.message})`, 'err'); finish(-1); });
  child.on('close', (code) => finish(code ?? -1));

  child.stdin.end(script);
  return child;
}

/** Runs `body` to the end; resolves { code, lines }. */
function runToEnd(body, opts, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const lines = [];
    const child = runInWsl(body, {
      ...opts,
      onLine: (line, s) => { lines.push(line); opts.onLine?.(line, s); },
      onExit: (code) => { clearTimeout(timer); resolve({ code, lines }); },
    });
    const timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } }, timeoutMs);
  });
}

module.exports = { runInWsl, runToEnd, q };
