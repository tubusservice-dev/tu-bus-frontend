/**
 * URL-safe slug, identical to the backend `generateSlug`:
 * "Juan José Mora" → "juan-jose-mora", "Miranda (Carabobo)" → "miranda-carabobo".
 *
 * Used to compare names from the static state list (customer profile) with the
 * slugs of the seeded cities and municipalities (coverage zones).
 */
export function toSlug(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
