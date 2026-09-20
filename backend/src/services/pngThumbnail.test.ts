import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { decodePngToRgba, makeThumbnailPng, readPngSize } from "./pngThumbnail.js";

// Fixtures are built by an encoder written here, independent of the module under test: if both
// halves shared helper code, a wrong CRC or filter would cancel out and the test would pass.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

interface Fixture {
  width: number;
  height: number;
  colorType: number;
  bitDepth?: number;
  /** Unfiltered scanline bytes, concatenated. */
  scanlines: Buffer;
  palette?: Buffer;
  paletteAlpha?: Buffer;
  /** tRNS chunk for greyscale/RGB images (a single transparent colour). */
  transparencyKey?: Buffer;
  interlace?: number;
}

/** Builds a PNG whose scanlines all use filter 0, so the bytes go in exactly as written. */
function buildPng(fixture: Fixture): Buffer {
  const bitDepth = fixture.bitDepth ?? 8;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(fixture.width, 0);
  ihdr.writeUInt32BE(fixture.height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = fixture.colorType;
  ihdr[12] = fixture.interlace ?? 0;

  const rowBytes = Math.ceil((fixture.width * bitDepth * (fixture.colorType === 6 ? 4 : fixture.colorType === 2 ? 3 : fixture.colorType === 4 ? 2 : 1)) / 8);
  const raw = Buffer.alloc((rowBytes + 1) * fixture.height);
  for (let y = 0; y < fixture.height; y++) {
    raw[y * (rowBytes + 1)] = 0;
    fixture.scanlines.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const parts = [SIGNATURE, chunk("IHDR", ihdr)];
  if (fixture.palette) parts.push(chunk("PLTE", fixture.palette));
  if (fixture.paletteAlpha) parts.push(chunk("tRNS", fixture.paletteAlpha));
  if (fixture.transparencyKey) parts.push(chunk("tRNS", fixture.transparencyKey));
  parts.push(chunk("IDAT", deflateSync(raw)));
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** Four solid quadrants: top-left red, top-right green, bottom-left blue, bottom-right white. */
function quadrantRgba(width: number, height: number): Buffer {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const right = x >= width / 2;
      const bottom = y >= height / 2;
      const [red, green, blue] = right
        ? bottom
          ? [255, 255, 255]
          : [0, 255, 0]
        : bottom
          ? [0, 0, 255]
          : [255, 0, 0];
      const at = (y * width + x) * 4;
      rgba[at] = red;
      rgba[at + 1] = green;
      rgba[at + 2] = blue;
      rgba[at + 3] = 255;
    }
  }
  return rgba;
}

test("downscales a card-shaped PNG to the requested longest side", () => {
  const source = buildPng({ width: 512, height: 256, colorType: 6, scanlines: quadrantRgba(512, 256) });
  const thumbnail = makeThumbnailPng(source, 128);

  assert.ok(thumbnail, "expected a thumbnail");
  assert.equal(thumbnail.width, 128);
  assert.equal(thumbnail.height, 64);

  const decoded = decodePngToRgba(thumbnail.buffer);
  assert.ok(decoded);
  assert.equal(decoded.width, 128);
  assert.equal(decoded.height, 64);

  // Each quadrant has to land on the same colour it started with, alpha included.
  const pixel = (x: number, y: number) => Array.from(decoded.rgba.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4));
  assert.deepEqual(pixel(10, 10), [255, 0, 0, 255]);
  assert.deepEqual(pixel(100, 10), [0, 255, 0, 255]);
  assert.deepEqual(pixel(10, 50), [0, 0, 255, 255]);
  assert.deepEqual(pixel(100, 50), [255, 255, 255, 255]);
});

test("averages the source pixels of each downscaled pixel", () => {
  // 2x1 source: one black pixel and one white. A 1x1 thumbnail has to come out mid grey.
  const scanlines = Buffer.from([0, 0, 0, 255, 255, 255, 255, 255]);
  const source = buildPng({ width: 2, height: 1, colorType: 6, scanlines });

  const thumbnail = makeThumbnailPng(source, 1);
  assert.ok(thumbnail);
  assert.equal(thumbnail.width, 1);
  assert.equal(thumbnail.height, 1);

  const decoded = decodePngToRgba(thumbnail.buffer);
  assert.ok(decoded);
  assert.deepEqual(Array.from(decoded.rgba), [128, 128, 128, 255]);
});

test("keeps transparency through the downscale", () => {
  const scanlines = Buffer.from([255, 0, 0, 0, 0, 0, 255, 255]);
  const source = buildPng({ width: 2, height: 1, colorType: 6, scanlines });

  const thumbnail = makeThumbnailPng(source, 1);
  assert.ok(thumbnail);
  const decoded = decodePngToRgba(thumbnail.buffer);
  assert.ok(decoded);
  // Premultiplied averaging: the transparent red contributes no colour at all, so what is left is
  // blue at half alpha — no dark red halo bleeding into the edge.
  assert.deepEqual(Array.from(decoded.rgba), [0, 0, 255, 128]);
});

