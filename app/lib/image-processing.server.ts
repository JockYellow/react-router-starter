import { decode as decodeJpeg } from "@jsquash/jpeg";
import { decode as decodePng } from "@jsquash/png";
import { decode as decodeWebp, encode as encodeWebp } from "@jsquash/webp";
import resize from "@jsquash/resize";

type DecodedImage = Awaited<ReturnType<typeof decodeJpeg>>;

const MAX_WIDTH = 1600;
const WEBP_QUALITY = 78;

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
  const resized = decoded.width > MAX_WIDTH ? await resize(decoded, { width: MAX_WIDTH }) : decoded;
  const webp = await encodeWebp(resized, { quality: WEBP_QUALITY });
  return {
    data: webp,
    contentType: "image/webp",
    width: resized.width,
    height: resized.height,
  };
}
