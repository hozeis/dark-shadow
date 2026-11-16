import Phaser from 'phaser';
import { GROUND_Y } from '../config';

/**
 * Draws the arena: dusk sky, moon, mountains, floor and floating embers.
 * It's drawn much bigger than the screen so the camera can zoom out during ultimates.
 */
export function drawStage(scene: Phaser.Scene) {
  const L = -600, R = 1880, T = -500, B = 1200;
  const W = R - L;
  const rnd = new Phaser.Math.RandomDataGenerator(['dark-shadow']);
  const g = scene.add.graphics().setDepth(0);

  // Sky
  vGradient(g, L, T, W, 200 - T, 0x07031a, 0x3b1466);
  vGradient(g, L, 200, W, GROUND_Y - 200, 0x3b1466, 0xd2552a);

  // Stars
  for (let i = 0; i < 160; i++) {
    g.fillStyle(0xffffff, rnd.realInRange(0.2, 0.9));
    g.fillCircle(rnd.between(L, R), rnd.between(T, 260), rnd.realInRange(0.6, 2));
  }

  // Moon with glow
  const mx = 960, my = 150;
  for (const [r, a] of [[200, 0.04], [150, 0.06], [110, 0.1]] as const) {
    g.fillStyle(0xffe2b8, a);
    g.fillCircle(mx, my, r);
  }
  g.fillStyle(0xfff1d6, 1);
  g.fillCircle(mx, my, 72);
  g.fillStyle(0xd9c3a0, 0.35);
  g.fillCircle(mx - 20, my - 14, 14);
  g.fillCircle(mx + 22, my + 18, 9);
  g.fillCircle(mx + 6, my - 30, 6);

  // Mountains (far then near)
  const mountains = (color: number, minY: number, maxY: number, step: number) => {
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: L, y: GROUND_Y }];
    for (let x = L; x <= R + step; x += step) pts.push({ x, y: rnd.between(minY, maxY) });
    pts.push({ x: R + step, y: GROUND_Y });
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
  };
  mountains(0x341a5e, 330, 470, 140);
  mountains(0x1f0f3a, 450, 560, 100);

  // Horizon fog
  for (let i = 0; i < 12; i++) {
    g.fillStyle(0xffb38a, 0.05);
    g.fillEllipse(rnd.between(L, R), GROUND_Y - 20, rnd.between(300, 600), 80);
  }

  // Floor
  vGradient(g, L, GROUND_Y, W, B - GROUND_Y, 0x2b1a3a, 0x0a0610);
  g.lineStyle(2, 0xffffff, 0.08);
  for (let i = -20; i <= 20; i++) {
    g.lineBetween(640 + i * 90, GROUND_Y, 640 + i * 90 * 3.2, B);
  }
  for (const y of [GROUND_Y + 30, GROUND_Y + 75, GROUND_Y + 140]) g.lineBetween(L, y, R, y);
  g.lineStyle(3, 0xb48cff, 0.6);
  g.lineBetween(L, GROUND_Y, R, GROUND_Y);

  // Stone pillars just off-screen (you only see them when the camera zooms out)
  for (const px of [-150, 1430]) {
    g.fillStyle(0x140a24, 1);
    g.fillRect(px - 45, GROUND_Y - 460, 90, 460);
    g.fillRect(px - 65, GROUND_Y - 490, 130, 34);
    g.fillStyle(0xff9a3c, 0.9);
    g.fillCircle(px, GROUND_Y - 520, 14);
    g.fillStyle(0xff9a3c, 0.15);
    g.fillCircle(px, GROUND_Y - 520, 50);
  }

  // Floating embers
  for (let i = 0; i < 28; i++) {
    const e = scene.add.circle(rnd.between(L, R), rnd.between(GROUND_Y - 50, B - 100), rnd.realInRange(1.5, 3.5), 0xffa060, 0.8);
    e.setDepth(1);
    scene.tweens.add({
      targets: e,
      y: e.y - rnd.between(400, 800),
      x: e.x + rnd.between(-80, 80),
      alpha: 0,
      duration: rnd.between(4000, 9000),
      delay: rnd.between(0, 5000),
      repeat: -1,
    });
  }
}

/** Vertical gradient drawn as thin bands (works on both WebGL and Canvas renderers). */
function vGradient(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, top: number, bottom: number, steps = 48) {
  const a = Phaser.Display.Color.IntegerToColor(top);
  const b = Phaser.Display.Color.IntegerToColor(bottom);
  const band = h / steps;
  for (let i = 0; i < steps; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, steps - 1, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(x, y + i * band, w, band + 1);
  }
}
