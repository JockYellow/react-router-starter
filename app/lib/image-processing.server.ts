import { decode as decodeJpeg } from "@jsquash/jpeg";
import { decode as decodePng } from "@jsquash/png";
import { decode as decodeWebp, encode as encodeWebp } from "@jsquash/webp";
import resize from "@jsquash/resize";

type DecodedImage = Awaited<ReturnType<typeof decodeJpeg>>;

const MAX_WIDTH = 1600;
const THUMB_WIDTH = 480;
const WEBP_QUALITY = 78;

function resizeToWidth(image: DecodedImage, width: number) {
  const height = Math.max(1, Math.round((image.height / image.width) * width));
  return resize(image, { width, height });
}

function guessMime(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function decodeImage(buffer: ArrayBuffer, mime: string): Promise<DecodedImage> {
  switch (mime) {
    case "image/png":
      return decodePng(buffer);
    case "image/webp":
      return decodeWebp(buffer);
    default:
      return decodeJpeg(buffer);
  }
}

export async function processCoverImage(file: File) {
  const mime = guessMime(file);
  const raw = await file.arrayBuffer();
  if (!raw.byteLength) {
    throw new Error("圖片檔案為空");
  }
  const decoded = await decodeImage(raw, mime);
  const resized = decoded.width > MAX_WIDTH ? await resizeToWidth(decoded, MAX_WIDTH) : decoded;
  const webp = await encodeWebp(resized, { quality: WEBP_QUALITY });
  return {
    data: webp,
    contentType: "image/webp",
    width: resized.width,
    height: resized.height,
  };
}

export async function processBlogImage(file: File) {
  const mime = guessMime(file);
  const raw = await file.arrayBuffer();
  if (!raw.byteLength) {
    throw new Error("圖片檔案為空");
  }
  const decoded = await decodeImage(raw, mime);
  const display = decoded.width > MAX_WIDTH ? await resizeToWidth(decoded, MAX_WIDTH) : decoded;
  const thumb = decoded.width > THUMB_WIDTH ? await resizeToWidth(decoded, THUMB_WIDTH) : decoded;
  const [displayWebp, thumbWebp] = await Promise.all([
    encodeWebp(display, { quality: WEBP_QUALITY }),
    encodeWebp(thumb, { quality: 72 }),
  ]);
  return {
    originalBytes: raw.byteLength,
    width: display.width,
    height: display.height,
    display: {
      data: displayWebp,
      contentType: "image/webp",
    },
    thumb: {
      data: thumbWebp,
      contentType: "image/webp",
    },
  };
}
