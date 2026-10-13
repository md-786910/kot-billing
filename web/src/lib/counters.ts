import mongoose from 'mongoose';

interface Counter {
  _id: string;
  seq: number;
}

/**
 * Atomic, race-free sequence (order, KOT, void, booking and shift numbers).
 * The first call seeds the counter from `seed()` (the highest number already in use).
 */
export async function nextSequence(name: string, seed: () => Promise<number>): Promise<number> {
  const counters = mongoose.connection.collection<Counter>('counters');
  const bump = () => counters.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after' });

  let doc = await bump();
  if (!doc) {
    try {
      await counters.insertOne({ _id: name, seq: await seed() });
    } catch (error) {
      // Another request seeded it first
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    doc = await bump();
  }
  return doc!.seq;
}

/** Highest numeric suffix among existing values like "KOT-0042" (or `floor` when none). */
export function maxSuffix(values: string[], prefix: string, floor = 0): number {
  const pattern = new RegExp(`^${prefix}(\\d+)`);
  return values.reduce((max, v) => {
    const m = v?.match(pattern);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, floor);
}
