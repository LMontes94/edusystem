import { sanitizeFilename } from './sanitize-filename';

export async function downloadBlob(
  blob: Blob,
  contentDisposition: string | undefined,
  fallbackName: string,
  options?: { signal?: AbortSignal },
): Promise<void> {
  if (options?.signal?.aborted) return;

  const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?([^;\s]+)/i)
    ?? contentDisposition?.match(/filename="?([^"]+)"?/i);
  const raw = match?.[1] ?? fallbackName;
  const filename = sanitizeFilename(decodeURIComponent(raw));

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  if (options?.signal) {
    options.signal.addEventListener('abort', () => {
      window.URL.revokeObjectURL(url);
      link.remove();
    });
  }

  link.click();
  window.URL.revokeObjectURL(url);
  link.remove();
}
