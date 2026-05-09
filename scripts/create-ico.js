const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'public', 'assets', 'icons', 'icon.png');
const OUTPUT = path.join(__dirname, '..', 'public', 'assets', 'icons', 'icon.ico');

const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function createIco() {
  const pngBuffers = [];

  for (const size of SIZES) {
    const buf = await sharp(INPUT)
      .resize(size, size, { fit: 'contain', background: { r: 26, g: 42, b: 58, alpha: 1 } })
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let offset = headerSize + dirSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const dirEntries = [];
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += buf.length;
  }

  const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers.map(p => p.buf)]);
  fs.writeFileSync(OUTPUT, ico);
  console.log(`ICO created: ${OUTPUT} (${(ico.length / 1024).toFixed(1)} KB, ${numImages} sizes)`);
}

createIco().catch(console.error);
