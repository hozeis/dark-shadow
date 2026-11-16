// Makes the home-screen icons from the Masked Giant's mask.
//   node tools/make-icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'public/art/r-shadow/head.png';
fs.mkdirSync('public/icons', { recursive: true });

for (const size of [180, 192, 512]) {
  const bg = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="g" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#6b3fd1"/><stop offset="55%" stop-color="#2a0f55"/><stop offset="100%" stop-color="#0b0614"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`);
  const head = await sharp(SRC).resize({ height: Math.round(size * 0.74) }).toBuffer();
  const meta = await sharp(head).metadata();
  await sharp(bg)
    .composite([{ input: head, left: Math.round((size - meta.width) / 2), top: Math.round(size * 0.13) }])
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}
console.log('✓ icons in public/icons');
