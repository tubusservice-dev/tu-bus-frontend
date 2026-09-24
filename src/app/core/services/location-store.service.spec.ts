import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ANALYTICS } from '@platform';
import { GeoPlace, MunicipalityCoverage } from '@models/geo.model';
import { GeoService } from './geo.service';
import { CoverageService } from './coverage.service';
import { LocationStore } from './location-store.service';
import { BranchService } from './branch.service';

const MIRANDA = { id: 'st-mir', name: 'Miranda' };
const CHACAO = { id: 'mu-cha', name: 'Chacao' };

const coverage = (overrides: Partial<MunicipalityCoverage> = {}): MunicipalityCoverage => ({
  branches: [
    { id: 'b1', name: 'Sede', address: 'x', whatsappPhone: '0', schedule: [], hasInStoreOilChange: true },
  ],
  cities: [
    {
      id: 'c1',
      name: 'Chacao',
      parishes: [
        { id: 'p1', name: 'Chacao', hasDelivery: true, freeDelivery: false, deliveryCharge: 4 },
        { id: 'p2', name: 'Otra', hasDelivery: true, freeDelivery: false, deliveryCharge: 2 },
      ],
    },
  ],
  deliveryStatus: 'full',
  minDeliveryCharge: 2,
  allFree: false,
  ...overrides,
});

describe('LocationStore', () => {
  let geo: { legacyResolve: jasmine.Spy };
  let coverageApi: { municipality: jasmine.Spy };

  const create = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: GeoService, useValue: geo },
        { provide: CoverageService, useValue: coverageApi },
        { provide: ANALYTICS, useValue: { setUserProperty: () => Promise.resolve() } },
        { provide: BranchService, useValue: { getActive: () => of({ success: true, data: [{ id: 'b8' }, { id: 'b9' }] }) } },
      ],
    });
    return TestBed.inject(LocationStore);
  };

  beforeEach(() => {
    localStorage.clear();
    geo = { legacyResolve: jasmine.createSpy('legacyResolve') };
    coverageApi = { municipality: jasmine.createSpy('municipality').and.returnValue(of(coverage())) };
  });

  afterEach(() => localStorage.clear());

  it('starts undecided and resolved when nothing is saved', () => {
    const store = create();
    expect(store.status()).toBe('undecided');
    expect(store.isResolved()).toBeTrue();
    expect(store.hasLocation()).toBeFalse();
  });

  it('sets a location, fetches who serves it and saves it', () => {
    const store = create();
    store.setLocation(MIRANDA, CHACAO);

    expect(coverageApi.municipality).toHaveBeenCalledWith('mu-cha');
    expect(store.hasLocation()).toBeTrue();
    expect(store.locationLabel()).toBe('Chacao, Miranda');
    expect(store.branchIds()).toEqual(['b1']);
    expect(store.hasInStoreOilChange()).toBeTrue();
    expect(JSON.parse(localStorage.getItem('user_location_v2')!)).toEqual({
      status: 'selected',
      stateId: 'st-mir',
      stateName: 'Miranda',
      municipalityId: 'mu-cha',
      municipalityName: 'Chacao',
    });
  });

  it('restores a saved location on start', () => {
    localStorage.setItem(
      'user_location_v2',
      JSON.stringify({ status: 'selected', stateId: 'st-mir', stateName: 'Miranda', municipalityId: 'mu-cha', municipalityName: 'Chacao' }),
    );
    const store = create();
    expect(store.hasLocation()).toBeTrue();
    expect(coverageApi.municipality).toHaveBeenCalledWith('mu-cha');
    expect(store.hasCoverage()).toBeTrue();
  });

  it('moves a location saved by the previous version and forgets the old copy', () => {
    localStorage.setItem('user_location', JSON.stringify({ citySlug: 'caracas', municipalitySlug: 'chacao' }));
    geo.legacyResolve.and.returnValue(of({ state: { ...MIRANDA, slug: 'miranda' }, municipality: { ...CHACAO, slug: 'chacao' } }));

    const store = create();

    expect(geo.legacyResolve).toHaveBeenCalledWith('caracas', 'chacao');
    expect(store.locationLabel()).toBe('Chacao, Miranda');
    expect(localStorage.getItem('user_location')).toBeNull();
    expect(localStorage.getItem('user_location_v2')).not.toBeNull();
  });

  it('keeps the old copy for a later try when the server cannot be reached', () => {
    localStorage.setItem('user_location', JSON.stringify({ citySlug: 'caracas', municipalitySlug: 'chacao' }));
    geo.legacyResolve.and.returnValue(throwError(() => new Error('offline')));

    const store = create();

    expect(store.status()).toBe('undecided');
    expect(store.isResolved()).toBeTrue();
    expect(localStorage.getItem('user_location')).not.toBeNull();
  });

  it('stays unresolved while a location is being translated, so nothing asks too early', () => {
    localStorage.setItem('user_location', JSON.stringify({ citySlug: 'caracas', municipalitySlug: 'chacao' }));
    const answer = new Subject<{ state: GeoPlace; municipality: GeoPlace } | null>();
    geo.legacyResolve.and.returnValue(answer);

    const store = create();
    expect(store.isResolved()).toBeFalse();

    answer.next(null);
    expect(store.isResolved()).toBeTrue();
    expect(store.hasLocation()).toBeFalse();
  });

  it('ignores the answer of a choice the customer already replaced', () => {
    const late = new Subject<MunicipalityCoverage>();
    coverageApi.municipality.and.returnValues(late, of(coverage({ branches: [] })));

    const store = create();
    store.setLocation(MIRANDA, CHACAO);
    store.setLocation(MIRANDA, { id: 'mu-bar', name: 'Baruta' });
    late.next(coverage());

    expect(store.locationLabel()).toBe('Baruta, Miranda');
    expect(store.hasCoverage()).toBeFalse();
  });

  it('lets the customer browse without a location, and remembers it', () => {
    const store = create();
    store.browseWithoutLocation();

    expect(store.status()).toBe('browsing');
    expect(store.hasLocation()).toBeFalse();
    expect(store.isResolved()).toBeTrue();
    expect(JSON.parse(localStorage.getItem('user_location_v2')!)).toEqual({ status: 'browsing' });
  });

  it('uses coverage the caller already fetched instead of asking again', () => {
    const store = create();
    store.setLocation(MIRANDA, CHACAO, coverage({ deliveryStatus: 'partial' }));

    expect(coverageApi.municipality).not.toHaveBeenCalled();
    expect(store.deliveryStatus()).toBe('partial');
    expect(store.isResolved()).toBeTrue();
  });

  it('counts the stock of every active branch while exploring, and of the zone once located', () => {
    const store = create();
    store.browseWithoutLocation();
    expect(store.stockBranchIds()).toEqual(['b8', 'b9']);

    store.setLocation(MIRANDA, CHACAO);
    expect(store.stockBranchIds()).toEqual(['b1']);
  });

  it('goes from browsing to a location', () => {
    const store = create();
    store.browseWithoutLocation();
    store.setLocation(MIRANDA, CHACAO);

    expect(store.status()).toBe('selected');
    expect(store.hasCoverage()).toBeTrue();
  });
});
