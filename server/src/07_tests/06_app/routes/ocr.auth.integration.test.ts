import fs from "fs";
import path from "path";
import request from "supertest";
import { app } from "../../../05_frameworks/index";
import { generateAccessToken } from "../../../utils/jwt";

const OCR_DIR = path.join(process.cwd(), "data/ocr");

describe("OCR routes require authentication and isolate user files", () => {
  const ownerToken = generateAccessToken(9001, "owner@example.com", "Owner");
  const otherToken = generateAccessToken(9002, "other@example.com", "Other");
  const ownerFile = "9001_testfile_secret.png";
  const ownerPath = path.join(OCR_DIR, ownerFile);

  beforeAll(() => {
    fs.mkdirSync(OCR_DIR, { recursive: true });
    fs.writeFileSync(ownerPath, "not-really-a-png");
  });

  afterAll(() => {
    fs.rmSync(ownerPath, { force: true });
  });

  it.each([
    ["get", "/api/ocr/gallery"],
    ["get", `/api/ocr/images/${ownerFile}`],
    ["get", "/api/ocr/status/some-job"],
    ["post", "/api/ocr/parse"],
    ["post", "/api/ocr"],
    ["delete", `/api/ocr/${ownerFile}`],
  ])("%s %s rejects anonymous callers", async (method, url) => {
    const res = await (request(app) as any)[method](url);
    expect(res.status).toBe(401);
  });

  it("the health probe also requires a token (everything under /api does)", async () => {
    const res = await request(app).get("/api/ocr/health");
    expect(res.status).toBe(401);
  });

  it("owners can read their own image", async () => {
    const res = await request(app)
      .get(`/api/ocr/images/${ownerFile}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
  });

  it("other users cannot read or delete someone else's image", async () => {
    const read = await request(app)
      .get(`/api/ocr/images/${ownerFile}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(read.status).toBe(404);

    const del = await request(app)
      .delete(`/api/ocr/${ownerFile}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(del.status).toBe(404);
    expect(fs.existsSync(ownerPath)).toBe(true);
  });

  it("path traversal attempts never reach the filesystem", async () => {
    for (const evil of [
      "..%2f..%2fpackage.json",
      "9001_%2e%2e%2fpackage.json",
    ]) {
      const res = await request(app)
        .get(`/api/ocr/images/${evil}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect([403, 404]).toContain(res.status);
    }
  });

  it("the gallery lists only the caller's files", async () => {
    const mine = await request(app)
      .get("/api/ocr/gallery")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body)).toContain(ownerFile);

    const theirs = await request(app)
      .get("/api/ocr/gallery")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(theirs.status).toBe(200);
    expect(JSON.stringify(theirs.body)).not.toContain(ownerFile);
  });

  it("rejects non-image uploads", async () => {
    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("image", Buffer.from("<?php echo 1; ?>"), {
        filename: "shell.php",
        contentType: "application/x-php",
      });
    expect(res.status).toBe(400);
  });
});
