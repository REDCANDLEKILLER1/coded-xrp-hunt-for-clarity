import { debugLog } from '../core/DebugLog';

/**
 * On-device log viewer, reached with `?log`.
 *
 * A phone has no console, so this renders the transcript as selectable text
 * with a copy button. A tester plays, opens `?log`, copies, and pastes it back.
 */
export function showDebugLogView(): void {
  debugLog.restore();
  const text = debugLog.dump();

  const root = document.createElement('div');
  root.className = 'debug-log-view';
  root.innerHTML = `
    <header>
      <strong>CODED DEBUG LOG</strong>
      <div class="debug-log-actions">
        <button type="button" data-action="copy">COPY</button>
        <button type="button" data-action="clear">CLEAR</button>
        <button type="button" data-action="close">CLOSE</button>
      </div>
    </header>
    <textarea readonly spellcheck="false"></textarea>
    <p class="debug-log-hint">Tap COPY, then paste it back to whoever is debugging. CLEAR wipes the buffer before a fresh run.</p>
  `;
  const area = root.querySelector('textarea')!;
  area.value = text;
  document.body.appendChild(root);

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
    area.value = debugLog.dump();
  });

  root.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    root.remove();
    const url = new URL(location.href);
    url.searchParams.delete('log');
    history.replaceState(null, '', url.toString());
  });
}
