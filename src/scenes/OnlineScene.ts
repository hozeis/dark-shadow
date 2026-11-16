import Phaser from 'phaser';
import { drawStage } from '../game/stage';
import { FONT } from '../config';
import { NetSession, net, cleanCode, inviteLink } from '../net/NetSession';

type View = 'menu' | 'hosting' | 'joining' | 'connecting';

/** Lobby for online play: create a room (get a code) or join a friend's room. */
export class OnlineScene extends Phaser.Scene {
  private view: View = 'menu';
  private ui: Phaser.GameObjects.GameObject[] = [];
  private status!: Phaser.GameObjects.Text;
  private codeInput?: HTMLInputElement;
  private cancelHost?: () => void;
  private joinCode?: string;

  constructor() {
    super('Online');
  }

  init(data: { join?: string }) {
    this.joinCode = data.join ? cleanCode(data.join) : undefined;
  }

  create() {
    this.cameras.main.setZoom(1).centerOn(640, 360);
    drawStage(this);
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.45).setDepth(2);
    this.add.text(640, 90, 'PLAY ONLINE', this.style(96)).setOrigin(0.5).setDepth(5);
    this.status = this.add.text(640, 600, '', this.style(28, '#ffb3c1')).setOrigin(0.5).setDepth(5);

    this.events.once('shutdown', () => this.cleanup());
    this.keyboardShortcuts();

    if (this.joinCode && this.joinCode.length === 4) this.join(this.joinCode);
    else this.showMenu();
  }

  private style(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: Math.max(4, size / 9), align: 'center' };
  }

  private keyboardShortcuts() {
    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.view === 'menu' ? this.back() : this.showMenu()));
    kb.on('keydown-ENTER', () => {
      if (this.view === 'joining') this.submitJoin();
    });
  }

  private clearUi() {
    for (const o of this.ui) o.destroy();
    this.ui = [];
    this.codeInput?.remove();
    this.codeInput = undefined;
    this.status.setText('');
  }

  private button(x: number, y: number, label: string, onTap: () => void, w = 420, color = 0xffd23f) {
    const bg = this.add.rectangle(0, 0, w, 84, 0x140a24, 0.92).setStrokeStyle(4, color);
    const txt = this.add.text(0, 0, label, this.style(42, Phaser.Display.Color.IntegerToColor(color).rgba)).setOrigin(0.5);
    const c = this.add.container(x, y, [bg, txt]).setDepth(5).setSize(w, 84).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => c.setScale(1.05));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerdown', onTap);
    this.ui.push(c);
    return c;
  }

  private text(x: number, y: number, s: string, size: number, color = '#ffffff') {
    const t = this.add.text(x, y, s, this.style(size, color)).setOrigin(0.5).setDepth(5);
    this.ui.push(t);
    return t;
  }

  // ---------- screens ----------

  private showMenu() {
    this.cancelHost?.();
    this.cancelHost = undefined;
    this.view = 'menu';
    this.clearUi();
    this.text(640, 190, 'Play against a friend on another phone or computer', 30, '#d9c4ff');
    this.button(640, 300, 'CREATE ROOM', () => this.host());
    this.button(640, 410, 'JOIN ROOM', () => this.showJoin());
    this.button(640, 520, 'BACK', () => this.back(), 260, 0xffffff);
  }

  private host() {
    this.view = 'hosting';
    this.clearUi();
    const codeText = this.text(640, 270, '····', 150, '#ffd23f');
    this.text(640, 180, 'YOUR ROOM CODE', 34, '#d9c4ff');
    const waiting = this.text(640, 390, 'Getting a code…', 30);
    this.button(640, 520, 'CANCEL', () => this.showMenu(), 260, 0xffffff);

    const { session, cancel } = NetSession.host((code) => {
      codeText.setText(code);
      waiting.setText('Waiting for your friend to join…');
      this.tweens.add({ targets: waiting, alpha: 0.4, yoyo: true, repeat: -1, duration: 700 });
      this.button(640, 440, 'SHARE INVITE LINK', () => this.share(code), 460, 0x9b7bff);
      waiting.setY(375);
    });
    this.cancelHost = cancel;
    session
      .then((s) => this.connected(s))
      .catch(() => {
        if (this.view === 'hosting') {
          this.showMenu();
          this.status.setText('Could not create a room. Check your internet and try again.');
        }
      });
  }

  private async share(code: string) {
    const url = inviteLink(code);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Dark Shadow', text: `Fight me in Dark Shadow! Room ${code}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.status.setColor('#a8ffb3').setText('Invite link copied!');
    } catch {
      this.status.setColor('#ffffff').setText(url);
    }
  }

  private showJoin() {
    this.view = 'joining';
    this.clearUi();
    this.text(640, 220, "TYPE YOUR FRIEND'S ROOM CODE", 36, '#d9c4ff');

    const input = document.createElement('input');
    input.className = 'ds-input';
    input.maxLength = 4;
    input.autocapitalize = 'characters';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'CODE';
    input.addEventListener('input', () => (input.value = cleanCode(input.value)));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.submitJoin();
      if (e.key === 'Escape') this.showMenu();
    });
    document.body.appendChild(input);
    this.codeInput = input;
    setTimeout(() => input.focus(), 50);

    this.button(530, 520, 'JOIN', () => this.submitJoin(), 200);
    this.button(780, 520, 'BACK', () => this.showMenu(), 200, 0xffffff);
  }

  private submitJoin() {
    const code = cleanCode(this.codeInput?.value ?? '');
    if (code.length !== 4) {
      this.status.setText('Room codes have 4 letters');
      return;
    }
    this.join(code);
  }

  private join(code: string) {
    this.view = 'connecting';
    this.clearUi();
    this.text(640, 270, code, 130, '#ffd23f');
    const t = this.text(640, 390, 'Connecting…', 34);
    this.tweens.add({ targets: t, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
    this.button(640, 520, 'CANCEL', () => this.showMenu(), 260, 0xffffff);
    NetSession.join(code)
      .then((s) => {
        if (this.view === 'connecting') this.connected(s);
        else s.close();
      })
      .catch((err: Error) => {
        if (this.view !== 'connecting') return;
        this.showJoin();
        if (this.codeInput) this.codeInput.value = code;
        this.status.setText(err.message);
      });
  }

  private connected(s: NetSession) {
    this.cancelHost = undefined;
    net.session = s;
    this.clearUi();
    this.text(640, 300, 'CONNECTED!', 110, '#a8ffb3');
    this.time.delayedCall(700, () => this.scene.start('Fight', { mode: s.role }));
  }

  private back() {
    this.scene.start('Title');
  }

  private cleanup() {
    this.codeInput?.remove();
    this.codeInput = undefined;
    this.cancelHost?.();
    this.input.keyboard?.removeAllListeners();
  }
}
