import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  prepareVisionImage,
  readJpegOrientation,
  type JpegOrientation,
} from "../src/lib/doubao-vision.ts";

/**
 * 离线方向归一化验证。使用合成像素图，不涉及任何真实用户照片或付费 API。
 * 构造方式：把「正确朝向的基准图」按各 Orientation 的逆变换存成 JPEG，
 * 再手工注入 EXIF Orientation 标签；prepareVisionImage 应还原为基准图。
 */

const WIDTH = 8;
const HEIGHT = 6;

function makeBaseRaw(): Buffer {
  const raw = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const at = (y * WIDTH + x) * 3;
      raw[at] = (x * 31 + y * 7) % 256;
      raw[at + 1] = (x * 11 + y * 43) % 256;
      raw[at + 2] = (x * 53 + y * 17) % 256;
    }
  }
  return raw;
}

/** 在 JPEG SOI 后插入带 Orientation 标签的 APP1/Exif 段（little-endian TIFF）。 */
function withExifOrientation(jpeg: Uint8Array, orientation: JpegOrientation): Buffer {
  const tiff = Buffer.alloc(8 + 18);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); // IFD0 entry count
  tiff.writeUInt16LE(0x0112, 10); // Orientation
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // count
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22); // next IFD

  const payload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);

  return Buffer.concat([Buffer.from(jpeg.subarray(0, 2)), segment, Buffer.from(jpeg.subarray(2))]);
}

/** Orientation 的逆变换，用于从基准图构造「按标签存储」的像素。 */
async function applyInverse(jpeg: Uint8Array, orientation: JpegOrientation): Promise<Buffer> {
  let pipeline = sharp(Buffer.from(jpeg));
  switch (orientation) {
    case 1:
      break;
    case 2:
      pipeline = pipeline.flop();
      break;
    case 3:
      pipeline = pipeline.rotate(180);
      break;
    case 4:
      pipeline = pipeline.flip();
      break;
    case 5:
      pipeline = pipeline.rotate(270).flop(); // transpose 自逆
      break;
    case 6:
      pipeline = pipeline.rotate(270);
      break;
    case 7:
      pipeline = pipeline.rotate(90).flop(); // transverse 自逆
      break;
    case 8:
      pipeline = pipeline.rotate(90);
      break;
  }
  return pipeline.jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
}

function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / Math.max(1, length);
}

const baseRaw = makeBaseRaw();
const baseJpeg = await sharp(baseRaw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
  .jpeg({ quality: 100, chromaSubsampling: "4:4:4" })
  .toBuffer();

test("readJpegOrientation reads all 1-8 values and rejects missing tags", async () => {
  for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8] as JpegOrientation[]) {
    const oriented = withExifOrientation(baseJpeg, orientation);
    assert.equal(readJpegOrientation(oriented), orientation, `orientation ${orientation}`);
  }
  assert.equal(readJpegOrientation(baseJpeg), null);
  assert.equal(readJpegOrientation(new Uint8Array(Buffer.from("not a jpeg"))), null);
});

for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8] as JpegOrientation[]) {
  test(`orientation ${orientation}: pixels are normalized before EXIF is stripped`, async () => {
    const stored = await applyInverse(baseJpeg, orientation);
    const orientedInput = withExifOrientation(stored, orientation);

    assert.equal(readJpegOrientation(orientedInput), orientation);
    const prepared = await prepareVisionImage(orientedInput, "image/jpeg");

    assert.equal(prepared.orientation, orientation);
    assert.equal(prepared.orientationApplied, orientation !== 1);
    assert.equal(prepared.metadataStripped, true);
    assert.equal(prepared.inputWidth, orientation >= 5 && orientation <= 8 ? HEIGHT : WIDTH);
    assert.equal(prepared.width, WIDTH);
    assert.equal(prepared.height, HEIGHT);

    const sentBytes = Buffer.from(prepared.dataUrl.split(",")[1], "base64");
    assert.equal(readJpegOrientation(sentBytes), null, "EXIF must be gone from sent bytes");

    const decoded = await sharp(sentBytes).raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, WIDTH);
    assert.equal(decoded.info.height, HEIGHT);
    assert.ok(
      meanAbsDiff(decoded.data, baseRaw) < 12,
      `orientation ${orientation} did not recover base pixels (diff=${meanAbsDiff(decoded.data, baseRaw)})`,
    );
  });
}

test("orientation 1 keeps original JPEG bytes (no re-encode)", async () => {
  const orientedInput = withExifOrientation(baseJpeg, 1);
  const prepared = await prepareVisionImage(orientedInput, "image/jpeg");
  const sentBytes = Buffer.from(prepared.dataUrl.split(",")[1], "base64");
  const strippedLength = orientedInput.length - (4 + Buffer.byteLength("Exif\0\0", "ascii") + 26);
  assert.equal(sentBytes.length, strippedLength);
});
