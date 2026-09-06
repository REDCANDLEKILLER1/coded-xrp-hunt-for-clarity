export interface DialogueLine { speaker: string; text: string }
export interface DialogueScene { id: string; lines: readonly DialogueLine[] }

/** Two-stage advance. The UI invokes press only on a fresh down/key edge. */
export class Dialogue {
  private scene: DialogueScene | null = null;
  private lineIndex = 0;
  private revealed = 0;
  private age = 0;
  private finish: (() => boolean) | null = null;
  failed = false;
  get active(): boolean { return this.scene !== null; }
  get speaker(): string { return this.scene?.lines[this.lineIndex].speaker ?? ''; }
  get text(): string { return (this.scene?.lines[this.lineIndex].text ?? '').slice(0, Math.floor(this.revealed)); }
  get fullText(): string { return this.scene?.lines[this.lineIndex].text ?? ''; }
  get page(): string { return this.scene ? `${this.lineIndex + 1} / ${this.scene.lines.length}` : ''; }
  get ready(): boolean { return this.revealed >= this.fullText.length; }
  open(scene: DialogueScene, finish: () => boolean): boolean {
    if (this.active || !scene.lines.length) return false;
    this.scene = scene; this.finish = finish; this.lineIndex = 0; this.revealed = 0; this.age = 0; this.failed = false;
    return true;
  }
  update(dt: number): void {
    if (!this.active) return;
    this.age += Math.max(0, dt); this.revealed = Math.min(this.fullText.length, this.revealed + Math.max(0, dt) * 48);
  }
  press(): void {
    if (!this.active || this.age < .18) return;
    if (!this.ready) { this.revealed = this.fullText.length; return; }
    if (this.lineIndex + 1 < this.scene!.lines.length) { this.lineIndex++; this.revealed = 0; this.age = 0; return; }
    this.commit();
  }
  skip(): void { if (this.active && this.age >= .18) this.commit(); }
  closeWithoutEffects(): void { this.scene = null; this.finish = null; }
  private commit(): void {
    if (!this.finish?.()) { this.failed = true; return; }
    this.closeWithoutEffects(); this.failed = false;
  }
}

export const BOARDING_DIALOGUE = {
  threshold: { id: 'story.earth.boarding', lines: [
    { speaker: 'STONE · COMMS', text: 'Exterior batteries are down. Internal security is still awake.' },
    { speaker: 'XRPMAN', text: 'One problem at a time.' },
  ] },
  zamn: { id: 'story.earth.zamn', lines: [
    { speaker: 'MR ZAMN', text: 'You opened the bay? Good. Help me get these people through it.' },
    { speaker: 'XRPMAN', text: 'You came for the crew?' },
    { speaker: 'MR ZAMN', text: 'Somebody had to. The doors decided they were company property.' },
    { speaker: 'XRPMAN', text: "Let's change the policy." },
  ] },
  engineering: { id: 'story.earth.engineering', lines: [
    { speaker: 'STONE · COMMS', text: 'You can vent the power or route it back into the hangar.' },
    { speaker: 'XRPMAN', text: "The crew needs the hangar. We'll take the harder corridor." },
  ] },
  core: { id: 'story.earth.core', lines: [
    { speaker: 'LEDGER DEFENSE CORE', text: 'Authority transfer denied. Liquidity is under protective custody.' },
    { speaker: 'XRPMAN', text: "Protection doesn't look like this." },
    { speaker: 'LEDGER DEFENSE CORE', text: 'Withdrawal prohibited.' },
    { speaker: 'MR ZAMN · COMMS', text: 'Then stop asking it nicely.' },
  ] },
  secured: { id: 'story.earth.command_secured', lines: [
    { speaker: 'STONE · COMMS', text: "Command accepted. Earth's routes are opening." },
    { speaker: 'MR ZAMN', text: "Crew accounted for. Hull intact. I'd call that a good takeover." },
    { speaker: 'XRPMAN', text: 'Who gets the reserves?' },
    { speaker: 'STONE · COMMS', text: "The districts they came from. We're keeping the ship, not their future." },
  ] },
  outbound: { id: 'story.earth.outbound', lines: [
    { speaker: 'STONE · COMMS', text: 'The route ledger points to Mars. Earth was one lock in a much larger chain.' },
    { speaker: 'XRPMAN', text: 'Then we keep going.' },
    { speaker: 'MR ZAMN', text: 'Four batteries online. This one hits back.' },
  ] },
} as const satisfies Record<string, DialogueScene>;
