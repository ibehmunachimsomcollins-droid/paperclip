import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { Readable } from "node:stream";
import path from "node:path";
import express from "express";
import type { Server } from "node:http";
import sharp from "sharp";
import { appearanceForPalette } from "@paperclipai/shared";
import { createLocalDiskStorageProvider } from "../storage/local-disk-provider.js";
import { createAgentAvatarService, avatarCacheKey } from "../services/agent-avatars.js";
import { createAgentAvatarPool } from "../services/agent-avatar-pool.js";
import { agentAvatarRoutes } from "../routes/agent-avatars.js";

const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => { await Promise.all(cleanups.splice(0).map(fn => fn())); });
async function consume(stream: Readable) {
  for await (const _ of stream) { /* Finish reads before deleting their cache files. */ }
}
async function storage() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-avatar-custom-test-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return createLocalDiskStorageProvider(dir);
}
const BASE = "/api/agent-avatars/cap-v1/arctic-blue/rest.png";

describe("on-demand agent avatar customization (NEXUS)", () => {
  it("renders persisted shape and custom colours with distinct cache entries", async () => {
    const provider = await storage();
    const service = createAgentAvatarService(provider);
    cleanups.push(() => service.close());
    const app = express(); app.use("/api", agentAvatarRoutes(service).router);
    const server = await new Promise<Server>(resolve => { const running = app.listen(0, "127.0.0.1", () => resolve(running)); });
    cleanups.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const root = `http://127.0.0.1:${(server.address() as { port: number }).port}${BASE}`;

    const plain = await fetch(`${root}?size=64&scale=1`);
    expect(plain.status).toBe(200); await plain.arrayBuffer();
    const shaped = await fetch(`${root}?size=64&scale=1&shape=sphere`);
    expect(shaped.status).toBe(200);
    expect(shaped.headers.get("etag")).not.toBe(plain.headers.get("etag"));
    await shaped.arrayBuffer();
    const recoloured = await fetch(`${root}?size=64&scale=1&ca=ff26a8&cb=fff78a`);
    expect(recoloured.status).toBe(200);
    expect(recoloured.headers.get("etag")).not.toBe(plain.headers.get("etag"));
    await recoloured.arrayBuffer();
    const both = await fetch(`${root}?size=64&scale=1&shape=capsule&ca=ff26a8&cb=fff78a`);
    expect(both.status).toBe(200);
    expect(both.headers.get("etag")).not.toBe(recoloured.headers.get("etag"));
    await both.arrayBuffer();
    // The customized URL is replayable and the cache key separates identities.
    const cached = await fetch(`${root}?size=64&scale=1&shape=sphere`, { headers: { "If-None-Match": shaped.headers.get("etag")! } });
    expect(cached.status).toBe(304);
    const base = { appearance: appearanceForPalette("arctic-blue"), size: 64, scale: 1 as const, pose: "rest" as const, muted: false };
    expect(avatarCacheKey({ ...base, appearance: { ...base.appearance, shape: "sphere" } })).not.toBe(avatarCacheKey(base));
    expect(avatarCacheKey({ ...base, appearance: { ...base.appearance, customColors: { a: "#ff26a8", b: "#fff78a" } } })).not.toBe(avatarCacheKey(base));
  }, 30_000);

  it("rejects malformed customization parameters without consuming a render", async () => {
    const provider = await storage();
    const service = createAgentAvatarService(provider, async () => Buffer.from("png"));
    const app = express(); app.use("/api", agentAvatarRoutes(service).router);
    const server = await new Promise<Server>(resolve => { const running = app.listen(0, "127.0.0.1", () => resolve(running)); });
    cleanups.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const root = `http://127.0.0.1:${(server.address() as { port: number }).port}${BASE}`;
    for (const suffix of [
      "?size=64&shape=cylinder",
      "?size=64&ca=red&cb=fff78a",
      "?size=64&ca=ff26a8&cb=zzzzzz",
      "?size=64&ca=ff26a8",
      "?size=64&cb=fff78a",
      "?size=64&ca=FF26A8&cb=fff78a",
      "?size=64&colour=red",
    ]) {
      const invalid = await fetch(root + suffix);
      expect(invalid.status, suffix).toBe(400);
      await invalid.text();
    }
  });

  it("renders customized avatars as valid transparent PNGs in the worker", async () => {
    const pool = createAgentAvatarPool(1); cleanups.push(() => pool.close());
    const appearance = { ...appearanceForPalette("bubblegum-sky"), shape: "sphere" as const, customColors: { a: "#ff26a8", b: "#fff78a" } };
    const png = await pool.render({ appearance, size: 64, scale: 2, pose: "rest", muted: false });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 128, height: 128, channels: 4, format: "png", hasAlpha: true });
    expect(data[(0 * info.width + 0) * info.channels + 3]).toBe(0);
  }, 20_000);
});
