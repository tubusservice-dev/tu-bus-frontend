/**
 * Convención de día-de-semana en el modelo `Branch`:
 *   0 = Lunes, 1 = Martes, …, 5 = Sábado, 6 = Domingo
 *
 * Convención del modelo `Mechanic` y de JavaScript `Date.getDay()`:
 *   0 = Domingo, 1 = Lunes, …, 5 = Viernes, 6 = Sábado
 *
 * Ambas conviven en el backend porque cada módulo definió su propio seed
 * con un orden distinto (deuda técnica). Esta utilidad tiende un puente:
 * todo el frontend trabaja con la convención de `Date.getDay()` y solo
 * se aplica `branchDayToJsDow` al consumir el `schedule` de una sucursal.
 *
 * No usar en horarios de mecánico — esos ya están en la misma convención
 * que `Date.getDay()` y no requieren conversión.
 */

/**
 * Branch `day` (0=Lunes … 6=Domingo) → JS `Date.getDay()` (0=Sunday … 6=Saturday).
 *
 *   Branch 0 (Lunes)   → JS 1 (Monday)
 *   Branch 1 (Martes)  → JS 2 (Tuesday)
 *   Branch 2 (Miércoles) → JS 3 (Wednesday)
 *   Branch 3 (Jueves)  → JS 4 (Thursday)
 *   Branch 4 (Viernes) → JS 5 (Friday)
 *   Branch 5 (Sábado)  → JS 6 (Saturday)
 *   Branch 6 (Domingo) → JS 0 (Sunday)
 */
export function branchDayToJsDow(branchDay: number): number {
  return branchDay === 6 ? 0 : branchDay + 1;
}

/**
 * Inverse: JS `Date.getDay()` → Branch `day`. Útil para localizar la
 * entrada del schedule a partir de una fecha real.
 */
export function jsDowToBranchDay(jsDow: number): number {
  return jsDow === 0 ? 6 : jsDow - 1;
}