test("reads greyscale, RGB, greyscale+alpha, palette and 16 bit sources", () => {
  const grey = buildPng({ width: 2, height: 1, colorType: 0, scanlines: Buffer.from([10, 200]) });
  const greyThumb = makeThumbnailPng(grey, 1);
  assert.ok(greyThumb);
  const greyDecoded = decodePngToRgba(greyThumb.buffer);
  assert.ok(greyDecoded);
  assert.deepEqual(Array.from(greyDecoded.rgba), [105, 105, 105, 255]);

  const rgb = buildPng({ width: 2, height: 1, colorType: 2, scanlines: Buffer.from([255, 0, 0, 0, 0, 255]) });
  const rgbThumb = makeThumbnailPng(rgb, 1);
  assert.ok(rgbThumb);
  const rgbDecoded = decodePngToRgba(rgbThumb.buffer);
  assert.ok(rgbDecoded);
  assert.deepEqual(Array.from(rgbDecoded.rgba), [128, 0, 128, 255]);

  const greyAlpha = buildPng({ width: 2, height: 1, colorType: 4, scanlines: Buffer.from([255, 255, 0, 0]) });
  const greyAlphaThumb = makeThumbnailPng(greyAlpha, 1);
  assert.ok(greyAlphaThumb);
  const greyAlphaDecoded = decodePngToRgba(greyAlphaThumb.buffer);
  assert.ok(greyAlphaDecoded);
  assert.deepEqual(Array.from(greyAlphaDecoded.rgba), [255, 255, 255, 128]);

  // Palette: index 0 is red and fully opaque, index 1 is green and fully transparent.
  const palette = buildPng({
    width: 2,
    height: 1,
    colorType: 3,
    scanlines: Buffer.from([0, 1]),
    palette: Buffer.from([255, 0, 0, 0, 255, 0]),
    paletteAlpha: Buffer.from([255, 0]),
  });
  const paletteThumb = makeThumbnailPng(palette, 1);
  assert.ok(paletteThumb);
  const paletteDecoded = decodePngToRgba(paletteThumb.buffer);
  assert.ok(paletteDecoded);
  // Only the opaque red half survives premultiplication, at half alpha.
  assert.deepEqual(Array.from(paletteDecoded.rgba), [255, 0, 0, 128]);

  // 16 bit samples keep their most significant byte: two 0x1212 greys average to 0x12.
  const deep = buildPng({
    width: 2,
    height: 1,
    colorType: 6,
    bitDepth: 16,
    scanlines: Buffer.from([0x12, 0x12, 0x12, 0x12, 0x12, 0x12, 0xff, 0xff, 0x12, 0x12, 0x12, 0x12, 0x12, 0x12, 0xff, 0xff]),
  });
  const deepThumb = makeThumbnailPng(deep, 1);
  assert.ok(deepThumb);
  const deepDecoded = decodePngToRgba(deepThumb.buffer);
  assert.ok(deepDecoded);
  assert.deepEqual(Array.from(deepDecoded.rgba), [18, 18, 18, 255]);
});

test("leaves images that are already small enough to the caller", () => {
  const source = buildPng({ width: 64, height: 64, colorType: 6, scanlines: quadrantRgba(64, 64) });
  assert.equal(makeThumbnailPng(source, 192), null);
});

test("refuses input it cannot decode instead of throwing", () => {
  assert.equal(makeThumbnailPng(Buffer.from("not a png at all"), 128), null);
  assert.equal(makeThumbnailPng(Buffer.alloc(0), 128), null);

  // Valid header bytes, truncated body.
  const truncated = buildPng({ width: 300, height: 300, colorType: 6, scanlines: quadrantRgba(300, 300) }).subarray(0, 40);
  assert.equal(makeThumbnailPng(truncated, 128), null);

  // Interlaced Adam7 is not supported, so the caller has to serve the original.
  const interlaced = buildPng({ width: 300, height: 300, colorType: 6, scanlines: quadrantRgba(300, 300), interlace: 1 });
  assert.equal(makeThumbnailPng(interlaced, 128), null);

  // tRNS on a greyscale image means "one transparent grey", which this module does not model.
  const greyWithKey = buildPng({
    width: 300,
    height: 300,
    colorType: 0,
    scanlines: Buffer.alloc(300 * 300),
    transparencyKey: Buffer.from([0, 10]),
  });
  assert.equal(makeThumbnailPng(greyWithKey, 128), null);
});

test("reports the declared size of a PNG", () => {
  const source = buildPng({ width: 300, height: 150, colorType: 6, scanlines: quadrantRgba(300, 150) });
  assert.deepEqual(readPngSize(source), { width: 300, height: 150 });
  assert.equal(readPngSize(Buffer.from([1, 2, 3])), null);
});
