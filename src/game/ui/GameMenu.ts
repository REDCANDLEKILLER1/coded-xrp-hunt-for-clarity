let open = false;
export const isGameMenuOpen = (): boolean => open;

/** Global menu remains available on the map and in every combat scene. */
export function mountGameMenu(restart: () => string | null): void {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'game-menu-toggle';
  toggle.textContent = '☰';
  toggle.setAttribute('aria-label', 'Open game menu');
  toggle.setAttribute('aria-haspopup', 'dialog');
  const dialog = document.createElement('dialog');
  dialog.className = 'game-menu';
  dialog.setAttribute('aria-labelledby', 'game-menu-title');
  dialog.innerHTML = `<h2 id="game-menu-title">GAME MENU</h2>
    <p data-message>Restart the campaign from the beginning for a fresh test.</p>
    <button type="button" data-restart>Restart from Beginning</button>
    <button type="button" data-close>Back to Game</button>`;
  const message = dialog.querySelector<HTMLParagraphElement>('[data-message]')!;
  const restartButton = dialog.querySelector<HTMLButtonElement>('[data-restart]')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('[data-close]')!;
  let confirming = false;
  const resetPrompt = (): void => {
    confirming = false;
    message.textContent = 'Restart the campaign from the beginning for a fresh test.';
    restartButton.textContent = 'Restart from Beginning';
    closeButton.textContent = 'Back to Game';
  };
  toggle.addEventListener('click', () => {
    resetPrompt();
    open = true;
    dialog.showModal();
    closeButton.focus();
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { open = false; toggle.focus(); });
  restartButton.addEventListener('click', () => {
    if (!confirming) {
      confirming = true;
      message.textContent = 'This resets your saved campaign checkpoint, upgrades, credits, and mission progress on this device. Start over?';
      restartButton.textContent = 'Confirm Restart';
      closeButton.textContent = 'Cancel';
      closeButton.focus();
      return;
    }
    const error = restart();
    if (error) { resetPrompt(); message.textContent = error; }
  });
  document.body.append(toggle, dialog);
}
