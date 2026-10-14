'use client';

/**
 * Prints an HTML document from a hidden frame so the app's own layout never reaches the printer.
 * On the counter PC run Chrome with --kiosk-printing to print straight to the default (thermal) printer
 * without a dialog. Resolves once the browser has handed the document to the printer.
 */
export function printHtml(html: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  let frame = document.getElementById('print-frame') as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
  }
  const target = frame;
  return new Promise((resolve) => {
    target.onload = () => {
      target.dataset.printed = String(Number(target.dataset.printed || 0) + 1);
      target.contentWindow?.focus();
      target.contentWindow?.print();
      // Give the spooler a moment before the next document replaces this one
      setTimeout(resolve, 400);
    };
    target.srcdoc = html;
  });
}

/** Ask the counter printer for a slip (bill, KOT reprint, Z-report, retry). Shows an alert if it can't be queued. */
export async function requestPrint(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.error || 'Could not send to the printer');
      return false;
    }
    window.dispatchEvent(new Event('print-queue-changed'));
    return true;
  } catch {
    alert('Cannot reach the server. Nothing was sent to the printer.');
    return false;
  }
}
