import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CheckoutService } from './checkout.service';
import { SettingsService } from '@core/services/settings.service';
import { CartService } from '@core/services/cart.service';
import { LocationStore } from '@core/services/location-store.service';
import { DeliveryStatus } from '@models/geo.model';

/**
 * Dispatch options and delivery price with ubicaciones v2: zone-bound
 * options show without a location (to be discovered), and local delivery is
 * priced by the parish picked in the delivery form.
 */
describe('CheckoutService — dispatch options and delivery price', () => {
  const located = signal(true);
  const hasCoverage = signal(true);
  const deliveryStatus = signal<DeliveryStatus>('full');
  const allFree = signal(true);
  const minDeliveryCharge = signal<number | null>(0);
  const hasOilChange = signal(false);
  let service: CheckoutService;

  const ids = () => service.dispatchOptions().map((o) => o.id);
  const option = (id: string) => service.dispatchOptions().find((o) => o.id === id);

  beforeEach(() => {
    located.set(true);
    hasCoverage.set(true);
    deliveryStatus.set('full');
    allFree.set(true);
    minDeliveryCharge.set(0);
    hasOilChange.set(false);

    TestBed.configureTestingModule({
      providers: [
        CheckoutService,
        {
          provide: SettingsService,
          useValue: {
            dispatchConfig: () => ({
              modules: { storePickup: true, shippingAgency: true, sellerAgreement: false, localDelivery: false },
              storePickup: { address: 'Calle 1', schedule: '8am-6pm' },
            }),
          },
        },
        { provide: CartService, useValue: { hasOilChangeService: hasOilChange } },
        {
          provide: LocationStore,
          useValue: {
            hasLocation: located,
            hasCoverage,
            hasInStoreOilChange: () => true,
            deliveryStatus,
            allFree,
            minDeliveryCharge,
          },
        },
      ],
    });
    service = TestBed.inject(CheckoutService);
  });

  it('shows the zone-bound options without a location, asking for one', () => {
    located.set(false);
    hasCoverage.set(false);
    hasOilChange.set(true);

    expect(ids()).toEqual(['oil_change_service', 'in_store_oil_change', 'store_pickup', 'local_delivery', 'shipping_agency']);
    for (const id of ['oil_change_service', 'in_store_oil_change', 'local_delivery']) {
      expect(option(id)?.requiresLocation).withContext(id).toBeTrue();
      expect(option(id)?.description).withContext(id).toBe('Elige tu ubicación para ver si llegamos a tu zona');
    }
    expect(option('store_pickup')?.requiresLocation).toBeFalsy();
  });

  it('hides local delivery where no parish of the municipality gets it', () => {
    deliveryStatus.set('none');
    expect(ids()).not.toContain('local_delivery');
  });

  it('advertises the cheapest parish when delivery is not free everywhere', () => {
    allFree.set(false);
    minDeliveryCharge.set(3);
    expect(option('local_delivery')?.description).toBe('Entrega a domicilio en tu zona (desde $3.00)');
    expect(option('local_delivery')?.price).toBeNull();
  });

  it('prices local delivery by the parish picked, and only once one is', () => {
    service.selectDispatchType('local_delivery');
    expect(service.getShippingCost()).toBeNull();

    service.setDeliveryQuote({ hasDelivery: true, freeDelivery: false, deliveryCharge: 4, branchIds: ['b1'] });
    expect(service.getShippingCost()).toBe(4);
    expect(service.getShippingCostLabel()).toBe('+$4.00');

    service.setDeliveryQuote({ hasDelivery: true, freeDelivery: true, deliveryCharge: 0, branchIds: ['b1'] });
    expect(service.getShippingCost()).toBe(0);
    expect(service.getShippingCostLabel()).toBe('Delivery gratis');
  });

  it('forgets the parish price when another way of dispatch is chosen', () => {
    service.selectDispatchType('local_delivery');
    service.setDeliveryQuote({ hasDelivery: true, freeDelivery: false, deliveryCharge: 4, branchIds: ['b1'] });
    service.selectDispatchType('store_pickup');

    expect(service.deliveryQuote()).toBeNull();
  });
});
