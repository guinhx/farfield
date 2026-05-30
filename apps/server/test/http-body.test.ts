import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { encodeUnifiedPayloadFrame } from "@farfield/unified-surface";
import {
  MAX_UNIFIED_BODY_BYTES,
  readUnifiedBody,
} from "../src/http-body.js";

describe("readUnifiedBody", () => {
  it("decodes a binary unified payload", async () => {
    const body = await readUnifiedBody(
      Readable.from([encodeUnifiedPayloadFrame({ ok: true })]),
    );

    expect(body).toEqual({ ok: true });
  });

  it("rejects bodies over the server limit", async () => {
    await expect(
      readUnifiedBody(Readable.from([Buffer.alloc(MAX_UNIFIED_BODY_BYTES + 1)])),
    ).rejects.toThrow("Request body is too large");
  });
});
