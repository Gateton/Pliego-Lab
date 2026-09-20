import { deflateSync, inflateSync } from "node:zlib";

/**
 * Dependency-free PNG thumbnailer.
 *
 * A character card is stored as the original art the card was imported with, and the interface
 * paints that same file everywhere: the library grid, the chat list, the message avatars. On a
 * library of a couple hundred cards that meant the browser downloaded ~460 MB and decoded ~365
 * megapixels of bitmap to fill ~3 megapixels of screen, which is what made the page crawl.
 *
 * This module produces the small squares the interface actually needs, using only Node's zlib.
 *
 * Supported: non-interlaced PNG, 8 and 16 bit, greyscale (0), RGB (2), palette (3),
 * greyscale+alpha (4) and RGBA (6), with a palette `tRNS` for transparency. Anything else
 * (interlaced, `tRNS` on a greyscale/RGB image, corrupt data) returns `null` so the caller can
 * fall back to serving the original file: a slow avatar is better than a broken one.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** RGBA pixels above this would need ~256 MB of RAM to decode; card art never comes close. */
const MAX_SOURCE_PIXELS = 64 * 1024 * 1024;

const CHANNELS_BY_COLOR_TYPE: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export interface PngThumbnail {
  buffer: Buffer;
  width: number;
  height: number;
}

interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
}

interface ParsedPng {
  header: PngHeader;
  idat: Buffer[];
  palette: Buffer | null;
  paletteAlpha: Buffer | null;
}

function fail(message: string): never {
  throw new Error(`png: ${message}`);
}

function parse(buffer: Buffer): ParsedPng {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) fail("not a PNG file");

  let offset = 8;
  let header: PngHeader | null = null;
  let palette: Buffer | null = null;
  let paletteAlpha: Buffer | null = null;
  const idat: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length > buffer.length || dataEnd + 4 > buffer.length) fail(`truncated ${type} chunk`);
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      paletteAlpha = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!header) fail("no IHDR chunk");
  if (idat.length === 0) fail("no image data");
  if (!Number.isInteger(header.width) || !Number.isInteger(header.height) || header.width <= 0 || header.height <= 0) {
    fail("empty image");
  }
  return { header, idat, palette, paletteAlpha };
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const dLeft = Math.abs(estimate - left);
  const dUp = Math.abs(estimate - up);
  const dUpLeft = Math.abs(estimate - upLeft);
  if (dLeft <= dUp && dLeft <= dUpLeft) return left;
  return dUp <= dUpLeft ? up : upLeft;
}

