import { aggregateDelivery } from './delivery-terms.util';

const t = (hasDelivery: boolean, freeDelivery: boolean, deliveryCharge: number) => ({ hasDelivery, freeDelivery, deliveryCharge });

describe('aggregateDelivery', () => {
  it('delivers if any place does, free if any delivering place is free', () => {
    expect(aggregateDelivery([t(false, true, 0), t(true, false, 5), t(true, true, 3)])).toEqual(t(true, true, 0));
  });

  it('otherwise charges the cheapest delivering place', () => {
    expect(aggregateDelivery([t(true, false, 5), t(true, false, 3), t(false, false, 1)])).toEqual(t(true, false, 3));
  });

  it('counts a delivering charge of 0 as free, like the server', () => {
    expect(aggregateDelivery([t(true, false, 0)])).toEqual(t(true, true, 0));
  });

  it('gives no delivery when nothing delivers', () => {
    expect(aggregateDelivery([])).toEqual(t(false, false, 0));
    expect(aggregateDelivery([t(false, true, 0)])).toEqual(t(false, false, 0));
  });
});
