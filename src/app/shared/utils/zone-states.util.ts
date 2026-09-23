/**
 * The states a zone covers, as the panel names it: "Distrito Capital + Miranda".
 * Metropolitan areas cross state lines, so a zone may have several.
 */
export function zoneStateLabel(stateIds: readonly string[] | undefined, stateNames: ReadonlyMap<string, string>): string {
  const names = (stateIds ?? []).flatMap((id) => {
    const name = stateNames.get(id);
    return name ? [name] : [];
  });
  return names.length ? names.join(' + ') : 'Sin parroquias';
}
