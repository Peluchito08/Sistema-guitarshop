import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "product-images.json");

export type ProductImageMap = Record<number, string>;

type JsonImageMap = Record<string, string>;

type NodeErrorWithCode = Error & { code?: string };

function isNodeErrorWithCode(err: unknown): err is NodeErrorWithCode {
  return err instanceof Error;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readImageFile(): Promise<JsonImageMap> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as JsonImageMap;
  } catch (error: unknown) {
    if (isNodeErrorWithCode(error) && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function normalizeMap(jsonMap: JsonImageMap): ProductImageMap {
  const result: ProductImageMap = {};
  Object.entries(jsonMap).forEach(([key, value]) => {
    const id = Number(key);
    if (!Number.isNaN(id) && typeof value === "string" && value.trim().length > 0) {
      result[id] = value;
    }
  });
  return result;
}

async function writeImageFile(map: ProductImageMap) {
  await ensureDataDir();
  const jsonMap: JsonImageMap = {};
  Object.entries(map).forEach(([key, value]) => {
    jsonMap[key] = value;
  });
  await fs.writeFile(DATA_FILE, JSON.stringify(jsonMap, null, 2), "utf8");
}

export async function listProductImages(): Promise<ProductImageMap> {
  const stored = await readImageFile();
  return normalizeMap(stored);
}

export async function getProductImage(id: number): Promise<string | null> {
  const images = await listProductImages();
  return images[id] ?? null;
}

export async function setProductImage(id: number, url: string | null) {
  const images = await listProductImages();
  if (url && url.trim().length > 0) {
    images[id] = url.trim();
  } else {
    delete images[id];
  }
  await writeImageFile(images);
  return images[id] ?? null;
}
