/**
 * What a page does with a save once the session has written it: hands a file to
 * the browser's downloads, or puts a code on the clipboard.
 *
 * Both have to be reached from inside the tap that asked for them — a browser
 * refuses the clipboard, and may refuse a download, to anything else — which is
 * why the session answers the ask on the same call stack rather than later.
 */

// Long enough for any browser to have started reading the file before it goes.
const REVOKE_AFTER_MS = 60_000;

export function downloadFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/**
 * Whether the text reached the clipboard. It does not over plain http, which is
 * how a phone reaches the dev server on the LAN, so the caller always has the
 * text on screen to copy by hand as well.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
