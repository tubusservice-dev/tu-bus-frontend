import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BranchProductService } from './branch-product.service';
import { CartItem, CartService } from './cart.service';
import { CartReviewService } from './cart-review.service';

const item = (id: string): CartItem => ({ id, name: id, price: 1, quantity: 1, image: '', stock: 5 });
const stock = (totalStock: number) => of({ success: true, data: { totalStock, bestBranch: null, byBranch: [] } });

describe('CartReviewService', () => {
  let items: ReturnType<typeof signal<CartItem[]>>;
  let getAggregatedStock: jasmine.Spy;
  let removeItem: jasmine.Spy;
  let service: CartReviewService;

  beforeEach(() => {
    items = signal<CartItem[]>([]);
    getAggregatedStock = jasmine.createSpy('getAggregatedStock');
    removeItem = jasmine.createSpy('removeItem');
    TestBed.configureTestingModule({
      providers: [
        { provide: CartService, useValue: { items, removeItem } },
        { provide: BranchProductService, useValue: { getAggregatedStock } },
      ],
    });
    service = TestBed.inject(CartReviewService);
  });

  const review = (branchIds: string[]) => {
    let result: CartItem[] | undefined;
    service.review(branchIds).subscribe((r) => (result = r.unavailable));
    return result!;
  };

  it('lists only the items the new branches do not carry', () => {
    items.set([item('a'), item('b')]);
    getAggregatedStock.and.callFake((id: string) => stock(id === 'a' ? 0 : 3));

    expect(review(['b1']).map((i) => i.id)).toEqual(['a']);
    expect(getAggregatedStock).toHaveBeenCalledWith('a', ['b1']);
  });

  it('keeps an item whose stock could not be checked', () => {
    items.set([item('a')]);
    getAggregatedStock.and.returnValue(throwError(() => new Error('offline')));

    expect(review(['b1'])).toEqual([]);
  });

  it('lists every item when the new place has no branch', () => {
    items.set([item('a'), item('b')]);

    expect(review([]).length).toBe(2);
    expect(getAggregatedStock).not.toHaveBeenCalled();
  });

  it('has nothing to say about an empty cart', () => {
    expect(review(['b1'])).toEqual([]);
  });

  it('removes just the listed items', () => {
    service.removeUnavailable([item('a')]);
    expect(removeItem).toHaveBeenCalledOnceWith('a');
  });
});
