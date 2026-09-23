import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { GeoPlace, MunicipalityCoverage } from '@models/geo.model';
import { CoverageService } from './coverage.service';
import { CartReviewService } from './cart-review.service';
import { CartItem } from './cart.service';
import { LocationStore } from './location-store.service';

type Place = Pick<GeoPlace, 'id' | 'name'>;

/** A location the customer picked, checked against the cart but not applied yet. */
export interface LocationChangePlan {
  state: Place;
  municipality: Place;
  coverage: MunicipalityCoverage;
  /** Cart items the branches of the new place do not carry. */
  unavailable: CartItem[];
}

/**
 * Changing location in two steps, so the customer can be asked first: work
 * out what the new place means for the cart, then apply it. Only the items
 * the new branches lack leave the cart; nothing is emptied blindly.
 */
@Injectable({ providedIn: 'root' })
export class LocationChangeService {
  private readonly coverageApi = inject(CoverageService);
  private readonly cartReview = inject(CartReviewService);
  private readonly store = inject(LocationStore);

  prepare(state: Place, municipality: Place): Observable<LocationChangePlan> {
    return this.coverageApi.municipality(municipality.id).pipe(
      switchMap((coverage) =>
        this.cartReview.review(coverage.branches.map((b) => b.id)).pipe(
          map(({ unavailable }) => ({ state, municipality, coverage, unavailable })),
        ),
      ),
    );
  }

  apply(plan: LocationChangePlan): void {
    this.cartReview.removeUnavailable(plan.unavailable);
    this.store.setLocation(plan.state, plan.municipality, plan.coverage);
  }
}
