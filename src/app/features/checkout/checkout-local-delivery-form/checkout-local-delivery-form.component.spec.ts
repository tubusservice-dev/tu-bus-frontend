import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CheckoutLocalDeliveryFormComponent } from './checkout-local-delivery-form.component';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationService } from '@core/services/location.service';
import { BranchZoneService } from '@core/services/branch-zone.service';
import { ANALYTICS } from '@platform';

/**
 * Covers the checkout local-delivery form regressions:
 *  - saved data restored before coverage loaded left the municipality empty;
 *  - profile prefill compared static names with seeded slugs and never matched;
 *  - submitting an out-of-coverage selection failed silently.
 */
describe('CheckoutLocalDeliveryFormComponent', () => {
  const carabobo = {
    slug: 'carabobo',
    name: 'Carabobo',
    municipalities: [
      { name: 'Valencia', slug: 'valencia' },
      { name: 'Carlos Arvelo', slug: 'carlos-arvelo' },
      { name: 'San Diego', slug: 'san-diego' },
    ],
  };

  const branchZonesResponse = {
    data: [
      {
        zone: { city: carabobo },
        deliveryConfig: [
          { municipality: 'valencia', hasDelivery: true },
          { municipality: 'carlos-arvelo', hasDelivery: true },
          { municipality: 'san-diego', hasDelivery: false },
        ],
      },
    ],
  };

  const savedInfo: LocalDeliveryRecipientInfo = {
    fullName: 'Cliente Prueba',
    documentType: 'V',
    documentNumber: '12345678',
    phone: '04221234567',
    cityCode: 'carabobo',
    cityName: 'Carabobo',
    municipalityCode: 'carlos-arvelo',
    municipalityName: 'Carlos Arvelo',
    address: 'Calle 1, casa 2, sector centro',
  };

  let zones$: Subject<unknown>;
  let saved: LocalDeliveryRecipientInfo | null;
  let user: Record<string, unknown> | null;
  let setInfoSpy: jasmine.Spy;

  function create(): CheckoutLocalDeliveryFormComponent {
    const fixture = TestBed.createComponent(CheckoutLocalDeliveryFormComponent);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  }

  // Protected members are read through an index signature in tests.
  const read = (c: CheckoutLocalDeliveryFormComponent) => c as unknown as Record<string, any>;

  beforeEach(() => {
    zones$ = new Subject();
    saved = null;
    user = null;
    setInfoSpy = jasmine.createSpy('setLocalDeliveryRecipientInfo');

    TestBed.configureTestingModule({
      imports: [CheckoutLocalDeliveryFormComponent],
      providers: [
        {
          provide: CheckoutService,
          useValue: {
            dispatchType: () => 'local_delivery',
            localDeliveryRecipientInfo: () => saved,
            setLocalDeliveryRecipientInfo: setInfoSpy,
          },
        },
        { provide: CartService, useValue: {} },
        {
          provide: AuthService,
          useValue: { currentUser: () => user, loadUserProfile: () => of(null) },
        },
        { provide: LocationService, useValue: { branches: signal([{ id: 'branch-1' }]) } },
        { provide: BranchZoneService, useValue: { getByBranch: () => zones$ } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ANALYTICS, useValue: { logEvent: () => Promise.resolve() } },
      ],
    });
    TestBed.overrideComponent(CheckoutLocalDeliveryFormComponent, {
      set: { template: '', imports: [] },
    });
  });

  function emitZones(): void {
    zones$.next(branchZonesResponse);
    zones$.complete();
  }

  it('restores saved data only after coverage loads, keeping the saved municipality', () => {
    saved = savedInfo;
    const component = create();
    const c = read(component);

    // Coverage still loading: nothing restored yet, so nothing can be wiped.
    expect(c['deliveryForm'].get('municipalityCode').value).toBe('');

    emitZones();

    expect(c['availableMunicipalities']().map((m: { code: string }) => m.code)).toEqual([
      'valencia',
      'carlos-arvelo',
    ]);
    expect(c['deliveryForm'].get('cityCode').value).toBe('carabobo');
    expect(c['deliveryForm'].get('municipalityCode').value).toBe('carlos-arvelo');
  });

  it('submits restored data instead of failing silently', () => {
    saved = savedInfo;
    const component = create();
    emitZones();

    component.onSubmit();

    expect(setInfoSpy).toHaveBeenCalledTimes(1);
    expect(setInfoSpy.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ cityCode: 'carabobo', municipalityCode: 'carlos-arvelo' }),
    );
  });

  it('prefills the address from a profile that stores static names instead of slugs', async () => {
    user = {
      firstName: 'Cliente',
      lastName: 'Prueba',
      stateName: 'Carabobo',
      cityCode: 'Guigue',
      cityName: 'Guigue',
      municipalityCode: 'Carlos Arvelo',
      street: 'Calle 5',
      houseNumber: '10',
    };
    const component = create();
    emitZones();
    await Promise.resolve(); // loadUserProfile resolves synchronously via of()

    const form = read(component)['deliveryForm'];
    expect(form.get('cityCode').value).toBe('carabobo');
    expect(form.get('municipalityCode').value).toBe('carlos-arvelo');
    expect(form.get('address').value).toBe('Calle 5, 10');
  });

  it('does not prefill a municipality without delivery coverage', () => {
    user = { stateName: 'Carabobo', cityCode: 'Valencia', municipalityCode: 'San Diego' };
    const component = create();
    emitZones();

    expect(read(component)['deliveryForm'].get('municipalityCode').value).toBe('');
  });

  it('flags the field when the selection is out of coverage instead of doing nothing', () => {
    saved = { ...savedInfo, municipalityCode: 'naguanagua', municipalityName: 'Naguanagua' };
    const component = create();
    emitZones();

    component.onSubmit();

    const control = read(component)['deliveryForm'].get('municipalityCode');
    expect(setInfoSpy).not.toHaveBeenCalled();
    expect(control.touched).toBeTrue();
    expect(control.hasError('required')).toBeTrue();
  });

  it('still restores personal data when coverage fails to load', () => {
    saved = savedInfo;
    const component = create();

    zones$.error(new Error('network'));

    expect(read(component)['deliveryForm'].get('fullName').value).toBe('Cliente Prueba');
  });
});
