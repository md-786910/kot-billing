import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';

interface RequestKey {
  _id: string;
  createdAt: Date;
  status: 'PENDING' | 'DONE';
  response?: unknown;
}

declare global {
  var requestKeyIndexReady: Promise<string> | undefined;
}

function collection() {
  const col = mongoose.connection.collection<RequestKey>('requestkeys');
  // Keys are only needed long enough to absorb retries
  global.requestKeyIndexReady ??= col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 });
  return col;
}

/**
 * Runs `handler` at most once per client-supplied `idempotencyKey` (per device/user).
 * A retry of a finished request gets the original response; a retry while it is still running gets 409.
 * Requests without a key run normally.
 */
export async function withIdempotency(
  req: NextRequest,
  auth: AuthContext,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  let key = '';
  try {
    const body = await req.clone().json();
    if (typeof body?.idempotencyKey === 'string' && body.idempotencyKey.length <= 100) key = body.idempotencyKey;
  } catch {
    // Malformed bodies are reported by the handler itself
  }
  if (!key) return handler();

  const id = `${new URL(req.url).pathname}:${auth.device?.id ?? auth.user?.id}:${key}`;
  const col = collection();
  await global.requestKeyIndexReady;
  try {
    await col.insertOne({ _id: id, createdAt: new Date(), status: 'PENDING' });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await col.findOne({ _id: id });
    if (existing?.status === 'DONE') return NextResponse.json(existing.response);
    return NextResponse.json({ success: false, error: 'This request is already being processed' }, { status: 409 });
  }

  let res: NextResponse;
  try {
    res = await handler();
  } catch (error) {
    await col.deleteOne({ _id: id });
    throw error;
  }
  if (res.ok) {
    await col.updateOne({ _id: id }, { $set: { status: 'DONE', response: await res.clone().json() } });
  } else {
    // Failed attempts may be retried with the same key
    await col.deleteOne({ _id: id });
  }
  return res;
}