/** Reverses the per-scanline filters, returning the raw unfiltered sample bytes. */
function unfilter(raw: Buffer, header: PngHeader, channels: number): Buffer {
  const { width, height, bitDepth } = header;
  const bytesPerPixel = Math.max(1, Math.ceil((bitDepth * channels) / 8));
  const rowBytes = Math.ceil((width * bitDepth * channels) / 8);
  if (raw.length < (rowBytes + 1) * height) fail("short image data");

  const out = Buffer.allocUnsafe(rowBytes * height);
  let offset = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[offset++];
    const rowStart = y * rowBytes;
    const upStart = rowStart - rowBytes;

    // Most encoders leave a fair share of rows unfiltered; copying those is far cheaper than the
    // per-byte arithmetic below, and on a 4096x4096 card this loop is most of the decode cost.
    if (filter === 0) {
      raw.copy(out, rowStart, offset, offset + rowBytes);
      offset += rowBytes;
      continue;
    }

    for (let x = 0; x < rowBytes; x++) {
      const value = raw[offset + x];
      const left = x >= bytesPerPixel ? out[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? out[upStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? out[upStart + x - bytesPerPixel] : 0;

      let restored: number;
      switch (filter) {
        case 0:
          restored = value;
          break;
        case 1:
          restored = value + left;
          break;
        case 2:
          restored = value + up;
          break;
        case 3:
          restored = value + ((left + up) >> 1);
          break;
        case 4:
          restored = value + paeth(left, up, upLeft);
          break;
        default:
          return fail(`unknown scanline filter ${filter}`);
      }
      out[rowStart + x] = restored & 0xff;
    }
    offset += rowBytes;
  }

  return out;
}

/** Reads the sample at (x, y) for channel `c`, normalised to 0-255. */
function makeSampler(rows: Buffer, header: PngHeader, channels: number) {
  const { width, bitDepth } = header;
  const rowBytes = Math.ceil((width * bitDepth * channels) / 8);

  if (bitDepth === 16) {
    return (x: number, y: number, c: number) => rows[y * rowBytes + (x * channels + c) * 2];
  }
  if (bitDepth === 8) {
    return (x: number, y: number, c: number) => rows[y * rowBytes + x * channels + c];
  }

  // Sub-byte greyscale or palette: every pixel is packed into the same byte.
  const perByte = 8 / bitDepth;
  const mask = (1 << bitDepth) - 1;
  const scale = 255 / mask;
  return (x: number, y: number) => {
    const packed = rows[y * rowBytes + Math.floor(x / perByte)];
    const shift = 8 - bitDepth * ((x % perByte) + 1);
    const value = (packed >> shift) & mask;
    // Palette indices must stay raw; greyscale values are scaled to the full 0-255 range.
    return header.colorType === 3 ? value : Math.round(value * scale);
  };
}

function toRgba(rows: Buffer, parsed: ParsedPng): Buffer {
  const { header, palette, paletteAlpha } = parsed;
  const { width, height, bitDepth, colorType } = header;
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) fail(`unsupported colour type ${colorType}`);
  if (bitDepth !== 8 && bitDepth !== 16 && colorType !== 0 && colorType !== 3) {
    fail(`unsupported bit depth ${bitDepth} for colour type ${colorType}`);
  }

  // The common shape by far (RGBA, 8 bit) needs no per-pixel work at all; the second most common
  // (RGB, 8 bit) only needs an alpha byte appended. Both are worth special-casing: the generic
  // path calls a closure per channel per pixel, which on a 4096x4096 card is tens of millions of
  // calls and dominated the decode time.
  if (bitDepth === 8 && colorType === 6) return rows;
  if (bitDepth === 8 && colorType === 2) {
    const rgba = Buffer.allocUnsafe(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) {
      rgba[pixel * 4] = rows[pixel * 3];
      rgba[pixel * 4 + 1] = rows[pixel * 3 + 1];
      rgba[pixel * 4 + 2] = rows[pixel * 3 + 2];
      rgba[pixel * 4 + 3] = 255;
    }
    return rgba;
  }

  const sample = makeSampler(rows, header, channels);
  const rgba = Buffer.allocUnsafe(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      switch (colorType) {
        case 0: {
          const grey = sample(x, y, 0);
          rgba[at] = grey;
          rgba[at + 1] = grey;
          rgba[at + 2] = grey;
          rgba[at + 3] = 255;
          break;
        }
        case 2:
          rgba[at] = sample(x, y, 0);
          rgba[at + 1] = sample(x, y, 1);
          rgba[at + 2] = sample(x, y, 2);
          rgba[at + 3] = 255;
          break;
        case 3: {
          const index = sample(x, y, 0);
          const entry = index * 3;
          rgba[at] = palette && entry + 2 < palette.length ? palette[entry] : 0;
          rgba[at + 1] = palette && entry + 2 < palette.length ? palette[entry + 1] : 0;
          rgba[at + 2] = palette && entry + 2 < palette.length ? palette[entry + 2] : 0;
          rgba[at + 3] = paletteAlpha && index < paletteAlpha.length ? paletteAlpha[index] : 255;
          break;
        }
        case 4: {
          const grey = sample(x, y, 0);
          rgba[at] = grey;
          rgba[at + 1] = grey;
          rgba[at + 2] = grey;
          rgba[at + 3] = sample(x, y, 1);
          break;
        }
        default:
          rgba[at] = sample(x, y, 0);
          rgba[at + 1] = sample(x, y, 1);
          rgba[at + 2] = sample(x, y, 2);
          rgba[at + 3] = sample(x, y, 3);
      }
    }
  }

  return rgba;
}

/**
 * Box filter down to `width` x `height`. Channels are averaged premultiplied by alpha so
 * transparent borders do not bleed dark halos into the shrunk edge.
 */
function downscale(source: Buffer, sourceWidth: number, sourceHeight: number, width: number, height: number): Buffer {
  const out = Buffer.allocUnsafe(width * height * 4);

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * sourceHeight) / height);
    const y1 = Math.min(sourceHeight, Math.max(y0 + 1, Math.floor(((y + 1) * sourceHeight) / height)));

    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * sourceWidth) / width);
      const x1 = Math.min(sourceWidth, Math.max(x0 + 1, Math.floor(((x + 1) * sourceWidth) / width)));

      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const at = (sy * sourceWidth + sx) * 4;
          const a = source[at + 3];
          red += source[at] * a;
          green += source[at + 1] * a;
          blue += source[at + 2] * a;
          alpha += a;
          count++;
        }
      }

      const at = (y * width + x) * 4;
      if (alpha === 0) {
        out[at] = 0;
        out[at + 1] = 0;
        out[at + 2] = 0;
        out[at + 3] = 0;
      } else {
        out[at] = Math.round(red / alpha);
        out[at + 1] = Math.round(green / alpha);
        out[at + 2] = Math.round(blue / alpha);
        out[at + 3] = Math.round(alpha / count);
      }
    }
  }

  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.allocUnsafe(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crcInput = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.allocUnsafe(4);
  tail.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([head, data, tail]);
}

