import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MunicipalityCoverage } from '@models/geo.model';
import { CoverageService } from './coverage.service';
import { CartReviewService } from './cart-review.service';
import { CartItem } from './cart.service';
import { LocationStore } from './location-store.service';
import { LocationChangePlan, LocationChangeService } from './location-change.service';

const COVERAGE: MunicipalityCoverage = {
  branches: [{ id: 'b1', name: 'Sede', address: '', whatsappPhone: '', schedule: [], hasInStoreOilChange: false }],
  cities: [],
  deliveryStatus: 'full',
  minDeliveryCharge: 0,
  allFree: true,
};
const ITEM: CartItem = { id: 'p1', name: 'Aceite', price: 1, quantity: 1, image: '', stock: 1 };
const MIRANDA = { id: 'mir', name: 'Miranda' };
const CHACAO = { id: 'cha', name: 'Chacao' };

describe('LocationChangeService', () => {
  let review: jasmine.Spy;
  let removeUnavailable: jasmine.Spy;
  let setLocation: jasmine.Spy;
  let service: LocationChangeService;

  beforeEach(() => {
    review = jasmine.createSpy('review').and.returnValue(of({ unavailable: [ITEM] }));
    removeUnavailable = jasmine.createSpy('removeUnavailable');
    setLocation = jasmine.createSpy('setLocation');
    TestBed.configureTestingModule({
      providers: [
        { provide: CoverageService, useValue: { municipality: () => of(COVERAGE) } },
        { provide: CartReviewService, useValue: { review, removeUnavailable } },
        { provide: LocationStore, useValue: { setLocation } },
      ],
    });
    service = TestBed.inject(LocationChangeService);
  });

  it('checks the cart against the branches of the new place before changing anything', () => {
    let plan: LocationChangePlan | undefined;
    service.prepare(MIRANDA, CHACAO).subscribe((p) => (plan = p));

    expect(review).toHaveBeenCalledWith(['b1']);
    expect(plan!.unavailable).toEqual([ITEM]);
    expect(setLocation).not.toHaveBeenCalled();
    expect(removeUnavailable).not.toHaveBeenCalled();
  });

  it('applies a plan: removes only what is unavailable and sets the place with its coverage', () => {
    service.apply({ state: MIRANDA, municipality: CHACAO, coverage: COVERAGE, unavailable: [ITEM] });

    expect(removeUnavailable).toHaveBeenCalledWith([ITEM]);
    expect(setLocation).toHaveBeenCalledWith(MIRANDA, CHACAO, COVERAGE);
  });
});
