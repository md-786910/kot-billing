import { EventEmitter } from 'events';

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
  | 'PRINT_JOB';

export interface RealtimeMessage {
  type: RealtimeEventType;
  payload: any;
  timestamp: string;
}

declare global {
  // eslint-disable-next-line no-var
  var realtimeEmitter: EventEmitter | undefined;
}

if (!global.realtimeEmitter) {
  global.realtimeEmitter = new EventEmitter();
  global.realtimeEmitter.setMaxListeners(200);
}

export const realtimeHub = global.realtimeEmitter;

export function broadcastRealtimeEvent(type: RealtimeEventType, payload: any) {
  const message: RealtimeMessage = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  realtimeHub.emit('pos-event', message);
}