/** True for filters that only need the byte `bytesPerPixel` to the left. */
function filteredRow(row: Buffer, previous: Buffer | null, bytesPerPixel: number): { filter: number; data: Buffer } {
  const sub = Buffer.allocUnsafe(row.length);
  const up = Buffer.allocUnsafe(row.length);
  let subCost = 0;
  let upCost = 0;

  for (let i = 0; i < row.length; i++) {
    const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
    const above = previous ? previous[i] : 0;
    const subValue = (row[i] - left) & 0xff;
    const upValue = (row[i] - above) & 0xff;
    sub[i] = subValue;
    up[i] = upValue;
    subCost += subValue < 128 ? subValue : 256 - subValue;
    upCost += upValue < 128 ? upValue : 256 - upValue;
  }

  if (subCost <= upCost) return { filter: 1, data: sub };
  return { filter: 2, data: up };
}

function encode(rgba: Buffer, width: number, height: number): Buffer {
  // Filtering each scanline (Sub vs Up, whichever packs smaller) keeps the thumbnails a few
  // kilobytes instead of tens of kilobytes; the header is the only thing a decoder has to parse.
  const raw = Buffer.allocUnsafe((width * 4 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    const row = rgba.subarray(y * width * 4, (y + 1) * width * 4);
    const previous = y > 0 ? rgba.subarray((y - 1) * width * 4, y * width * 4) : null;
    const filtered = filteredRow(row, previous, 4);
    raw[offset++] = filtered.filter;
    filtered.data.copy(raw, offset);
    offset += filtered.data.length;
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * True when the module can decode this file: no interlacing (Adam7 pass reconstruction is a lot of
 * code for card art that never uses it) and a colour layout with a straight path to RGBA.
 */
function isSupported(parsed: ParsedPng): boolean {
  const { bitDepth, colorType, interlace } = parsed.header;
  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (interlace !== 0 || !channels) return false;
  if (bitDepth !== 8 && bitDepth !== 16 && bitDepth !== 1 && bitDepth !== 2 && bitDepth !== 4) return false;
  // Sub-byte samples only exist for greyscale and palette images (PNG spec, 11.2.2).
  if (bitDepth < 8 && colorType !== 0 && colorType !== 3) return false;
  // A `tRNS` on greyscale or RGB means one fully transparent colour: too rare to model here.
  if (parsed.paletteAlpha && colorType !== 3) return false;
  if (colorType === 3 && !parsed.palette) return false;
  return true;
}

/** Decodes a supported PNG to RGBA pixels; `null` when the file cannot be read. */
export function decodePngToRgba(source: Buffer): { width: number; height: number; rgba: Buffer } | null {
  try {
    const parsed = parse(source);
    if (!isSupported(parsed)) return null;
    const { width, height, colorType } = parsed.header;
    const rows = unfilter(inflateSync(Buffer.concat(parsed.idat)), parsed.header, CHANNELS_BY_COLOR_TYPE[colorType]);
    return { width, height, rgba: toRgba(rows, parsed) };
  } catch {
    return null;
  }
}

/**
 * Returns a PNG no larger than `maxSize` on its longest side, or `null` when the source cannot be
 * read or is already small enough (in which case the caller should serve the original).
 */
export function makeThumbnailPng(source: Buffer, maxSize: number): PngThumbnail | null {
  if (!Number.isFinite(maxSize) || maxSize < 1) return null;

  try {
    const parsed = parse(source);
    const { width, height } = parsed.header;

    if (!isSupported(parsed)) return null;
    if (width * height > MAX_SOURCE_PIXELS) return null;
    if (Math.max(width, height) <= maxSize) return null;

    const decoded = decodePngToRgba(source);
    if (!decoded) return null;

    const scale = maxSize / Math.max(width, height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const small = downscale(decoded.rgba, width, height, targetWidth, targetHeight);

    return { buffer: encode(small, targetWidth, targetHeight), width: targetWidth, height: targetHeight };
  } catch {
    return null;
  }
}

/** Reads a PNG's declared size without decoding pixels; `null` when it is not a readable PNG. */
export function readPngSize(source: Buffer): { width: number; height: number } | null {
  try {
    const { width, height } = parse(source).header;
    return { width, height };
  } catch {
    return null;
  }
}
