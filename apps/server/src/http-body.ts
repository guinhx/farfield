import { Buffer } from "node:buffer";
import {
  JsonValueSchema,
  decodeUnifiedPayloadFrame,
  type JsonValue,
} from "@farfield/unified-surface";

export const MAX_UNIFIED_BODY_BYTES = 16 * 1024 * 1024;

export interface UnifiedBodyReadable extends AsyncIterable<Uint8Array> {
  destroy(error?: Error): void;
}

export async function readUnifiedBody(
  req: UnifiedBodyReadable,
): Promise<JsonValue> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    receivedBytes += buffer.length;

    if (receivedBytes > MAX_UNIFIED_BODY_BYTES) {
      const error = new Error(
        `Request body is too large; maximum is ${MAX_UNIFIED_BODY_BYTES} bytes`,
      );
      req.destroy(error);
      throw error;
    }

    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks, receivedBytes);
  if (raw.length === 0) {
    return JsonValueSchema.parse({});
  }

  return decodeUnifiedPayloadFrame(raw);
}
