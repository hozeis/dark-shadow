// Turns photos of hand drawings into clean puppet parts for the game.
//
//   npm run art
//
// 1. Cleans the photo so it looks scanned (flat white paper, darker pencil, brighter colors)
// 2. Finds each figure's silhouette (everything inside the pencil outline)
// 3. Cuts the body parts listed in art/characters.mjs and saves them as PNGs
// 4. Writes src/art/rigs.json so the game knows where each joint is

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { CHARACTERS, GAME_SCALE, EXPORT_SCALE } from '../art/characters.mjs';

const OUT_IMG = 'public/art';
const OUT_RIG = 'src/art/rigs.json';
const DEBUG = process.argv.includes('--debug');

const cleanCache = new Map();

/** Load a photo and flatten the paper to white. Returns RGB buffer + ink mask. */
async function cleanPhoto(file) {
  if (cleanCache.has(file)) return cleanCache.get(file);
  const { data, info } = await sharp(file).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // Estimate the paper color everywhere (lighting changes across the photo)
  const sw = Math.round(W / 4), sh = Math.round(H / 4);
  const small = await sharp(data, { raw: { width: W, height: H, channels: 3 } }).resize(sw, sh).raw().toBuffer();
  const maxed = Buffer.alloc(small.length);
  const R = 2;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) for (let c = 0; c < 3; c++) {
    let m = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = Math.min(sw - 1, Math.max(0, x + dx)), yy = Math.min(sh - 1, Math.max(0, y + dy));
      m = Math.max(m, small[(yy * sw + xx) * 3 + c]);
    }
    maxed[(y * sw + x) * 3 + c] = m;
  }
  const paper = await sharp(maxed, { raw: { width: sw, height: sh, channels: 3 } })
    
    .blur(1.5).resize(W, H, { kernel: 'cubic' }).raw().toBuffer();

  const rgb = Buffer.alloc(data.length);
  const ink = new Uint8Array(W * H);
  for (let i = 0, p = 0; p < W * H; p++, i += 3) {
    const n = [0, 1, 2].map((c) => Math.min(1, data[i + c] / Math.max(1, paper[i + c]) * 1.03));
    const lum = (n[0] + n[1] + n[2]) / 3;
    const sat = Math.max(...n) - Math.min(...n);
    ink[p] = lum < 0.84 || sat > 0.07 ? 1 : 0;
    for (let c = 0; c < 3; c++) {
      let v = (lum + (n[c] - lum) * 2.2) / 0.9; // brighter colored pencil, whiter paper
      v = Math.pow(Math.min(1, Math.max(0, v)), 1.9); // darker pencil, white paper
      rgb[i + c] = Math.round(v * 255);
    }
  }
  const out = { rgb, ink, W, H };
  cleanCache.set(file, out);
  return out;
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bounds(poly, pad = 0) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return { x0: Math.floor(Math.min(...xs)) - pad, y0: Math.floor(Math.min(...ys)) - pad, x1: Math.ceil(Math.max(...xs)) + pad, y1: Math.ceil(Math.max(...ys)) + pad };
}

/** Everything inside the figure's pencil outline = 1, outside paper = 0 (full-photo mask). */
function silhouette(photo, outline) {
  const { ink, W, H } = photo;
  const b = bounds(outline, 3);
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  // Close gaps in the pencil lines: thicken every line by R pixels (square, done in two passes)
  const R = 9;
  const rowPass = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    const gy = y + b.y0;
    for (let x = 0; x < bw; x++) {
      let hit = 0;
      for (let dx = -R; dx <= R; dx++) {
        const gx = x + b.x0 + dx;
        if (gx >= 0 && gy >= 0 && gx < W && gy < H && ink[gy * W + gx]) { hit = 1; break; }
      }
      rowPass[y * bw + x] = hit;
    }
  }
  const thick = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    for (let dy = -R; dy <= R; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < bh && rowPass[yy * bw + x]) { thick[y * bw + x] = 1; break; }
    }
  }
  // flood the paper from outside the outline
  const outside = new Uint8Array(bw * bh);
  const q = [];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!inPoly(x + b.x0, y + b.y0, outline)) { outside[y * bw + x] = 1; q.push(y * bw + x); }
  }
  while (q.length) {
    const p = q.pop();
    const x = p % bw, y = (p / bw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
      const np = yy * bw + xx;
      if (!outside[np] && !thick[np]) { outside[np] = 1; q.push(np); }
    }
  }
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const gx = x + b.x0, gy = y + b.y0;
    if (gx >= 0 && gy >= 0 && gx < W && gy < H && !outside[y * bw + x]) mask[gy * W + gx] = 1;
  }
  return mask;
}

/** Grow a 0/1 mask by r pixels (square). */
function dilate(m, w, h, r) {
  const row = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w && m[y * w + xx]) { row[y * w + x] = 1; break; } }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h && row[yy * w + x]) { out[y * w + x] = 1; break; } }
  }
  return out;
}

const OUTLINE = [27, 16, 48]; // dark purple sticker outline around every part

