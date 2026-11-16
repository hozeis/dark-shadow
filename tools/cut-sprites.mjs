// Cuts sprite sheets into animation frames and packs them into one texture atlas.
//
//   npm run sprites
//
// 1. Finds every separate blob of pixels on each sheet
// 2. Gives each blob to the frame cell it sits in (see art/sprites.mjs)
// 3. Scales the frames so all sheets match, and remembers where the feet are
// 4. Packs everything into public/art/<id>/atlas.png + atlas.json (Phaser format)
//    and writes src/art/sprites.json so the game knows the animations

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { SPRITE_CHARACTERS } from '../art/sprites.mjs';

const OUT_RIG = 'src/art/sprites.json';
const ATLAS_W = 2048;
const SOLID = 40; // pixels more see-through than this don't join blobs (soft edges are added back later)

/** Load a sheet and label every separate blob of pixels. */
async function loadSheet(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const label = new Int32Array(W * H);
  const comps = [null];
  for (let p = 0; p < W * H; p++) {
    if (label[p] || data[p * 4 + 3] <= SOLID) continue;
    const id = comps.length;
    const c = { x0: W, y0: H, x1: 0, y1: 0 };
    const stack = [p];
    label[p] = id;
    while (stack.length) {
      const q = stack.pop();
      const x = q % W, y = (q / W) | 0;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const r = yy * W + xx;
        if (!label[r] && data[r * 4 + 3] > SOLID) {
          label[r] = id;
          stack.push(r);
        }
      }
    }
    comps.push(c);
  }
  return { data, W, H, label, comps };
}

/**
 * Cut one frame: the blobs inside the strip whose middle is inside the cell
 * (wide blobs are clipped to the cell). clipY = also take blobs that stick out of the strip.
 */
function cutFrame(sheet, band, cell, clipY) {
  const { data, W, label, comps } = sheet;
  const [cx0, cx1] = cell;
  const [y0, y1] = band;
  const cw = cx1 - cx0;
  const keep = (id, x) => {
    const c = comps[id];
    const mx = (c.x0 + c.x1) / 2;
    if (clipY ? c.y1 < y0 || c.y0 > y1 : c.y0 < y0 || c.y1 > y1) return false;
    if (c.x1 - c.x0 > cw * 1.4) return x >= cx0 && x < cx1; // a blob that spans several frames
    return mx >= cx0 && mx < cx1;
  };
  const pad = Math.ceil(cw);
  let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
  const pixels = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = Math.max(0, Math.floor(cx0 - pad)); x < Math.min(W, Math.ceil(cx1 + pad)); x++) {
      let id = label[y * W + x];
      if (!id && data[(y * W + x) * 4 + 3] > 0) {
        // soft edge pixel: belongs to the blob next to it
        for (let d = 0; d < 9 && !id; d++) {
          const xx = x + (d % 3) - 1, yy = y + ((d / 3) | 0) - 1;
          if (xx >= 0 && xx < W && yy >= y0 && yy <= y1) id = label[yy * W + xx];
        }
      }
      if (!id || !keep(id, x)) continue;
      pixels.push(x, y);
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
    }
  }
  if (bx1 < 0) throw new Error(`empty frame in cell ${cell} band ${band}`);
  bx0 -= 1; by0 -= 1; bx1 += 1; by1 += 1;
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < pixels.length; i += 2) {
    const x = pixels[i], y = pixels[i + 1];
    data.copy(rgba, ((y - by0) * w + (x - bx0)) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
  }
  return { rgba, w, h, x0: bx0, y0: by0, bottom: by1 - 1 };
}

const sprites = {};
for (const ch of SPRITE_CHARACTERS) {
  const refH = Math.max(...Object.values(ch.sheets).map((s) => s.standingHeight));
  const sheets = {};
  for (const [k, s] of Object.entries(ch.sheets)) sheets[k] = await loadSheet(s.file);

  const frames = [];
  const anims = {};
  for (const [name, a] of Object.entries(ch.anims)) {
    const sheet = sheets[a.sheet];
    const scale = refH / ch.sheets[a.sheet].standingHeight;
    a.cells.forEach((cell, i) => {
      const f = cutFrame(sheet, a.y, cell, a.clipY);
      const ax = a.ax?.[i] ?? (cell[0] + cell[1]) / 2;
      const ay = a.base === 'own' ? f.bottom : a.base === 'center' ? f.y0 + f.h / 2 : a.base;
      frames.push({
        name: `${name}-${i}`, ...f, scale,
        pivot: { x: +((ax - f.x0) / f.w).toFixed(4), y: +((ay - f.y0) / f.h).toFixed(4) },
      });
    });
    anims[name] = a.cells.length;
  }

  // scale every frame to the same resolution
  for (const f of frames) {
    const w = Math.max(1, Math.round(f.w * f.scale)), h = Math.max(1, Math.round(f.h * f.scale));
    f.png = await sharp(f.rgba, { raw: { width: f.w, height: f.h, channels: 4 } })
      .resize(w, h, { kernel: f.scale === 1 ? 'nearest' : 'lanczos3' }).png().toBuffer();
    f.w = w;
    f.h = h;
  }

  // pack in rows, tallest first
  const order = [...frames].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0;
  for (const f of order) {
    if (x + f.w > ATLAS_W) { x = 0; y += rowH + 2; rowH = 0; }
    f.ax = x; f.ay = y;
    x += f.w + 2;
    rowH = Math.max(rowH, f.h);
  }
  const atlasH = y + rowH;
  const dir = path.join('public/art', ch.id);
  fs.mkdirSync(dir, { recursive: true });
  const full = await sharp({ create: { width: ATLAS_W, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(frames.map((f) => ({ input: f.png, left: f.ax, top: f.ay })))
    .png().toBuffer();
  const small = await sharp(full).png({ palette: true, quality: 95, effort: 7 }).toBuffer(); // smaller download for phones
  fs.writeFileSync(path.join(dir, 'atlas.png'), small);
  const json = { frames: {}, meta: { image: 'atlas.png', size: { w: ATLAS_W, h: atlasH }, scale: 1 } };
  for (const f of frames) {
    json.frames[f.name] = {
      frame: { x: f.ax, y: f.ay, w: f.w, h: f.h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, pivot: f.pivot,
    };
  }
  fs.writeFileSync(path.join(dir, 'atlas.json'), JSON.stringify(json));

  sprites[ch.id] = {
    key: `${ch.id}-sprites`,
    image: `art/${ch.id}/atlas.png`,
    atlas: `art/${ch.id}/atlas.json`,
    displayScale: +(ch.height / refH).toFixed(4),
    anims,
  };
  console.log(`✓ ${ch.id}: ${frames.length} frames in ${Object.keys(anims).length} animations (atlas ${ATLAS_W}x${atlasH})`);
}

fs.writeFileSync(OUT_RIG, JSON.stringify(sprites, null, 2) + '\n');
console.log(`✓ wrote ${OUT_RIG}`);
