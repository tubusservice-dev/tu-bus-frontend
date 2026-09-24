import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CheckoutLocalDeliveryFormComponent } from './checkout-local-delivery-form.component';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationStore, SelectedLocation } from '@core/services/location-store.service';
import { LocationRef, ParishDelivery } from '@models/geo.model';
import { ANALYTICS } from '@platform';

/**
 * The local-delivery form: city and parish inside the customer's
 * municipality, the parish fixing the price.
 */
describe('CheckoutLocalDeliveryFormComponent', () => {
  const NAGUANAGUA: SelectedLocation = { state: { id: 'car', name: 'Carabobo' }, municipality: { id: 'nag', name: 'Naguanagua' } };
  const IN_NAGUANAGUA: LocationRef = { ...NAGUANAGUA, city: { id: 'c', name: 'Naguanagua' }, parish: { id: 'p', name: 'Naguanagua' } };
  const ELSEWHERE: LocationRef = {
    state: { id: 'mir', name: 'Miranda' },
    municipality: { id: 'cha', name: 'Chacao' },
    city: { id: 'c2', name: 'Chacao' },
    parish: { id: 'p2', name: 'Chacao' },
  };
  const FREE: ParishDelivery = { hasDelivery: true, freeDelivery: true, deliveryCharge: 0, branchIds: ['b1'] };

  const savedInfo: LocalDeliveryRecipientInfo = {
    fullName: 'Cliente Prueba',
    documentType: 'V',
    documentNumber: '12345678',
    phone: '04221234567',
    location: IN_NAGUANAGUA,
    address: 'Calle 1, casa 2, sector centro',
  };

  let saved: LocalDeliveryRecipientInfo | null;
  let user: Record<string, unknown> | null;
  let dispatchType: string;
  let place: ReturnType<typeof signal<SelectedLocation | null>>;
  let quote: ReturnType<typeof signal<ParishDelivery | null>>;
  let deliveryStatus: ReturnType<typeof signal<string>>;
  let setInfoSpy: jasmine.Spy;
  let navigateSpy: jasmine.Spy;

  const read = (c: CheckoutLocalDeliveryFormComponent) => c as unknown as Record<string, any>;

  function create(): CheckoutLocalDeliveryFormComponent {
    const fixture = TestBed.createComponent(CheckoutLocalDeliveryFormComponent);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  }

  function fillPersonalAndAddress(component: CheckoutLocalDeliveryFormComponent): void {
    read(component)['deliveryForm'].patchValue({
      fullName: 'Cliente Prueba',
      documentNumber: '12345678',
      phone: '04221234567',
      location: IN_NAGUANAGUA,
      address: 'Calle 1, casa 2, sector centro',
    });
  }

  beforeEach(() => {
    saved = null;
    user = null;
    dispatchType = 'local_delivery';
    place = signal<SelectedLocation | null>(NAGUANAGUA);
    quote = signal<ParishDelivery | null>(null);
    deliveryStatus = signal('full');
    setInfoSpy = jasmine.createSpy('setLocalDeliveryRecipientInfo');
    navigateSpy = jasmine.createSpy('navigate');

    TestBed.configureTestingModule({
      imports: [CheckoutLocalDeliveryFormComponent],
      providers: [
        {
          provide: CheckoutService,
          useValue: {
            dispatchType: () => dispatchType,
            localDeliveryRecipientInfo: () => saved,
            setLocalDeliveryRecipientInfo: setInfoSpy,
            deliveryQuote: quote,
            setDeliveryQuote: (q: ParishDelivery | null) => quote.set(q),
          },
        },
        { provide: CartService, useValue: {} },
        { provide: AuthService, useValue: { currentUser: () => user, loadUserProfile: () => of(null) } },
        {
          provide: LocationStore,
          useValue: { location: place, hasLocation: () => place() !== null, isResolved: () => true, deliveryStatus },
        },
        { provide: Router, useValue: { navigate: navigateSpy } },
        { provide: ANALYTICS, useValue: { logEvent: () => Promise.resolve() } },
      ],
    });
    TestBed.overrideComponent(CheckoutLocalDeliveryFormComponent, { set: { template: '', imports: [] } });
  });

  it('builds the form even when it has to redirect away', () => {
    // Reloading this URL drops the in-memory checkout state: the template still
    // renders for a tick and must find a FormGroup.
    dispatchType = 'store_pickup';
    const component = create();

    expect(navigateSpy).toHaveBeenCalledWith(['/checkout/despacho']);
    expect(read(component)['deliveryForm']).toBeDefined();
    expect(() => component.hasError('fullName')).not.toThrow();
  });

  it('sends the customer back to pick a location when there is none', () => {
    place.set(null);
    create();
    expect(navigateSpy).toHaveBeenCalledWith(['/checkout/despacho']);
  });

  it('restores saved data in the same municipality, place included', () => {
    saved = savedInfo;
    const component = create();
    expect(read(component)['deliveryForm'].get('location').value).toEqual(IN_NAGUANAGUA);
  });

  it('drops a saved place from another municipality', () => {
    saved = { ...savedInfo, location: ELSEWHERE };
    const component = create();
    expect(read(component)['deliveryForm'].get('location').value).toBeNull();
    expect(read(component)['deliveryForm'].get('address').value).toBe(savedInfo.address);
  });

  it('prefills and locks the profile address only when it is in the municipality served', () => {
    user = {
      firstName: 'Ana',
      location: { state: 'car', stateName: 'Carabobo', municipality: 'nag', municipalityName: 'Naguanagua', city: 'c', cityName: 'Naguanagua', parish: 'p', parishName: 'Naguanagua' },
      street: 'Calle 5',
    };
    const component = create();
    const form = read(component)['deliveryForm'];

    expect(form.get('location').value).toEqual(IN_NAGUANAGUA);
    expect(form.get('location').disabled).toBeTrue();
    expect(form.get('address').value).toBe('Calle 5');
  });

  it('does not submit without a parish that gets delivery', () => {
    const component = create();
    fillPersonalAndAddress(component);

    component.onSubmit();
    expect(setInfoSpy).not.toHaveBeenCalled();

    read(component)['onDelivery']({ ...FREE, hasDelivery: false });
    component.onSubmit();
    expect(setInfoSpy).not.toHaveBeenCalled();
    expect(read(component)['parishWithoutDelivery']()).toBeTrue();
  });

  it('saves the place picked and moves on once the parish fixes the price', () => {
    const component = create();
    fillPersonalAndAddress(component);
    read(component)['onDelivery'](FREE);

    component.onSubmit();

    expect(setInfoSpy).toHaveBeenCalledWith(jasmine.objectContaining({ location: IN_NAGUANAGUA }));
    expect(navigateSpy).toHaveBeenCalledWith(['/checkout/resumen']);
  });

  it('forgets the place and its price when the location changes elsewhere', () => {
    const fixture = TestBed.createComponent(CheckoutLocalDeliveryFormComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();
    fillPersonalAndAddress(component);
    read(component)['onDelivery'](FREE);

    place.set({ state: { id: 'mir', name: 'Miranda' }, municipality: { id: 'cha', name: 'Chacao' } });
    fixture.detectChanges();

    expect(read(component)['deliveryForm'].get('location').value).toBeNull();
    expect(quote()).toBeNull();
  });

  it('blocks every field and the button in a municipality without delivery', () => {
    deliveryStatus.set('none');
    const fixture = TestBed.createComponent(CheckoutLocalDeliveryFormComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();
    fillPersonalAndAddress(component);
    read(component)['onDelivery'](FREE);

    expect(read(component)['noDeliveryHere']()).toBeTrue();
    expect(read(component)['deliveryForm'].disabled).toBeTrue();
    component.onSubmit();
    expect(setInfoSpy).not.toHaveBeenCalled();
  });

  it('frees the form again, keeping the profile locks, when the new municipality delivers', () => {
    user = { firstName: 'Ana', documentNumber: '12345678' };
    deliveryStatus.set('none');
    const fixture = TestBed.createComponent(CheckoutLocalDeliveryFormComponent);
    const component = fixture.componentInstance;
    component.ngOnInit();
    fixture.detectChanges();

    deliveryStatus.set('full');
    fixture.detectChanges();

    const form = read(component)['deliveryForm'];
    expect(form.get('address').enabled).toBeTrue();
    expect(form.get('fullName').disabled).toBeTrue();
    expect(form.get('documentNumber').disabled).toBeTrue();
  });
});
