/**
 * Inline SVG placeholder used when a product (or any image entity) has no
 * image or its remote URL fails to load. Self-contained data URL to avoid
 * any external network dependency (the previous placeholders pointed to
 * via.placeholder.com / placehold.co, which proved unreliable).
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#f3f4f6"/>
  <g fill="none" stroke="#9ca3af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="40" y="50" width="120" height="100" rx="8"/>
    <circle cx="76" cy="86" r="10"/>
    <path d="M40 130 L80 96 L116 130 L140 110 L160 128"/>
  </g>
  <text x="100" y="178" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#9ca3af">Sin imagen</text>
</svg>`;

export const IMAGE_PLACEHOLDER_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  PLACEHOLDER_SVG
)}`;

/**
 * Use as `(error)="onImageError($event)"` on any `<img>` to swap a broken
 * remote URL for the inline placeholder. Idempotent — once swapped, the
 * handler is a no-op so we don't loop on placeholder errors.
 */
export function onImageError(event: Event): void {
  const target = event.target as HTMLImageElement | null;
  if (!target) return;
  if (target.src === IMAGE_PLACEHOLDER_DATA_URL) return;
  target.src = IMAGE_PLACEHOLDER_DATA_URL;
}
