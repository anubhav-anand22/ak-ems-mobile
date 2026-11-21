import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  cleanupOrphanNoteImages,
  deleteNoteImage,
  deleteNoteImages,
  getNoteImagesDirectory,
  getNoteImageUri,
  setCustomNoteImagesDir,
} from "../src/lib/noteImageStorage";

test("noteImageStorage - URI Resolution and Directory Configuration", async (t) => {
  const tmpDir = path.join(os.tmpdir(), `test_note_imgs_${Date.now()}/`);
  fs.mkdirSync(tmpDir, { recursive: true });

  t.after(() => {
    setCustomNoteImagesDir(null);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test("configures and retrieves custom note images directory", () => {
    setCustomNoteImagesDir(tmpDir);
    assert.strictEqual(getNoteImagesDirectory(), tmpDir);
  });

  await t.test("resolves relative filenames to full file paths", () => {
    setCustomNoteImagesDir(tmpDir);
    const filename = "note_1700000000000_abc123.webp";
    assert.strictEqual(getNoteImageUri(filename), `${tmpDir}${filename}`);
  });

  await t.test("leaves absolute and remote URIs intact", () => {
    assert.strictEqual(
      getNoteImageUri("file:///data/user/0/app/note.webp"),
      "file:///data/user/0/app/note.webp",
    );
    assert.strictEqual(
      getNoteImageUri("content://media/external/images/media/123"),
      "content://media/external/images/media/123",
    );
    assert.strictEqual(
      getNoteImageUri("https://example.com/receipt.webp"),
      "https://example.com/receipt.webp",
    );
    assert.strictEqual(getNoteImageUri(""), "");
  });
});

test("noteImageStorage - File Deletion & Orphan Image Cleanup", async (t) => {
  const tmpDir = path.join(os.tmpdir(), `test_orphan_cleanup_${Date.now()}/`);
  fs.mkdirSync(tmpDir, { recursive: true });
  setCustomNoteImagesDir(tmpDir);

  t.after(() => {
    setCustomNoteImagesDir(null);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await t.test("idempotently deletes single and multiple files", async () => {
    const fileA = "note_test_a.webp";
    const fileB = "note_test_b.webp";
    fs.writeFileSync(path.join(tmpDir, fileA), "content_a");
    fs.writeFileSync(path.join(tmpDir, fileB), "content_b");

    assert.ok(fs.existsSync(path.join(tmpDir, fileA)));
    assert.ok(fs.existsSync(path.join(tmpDir, fileB)));

    await deleteNoteImage(fileA);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, fileA)), false);

    // Deleting already deleted file should not throw
    await deleteNoteImage(fileA);

    await deleteNoteImages([fileB, "non_existent.webp"]);
    assert.strictEqual(fs.existsSync(path.join(tmpDir, fileB)), false);
  });

  await t.test("scans directory and deletes only unreferenced orphan images", async () => {
    // Populate test directory with referenced and orphan files
    const referencedFiles = ["ref_receipt_1.webp", "ref_receipt_2.webp"];
    const orphanFiles = ["orphan_1.webp", "orphan_2.webp", "orphan_temp.webp"];

    for (const f of [...referencedFiles, ...orphanFiles]) {
      fs.writeFileSync(path.join(tmpDir, f), `data for ${f}`);
    }

    assert.strictEqual(fs.readdirSync(tmpDir).length, 5);

    // Run cleanup passing valid active references
    const result = await cleanupOrphanNoteImages(referencedFiles);

    assert.strictEqual(result.totalScanned, 5);
    assert.strictEqual(result.deletedCount, 3);

    // Referenced files must remain intact
    for (const f of referencedFiles) {
      assert.ok(
        fs.existsSync(path.join(tmpDir, f)),
        `Referenced file ${f} must not be deleted`,
      );
    }

    // Orphan files must be removed
    for (const f of orphanFiles) {
      assert.strictEqual(
        fs.existsSync(path.join(tmpDir, f)),
        false,
        `Orphan file ${f} should have been deleted`,
      );
    }

    // Second run should find 0 orphans
    const secondRun = await cleanupOrphanNoteImages(referencedFiles);
    assert.strictEqual(secondRun.deletedCount, 0);
    assert.strictEqual(secondRun.totalScanned, 2);
  });

  await t.test("handles non-existent or empty directory cleanly", async () => {
    const nonExistentDir = path.join(tmpDir, "non_existent_folder/");
    setCustomNoteImagesDir(nonExistentDir);

    const result = await cleanupOrphanNoteImages(["dummy.webp"]);
    assert.deepStrictEqual(result, { deletedCount: 0, totalScanned: 0 });
  });
});
