export interface StorageAdapter {
  documentDirectory: string;
  getInfo(uri: string): Promise<{ exists: boolean }>;
  makeDirectory(uri: string): Promise<void>;
  readDirectory(uri: string): Promise<string[]>;
  deleteFile(uri: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
}

let customAdapter: StorageAdapter | null = null;
let customBaseDir: string | null = null;

export function setStorageAdapter(adapter: StorageAdapter | null) {
  customAdapter = adapter;
}

export function setCustomNoteImagesDir(dir: string | null) {
  customBaseDir = dir;
}

function getNodeAdapter(): StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const os = require("node:os");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("node:path");
  const docDir = path.join(os.tmpdir(), "ak_ems_note_images/");

  return {
    documentDirectory: docDir,
    async getInfo(uri: string) {
      const clean = uri.replace(/^file:\/\//, "");
      return { exists: fs.existsSync(clean) };
    },
    async makeDirectory(uri: string) {
      const clean = uri.replace(/^file:\/\//, "");
      fs.mkdirSync(clean, { recursive: true });
    },
    async readDirectory(uri: string) {
      const clean = uri.replace(/^file:\/\//, "");
      if (!fs.existsSync(clean)) return [];
      return fs.readdirSync(clean);
    },
    async deleteFile(uri: string) {
      const clean = uri.replace(/^file:\/\//, "");
      if (fs.existsSync(clean)) {
        fs.unlinkSync(clean);
      }
    },
    async moveFile(from: string, to: string) {
      const fromClean = from.replace(/^file:\/\//, "");
      const toClean = to.replace(/^file:\/\//, "");
      fs.copyFileSync(fromClean, toClean);
      if (fs.existsSync(fromClean)) {
        fs.unlinkSync(fromClean);
      }
    },
  };
}

function getExpoAdapter(): StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const FileSystem = require("expo-file-system/legacy");
  return {
    get documentDirectory() {
      return FileSystem.documentDirectory || "";
    },
    async getInfo(uri: string) {
      return await FileSystem.getInfoAsync(uri);
    },
    async makeDirectory(uri: string) {
      await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
    },
    async readDirectory(uri: string) {
      return await FileSystem.readDirectoryAsync(uri);
    },
    async deleteFile(uri: string) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    },
    async moveFile(from: string, to: string) {
      await FileSystem.moveAsync({ from, to });
    },
  };
}

function getAdapter(): StorageAdapter {
  if (customAdapter) return customAdapter;
  const isNode =
    typeof process !== "undefined" &&
    process.versions?.node &&
    !(globalThis as any).navigator?.product?.includes?.("ReactNative");

  if (isNode) {
    return getNodeAdapter();
  }
  return getExpoAdapter();
}

export function getNoteImagesDirectory(): string {
  if (customBaseDir) return customBaseDir;
  const adapter = getAdapter();
  const docDir = adapter.documentDirectory || "";
  const base = docDir.endsWith("/") ? docDir : `${docDir}/`;
  return `${base}note_images/`;
}

export function getNoteImageUri(filename: string): string {
  if (!filename) return "";
  if (
    filename.startsWith("file://") ||
    filename.startsWith("content://") ||
    filename.startsWith("http://") ||
    filename.startsWith("https://")
  ) {
    return filename;
  }
  return `${getNoteImagesDirectory()}${filename}`;
}

export async function ensureNoteImageDirectory(): Promise<string> {
  const dir = getNoteImagesDirectory();
  try {
    const adapter = getAdapter();
    const info = await adapter.getInfo(dir);
    if (!info.exists) {
      await adapter.makeDirectory(dir);
    }
  } catch (e) {
    console.warn("Could not ensure note images directory:", e);
  }
  return dir;
}

export async function saveImageAsWebP(sourceUri: string): Promise<string> {
  const adapter = getAdapter();
  await ensureNoteImageDirectory();
  const dir = getNoteImagesDirectory();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { manipulateAsync, SaveFormat } = require("expo-image-manipulator");

  // Compress to WebP at 80% quality (0.8)
  const manipulated = await manipulateAsync(sourceUri, [], {
    format: SaveFormat.WEBP,
    compress: 0.8,
  });

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const filename = `note_${timestamp}_${randomStr}.webp`;
  const destUri = `${dir}${filename}`;

  // Move manipulated WebP into app-private note_images/
  await adapter.moveFile(manipulated.uri, destUri);

  // Clean up temporary cache file if still existing and distinct
  if (sourceUri && sourceUri !== manipulated.uri) {
    try {
      const srcInfo = await adapter.getInfo(sourceUri);
      if (srcInfo.exists) {
        await adapter.deleteFile(sourceUri);
      }
    } catch {
      // Ignore cache cleanup failures
    }
  }

  return filename;
}

export async function deleteNoteImage(filename: string): Promise<void> {
  if (!filename) return;
  try {
    const adapter = getAdapter();
    const fileUri = getNoteImageUri(filename);
    const info = await adapter.getInfo(fileUri);
    if (info.exists) {
      await adapter.deleteFile(fileUri);
    }
  } catch (error) {
    // Idempotent and resilient - do not throw
    console.warn(`Failed to delete note image ${filename}:`, error);
  }
}

export async function deleteNoteImages(filenames: string[]): Promise<void> {
  if (!filenames || filenames.length === 0) return;
  await Promise.allSettled(filenames.map((f) => deleteNoteImage(f)));
}

export async function cleanupOrphanNoteImages(
  referencedFiles?: string[],
): Promise<{ deletedCount: number; totalScanned: number }> {
  try {
    const adapter = getAdapter();
    const dir = getNoteImagesDirectory();
    const info = await adapter.getInfo(dir);
    if (!info.exists) {
      return { deletedCount: 0, totalScanned: 0 };
    }

    const files = await adapter.readDirectory(dir);

    let validReferences = referencedFiles;
    if (!validReferences) {
      // Lazy-load DAL to prevent circular import issues
      const { getAllReferencedNoteImages } = await import("@/db");
      validReferences = await getAllReferencedNoteImages();
    }

    const refSet = new Set(validReferences.map((r) => r.trim()));

    let deletedCount = 0;
    for (const file of files) {
      if (!refSet.has(file)) {
        try {
          await adapter.deleteFile(`${dir}${file}`);
          deletedCount++;
        } catch (e) {
          console.warn(`Failed to delete orphaned file ${file}:`, e);
        }
      }
    }

    return { deletedCount, totalScanned: files.length };
  } catch (error) {
    console.error("Error cleaning up orphan note images:", error);
    return { deletedCount: 0, totalScanned: 0 };
  }
}
