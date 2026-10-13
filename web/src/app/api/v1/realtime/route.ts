import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { realtimeHub, RealtimeMessage } from '@/lib/realtime';


export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, 'data.read');
  if (!guard.ok) return guard.response;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`)
      );

      const listener = (msg: RealtimeMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      realtimeHub.on('pos-event', listener);

      // Keepalive ping every 25 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        realtimeHub.off('pos-event', listener);
        clearInterval(pingInterval);
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
