import { DeliveryTerms } from '@models/geo.model';

/**
 * Folds the delivery terms of several places (or branches) into what the
 * customer gets: delivery if any has it, free if any delivering one is free,
 * otherwise the cheapest charge. Same rule as the server's `aggregateDelivery`,
 * including its quirk that a delivering charge of 0 counts as free.
 */
export function aggregateDelivery(terms: readonly DeliveryTerms[]): DeliveryTerms {
  let hasDelivery = false;
  let freeDelivery = false;
  let minCharge = Infinity;

  for (const t of terms) {
    if (!t.hasDelivery) continue;
    hasDelivery = true;
    if (t.freeDelivery) freeDelivery = true;
    if (t.deliveryCharge < minCharge) minCharge = t.deliveryCharge;
  }

  return {
    hasDelivery,
    freeDelivery: freeDelivery || minCharge === 0,
    deliveryCharge: freeDelivery ? 0 : minCharge === Infinity ? 0 : minCharge,
  };
}
