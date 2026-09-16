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

  /** Shape of the public `/branch-zones/coverage` route. */
  const coverageResponse = {
    data: {
      cities: [{ slug: carabobo.slug, name: carabobo.name }],
      municipalities: [
        { slug: 'valencia', name: 'Valencia', citySlug: 'carabobo', hasDelivery: true },
        { slug: 'carlos-arvelo', name: 'Carlos Arvelo', citySlug: 'carabobo', hasDelivery: true },
        { slug: 'san-diego', name: 'San Diego', citySlug: 'carabobo', hasDelivery: false },
      ],
    },
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
  let branchZoneMock: { getCoverage: jasmine.Spy; getByBranch: jasmine.Spy };
  let dispatchType: string;
  let navigateSpy: jasmine.Spy;

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
    dispatchType = 'local_delivery';
    navigateSpy = jasmine.createSpy('navigate');
    setInfoSpy = jasmine.createSpy('setLocalDeliveryRecipientInfo');
    branchZoneMock = {
      getCoverage: jasmine.createSpy('getCoverage').and.returnValue(zones$),
      // Present so the test below can assert it is never called.
      getByBranch: jasmine.createSpy('getByBranch').and.returnValue(zones$),
    };

    TestBed.configureTestingModule({
      imports: [CheckoutLocalDeliveryFormComponent],
      providers: [
        {
          provide: CheckoutService,
          useValue: {
            dispatchType: () => dispatchType,
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
        { provide: BranchZoneService, useValue: branchZoneMock },
        { provide: Router, useValue: { navigate: navigateSpy } },
        { provide: ANALYTICS, useValue: { logEvent: () => Promise.resolve() } },
      ],
    });
    TestBed.overrideComponent(CheckoutLocalDeliveryFormComponent, {
      set: { template: '', imports: [] },
    });
  });

  function emitZones(): void {
    zones$.next(coverageResponse);
    zones$.complete();
  }

  it('builds the form even when it has to redirect away', () => {
    // Reloading this URL drops the in-memory checkout state, so the component
    // redirects. The template still renders for a tick and calls hasError(),
    // which threw on an undefined FormGroup and filled the console with
    // TypeErrors in front of the customer.
    dispatchType = 'store_pickup';

    const component = create();

    expect(navigateSpy).toHaveBeenCalledWith(['/checkout/despacho']);
    expect(read(component)['deliveryForm']).toBeDefined();
    expect(() => component.hasError('fullName')).not.toThrow();
    // Nothing else should run on the way out.
    expect(branchZoneMock.getCoverage).not.toHaveBeenCalled();
  });

  it('loads coverage from the public route, never from the admin-only one', () => {
    // The admin route rejects customers with a 403, which blanked both
    // dropdowns and made local delivery impossible to complete. Asking for
    // coverage the wrong way must fail here, not in production.
    create();

    expect(branchZoneMock.getCoverage).toHaveBeenCalledOnceWith(['branch-1']);
    expect(branchZoneMock.getByBranch).not.toHaveBeenCalled();
  });

  it('offers only municipalities with delivery', () => {
    const component = create();
    emitZones();

    const slugs = read(component)['allMunicipalities']().map((m: { slug: string }) => m.slug);
    expect(slugs).toEqual(['valencia', 'carlos-arvelo']);
    expect(slugs).not.toContain('san-diego');
  });

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