async function cutImage(photo, mask, img, file, exportScale, paper) {
  const { rgb, W, H } = photo;
  const outlineR = Math.max(2, Math.round(1.6 / exportScale)); // ~1.6px thick in the final image
  const thickenR = Math.max(0, Math.round(0.5 / exportScale) - 1); // keep pencil lines visible when shrunk
  let poly = img.poly;
  if (img.mirrorX !== undefined) {
    const cx = img.mirrorX;
    poly = [...poly, ...poly.slice().reverse().map(([x, y]) => [2 * cx - x, y])];
  }
  const b = bounds(poly, outlineR + 2);
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const rgba = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let gx = x + b.x0;
    const gy = y + b.y0;
    if (img.mirrorX !== undefined && gx < img.mirrorX) gx = 2 * img.mirrorX - gx;
    const inside = img.mirrorX !== undefined ? inPoly(Math.max(gx, img.mirrorX + 0.5), gy, img.poly) : inPoly(gx, gy, poly);
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
    const o = (y * bw + x) * 4, s = (gy * W + gx) * 3;
    // darkest pixel nearby = thicker pencil lines
    for (let c = 0; c < 3; c++) {
      let v = 255;
      for (let dy = -thickenR; dy <= thickenR; dy++) for (let dx = -thickenR; dx <= thickenR; dx++) {
        const xx = Math.min(W - 1, Math.max(0, gx + dx)), yy = Math.min(H - 1, Math.max(0, gy + dy));
        v = Math.min(v, rgb[(yy * W + xx) * 3 + c]);
      }
      rgba[o + c] = v;
    }
    if (paper) {
      // color the plain paper (not the colored pencil) — e.g. make the giant lavender
      const mx = Math.max(rgba[o], rgba[o + 1], rgba[o + 2]), mn = Math.min(rgba[o], rgba[o + 1], rgba[o + 2]);
      const plain = 1 - Math.min(1, ((mx - mn) / 255) * 4);
      for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(rgba[o + c] * (1 - plain + plain * paper[c] / 255));
    }
    rgba[o + 3] = inside && (img.solid || mask[gy * W + gx]) ? 255 : 0;
  }
  // sticker outline
  const solidMask = new Uint8Array(bw * bh);
  for (let p = 0; p < bw * bh; p++) solidMask[p] = rgba[p * 4 + 3] ? 1 : 0;
  const grown = dilate(solidMask, bw, bh, outlineR);
  for (let p = 0; p < bw * bh; p++) {
    if (grown[p] && !solidMask[p]) {
      rgba[p * 4] = OUTLINE[0]; rgba[p * 4 + 1] = OUTLINE[1]; rgba[p * 4 + 2] = OUTLINE[2]; rgba[p * 4 + 3] = 255;
    }
  }
  // soften the cut edges a little
  const alpha = Buffer.alloc(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
      sum += rgba[(yy * bw + xx) * 4 + 3]; n++;
    }
    alpha[y * bw + x] = Math.round(sum / n);
  }
  for (let p = 0; p < bw * bh; p++) rgba[p * 4 + 3] = alpha[p];

  await sharp(rgba, { raw: { width: bw, height: bh, channels: 4 } })
    .resize(Math.round(bw * exportScale), Math.round(bh * exportScale), { kernel: 'lanczos3' })
    .png().toFile(file);

  return { origin: [(img.pivot[0] - b.x0) / bw, (img.pivot[1] - b.y0) / bh] };
}

const rigs = {};
for (const ch of CHARACTERS) {
  const photo = await cleanPhoto(ch.photo);
  const mask = silhouette(photo, ch.outline);
  const dir = path.join(OUT_IMG, ch.id);
  fs.mkdirSync(dir, { recursive: true });

  const exportScale = ch.exportScale ?? EXPORT_SCALE;
  const images = {};
  for (const [name, img] of Object.entries(ch.images)) {
    const file = path.join(dir, `${name}.png`);
    const { origin } = await cutImage(photo, mask, img, file, exportScale, img.paper ?? ch.paper);
    images[name] = { key: `${ch.id}-${name}`, file: `art/${ch.id}/${name}.png`, origin: origin.map((v) => +v.toFixed(4)) };
  }

  const g = (p, rel) => [+((p[0] - rel[0]) * GAME_SCALE).toFixed(2), +((p[1] - rel[1]) * GAME_SCALE).toFixed(2)];
  const slots = {};
  for (const [slot, s] of Object.entries(ch.slots)) {
    const onUpper = slot === 'torso' || slot === 'head' || slot.startsWith('arm');
    slots[slot] = { image: ch.images[s.image] ? `${ch.id}-${s.image}` : s.image, pos: g(s.joint, onUpper ? ch.hip : ch.ground) };
    slots[slot].origin = images[s.image].origin;
  }
  rigs[ch.id] = {
    displayScale: +(GAME_SCALE / exportScale).toFixed(4),
    hip: g(ch.hip, ch.ground),
    images: Object.values(images).map(({ key, file }) => ({ key, file })),
    slots,
  };

  if (DEBUG) {
    // node tools/cut-drawing.mjs --debug <folder>  saves the cleaned-up photo for checking
    const out = process.argv[process.argv.indexOf('--debug') + 1] ?? '.';
    const { rgb, W, H } = photo;
    await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(out, `${ch.id}-clean.png`));
  }
  console.log(`✓ ${ch.id}: ${Object.keys(ch.images).join(', ')}`);
}

fs.mkdirSync(path.dirname(OUT_RIG), { recursive: true });
fs.writeFileSync(OUT_RIG, JSON.stringify(rigs, null, 2) + '\n');
console.log(`✓ wrote ${OUT_RIG}`);
