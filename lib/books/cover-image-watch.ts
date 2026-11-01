import { isUsableCoverImageDimensions } from './covers.ts';

export const COVER_IMAGE_TIMEOUT_MS = 8_000;

/** One bounded attempt. Below-fold lazy images get their budget only once
 * visible. Cleanup invalidates callbacks from a previous edition/variant. */
export function watchCoverImage(image: HTMLImageElement, onFailure: (url: string) => void, eager: boolean): () => void {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: IntersectionObserver | undefined;
  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer);
    observer?.disconnect();
    image.removeEventListener('load', loaded);
    image.removeEventListener('error', failed);
  };
  const failed = () => {
    if (settled) return;
    settled = true;
    cleanup();
    onFailure(image.currentSrc || image.src);
  };
  const loaded = () => {
    if (settled) return;
    if (!isUsableCoverImageDimensions(image.naturalWidth, image.naturalHeight)) { failed(); return; }
    settled = true;
    cleanup();
  };
  const start = () => {
    if (settled || timer !== undefined) return;
    observer?.disconnect();
    if (image.complete) loaded();
    else timer = setTimeout(failed, COVER_IMAGE_TIMEOUT_MS);
  };
  image.addEventListener('load', loaded);
  image.addEventListener('error', failed);
  if (eager || typeof IntersectionObserver === 'undefined') start();
  else {
    observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) start(); });
    observer.observe(image);
  }
  return () => { settled = true; cleanup(); };
}
