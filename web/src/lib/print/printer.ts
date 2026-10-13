'use client';

/**
 * Prints an HTML document from a hidden frame so the app's own layout never reaches the printer.
 * On the counter PC run Chrome with --kiosk-printing to print straight to the default (thermal) printer
 * without a dialog.
 */
export function printHtml(html: string): void {
  if (typeof document === 'undefined') return;
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
  target.onload = () => {
    target.dataset.printed = String(Number(target.dataset.printed || 0) + 1);
    target.contentWindow?.focus();
    target.contentWindow?.print();
  };
  target.srcdoc = html;
}
