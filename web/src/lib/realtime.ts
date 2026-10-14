import { after } from 'next/server';
import mongoose from 'mongoose';

export type RealtimeEventType =
  | 'INIT'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'KOT_CREATED'
  | 'KOT_STATUS_CHANGED'
  | 'TABLE_STATUS_CHANGED'
  | 'SHISHA_TIMER_UPDATED'
  | 'BOOKING_CREATED'
  | 'BOOKING_CLOSED'
  | 'TABLE_MERGED'
  | 'TABLE_TRANSFERRED'
  | 'BILL_SETTLED'
  | 'PRINT_JOB'
  | 'MENU_UPDATED'
  | 'SETTINGS_UPDATED';

interface SyncDoc {
  _id: string;
  version: number;
  lastEvent?: string;
  at?: Date;
}

function syncCollection() {
  return mongoose.connection.collection<SyncDoc>('sync');
}

/**
 * Marks that data changed. Screens poll `/api/v1/sync` and reload only when the version moves.
 * Stored in MongoDB (not server memory) so it works across serverless instances on Vercel;
 * the write runs just after the response is sent.
 */
export function broadcastRealtimeEvent(type: RealtimeEventType, payload?: unknown) {
  void payload;
  after(async () => {
    try {
      await syncCollection().updateOne({ _id: 'data' }, { $inc: { version: 1 }, $set: { lastEvent: type, at: new Date() } }, { upsert: true });
    } catch (error) {
      console.error('Sync version update failed:', error);
    }
  });
}

/** Current data version (0 before the first change) */
export async function syncVersion(): Promise<number> {
  const doc = await syncCollection().findOne({ _id: 'data' });
  return doc?.version ?? 0;
}
