import { debugLog } from '../core/DebugLog';

/**
 * On-device log viewer, reached with `?log`.
 *
 * A phone has no console, so this renders the transcript as selectable text
 * with a copy button. A tester plays, opens `?log`, copies, and pastes it back.
 */
export function showDebugLogView(): void {
  // Repeated taps must not stack overlays on top of each other.
  const existing = document.querySelector('.debug-log-view');
  if (existing) {
    closeView(existing);
    return;
  }

  debugLog.restore();
  const text = debugLog.dump();

  const root = document.createElement('div');
  root.className = 'debug-log-view';
  root.innerHTML = `
    <header>
      <strong>CODED DEBUG LOG</strong>
      <div class="debug-log-actions">
        <button type="button" data-action="copy">COPY</button>
        <button type="button" data-action="save">SAVE .JSON</button>
        <button type="button" data-action="format">JSON</button>
        <button type="button" data-action="clear">CLEAR</button>
        <button type="button" data-action="close">CLOSE</button>
      </div>
    </header>
    <textarea readonly spellcheck="false"></textarea>
    <p class="debug-log-hint">COPY pastes it into chat. SAVE .JSON downloads a structured file. JSON switches this view. CLEAR wipes the buffer before a fresh run.</p>
  `;
  const area = root.querySelector('textarea')!;
  // Readable transcript by default; JSON is one tap away and is what SAVE writes.
  let showingJson = false;
  area.value = text;

  // A near-empty transcript almost always means the run was never recorded
  // rather than that nothing happened, so say what to do instead of showing a
  // single boot line and looking broken.
  const gameplayEntries = debugLog.size() - countBootOnly(text);
  if (gameplayEntries <= 0) {
    const notice = document.createElement('p');
    notice.className = 'debug-log-empty';
    notice.textContent =
      'No gameplay recorded yet. This only shows what a previous run wrote. '
      + 'Play first — deploy, fly for a bit — then reopen this log in the same browser. '
      + 'Private/incognito windows discard the log on close.';
    root.insertBefore(notice, area);
  }

  document.body.appendChild(root);
  // The launcher button would otherwise sit invisibly beneath the viewer.
  document.body.classList.add('debug-log-open');

  root.querySelector('[data-action="format"]')?.addEventListener('click', () => {
    const button = root.querySelector<HTMLButtonElement>('[data-action="format"]')!;
    showingJson = !showingJson;
    area.value = showingJson ? debugLog.dumpJson() : debugLog.dump();
    button.textContent = showingJson ? 'TEXT' : 'JSON';
  });

  root.querySelector('[data-action="save"]')?.addEventListener('click', () => {
    const button = root.querySelector<HTMLButtonElement>('[data-action="save"]')!;
    const blob = new Blob([debugLog.dumpJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coded-debug-${debugLog.fileStamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking immediately can cancel the download on some mobile browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    button.textContent = 'SAVED';
    setTimeout(() => { button.textContent = 'SAVE .JSON'; }, 2200);
  });

  root.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
    const button = root.querySelector<HTMLButtonElement>('[data-action="copy"]')!;
    try {
      await navigator.clipboard.writeText(area.value);
      button.textContent = 'COPIED';
    } catch {
      // Clipboard API needs permission/secure context in some browsers; select
      // the text instead so a long-press copy still works.
      area.focus();
      area.select();
      button.textContent = 'SELECTED — COPY IT';
    }
    setTimeout(() => { button.textContent = 'COPY'; }, 2200);
  });

  root.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
    debugLog.clear();
    area.value = showingJson ? debugLog.dumpJson() : debugLog.dump();
  });

  root.querySelector('[data-action="close"]')?.addEventListener('click', () => closeView(root));
}

function countBootOnly(text: string): number {
  return text.split('\n').filter((line) => /\[boot\]/.test(line)).length;
}

function closeView(root: Element): void {
  root.remove();
  document.body.classList.remove('debug-log-open');
  const url = new URL(location.href);
  if (url.searchParams.has('log')) {
    url.searchParams.delete('log');
    history.replaceState(null, '', url.toString());
  }
}
