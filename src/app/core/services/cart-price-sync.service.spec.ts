import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { CartItem, CartService } from './cart.service';
import { ProductService } from './product.service';
import { CartPriceSyncService } from './cart-price-sync.service';
import { ProductCurrentPrice } from '@models/product.model';

const item = (id: string, price: number): CartItem => ({ id, name: id, price, quantity: 1, image: '', stock: 5 });

describe('CartPriceSyncService', () => {
  let items: ReturnType<typeof signal<CartItem[]>>;
  let applyCurrentPrices: jasmine.Spy;
  let getPrices: jasmine.Spy;
  let service: CartPriceSyncService;

  beforeEach(() => {
    items = signal<CartItem[]>([]);
    applyCurrentPrices = jasmine.createSpy('applyCurrentPrices');
    getPrices = jasmine.createSpy('getPrices');
    TestBed.configureTestingModule({
      providers: [
        { provide: CartService, useValue: { items, applyCurrentPrices } },
        { provide: ProductService, useValue: { getPrices } },
      ],
    });
    service = TestBed.inject(CartPriceSyncService);
  });

  const applied = (): Map<string, number> => applyCurrentPrices.calls.mostRecent().args[0];

  it('applies the current catalogue prices to the cart', async () => {
    items.set([item('a', 10), item('b', 5)]);
    getPrices.and.returnValue(of([{ id: 'a', price: 12, isActive: true }, { id: 'b', price: 5, isActive: true }]));

    await service.sync();

    expect(getPrices).toHaveBeenCalledWith(['a', 'b']);
    expect(applied().get('a')).toBe(12);
    expect(applied().get('b')).toBe(5);
  });

  it('does nothing for an empty cart', async () => {
    await service.sync();

    expect(getPrices).not.toHaveBeenCalled();
  });

  it('never changes prices while the customer is paying', async () => {
    items.set([item('a', 10)]);
    service.setLocked(true);

    await service.sync();

    expect(getPrices).not.toHaveBeenCalled();
    expect(applyCurrentPrices).not.toHaveBeenCalled();
  });

  it('drops an answer that arrives after the customer started paying', async () => {
    items.set([item('a', 10)]);
    const answer = new Subject<ProductCurrentPrice[]>();
    getPrices.and.returnValue(answer);

    const pending = service.sync();
    service.setLocked(true);
    answer.next([{ id: 'a', price: 12, isActive: true }]);
    answer.complete();
    await pending;

    expect(applyCurrentPrices).not.toHaveBeenCalled();
  });

  it('refreshes again once the customer leaves the payment step', async () => {
    items.set([item('a', 10)]);
    getPrices.and.returnValue(of([{ id: 'a', price: 12, isActive: true }]));
    service.setLocked(true);
    service.setLocked(false);

    await service.sync();

    expect(applied().get('a')).toBe(12);
  });

  it('keeps the cart as it is when the prices cannot be fetched', async () => {
    items.set([item('a', 10)]);
    getPrices.and.returnValue(throwError(() => new Error('offline')));

    await expectAsync(service.sync()).toBeResolved();
    expect(applyCurrentPrices).not.toHaveBeenCalled();
  });

  it('asks once per product even if it appears twice', async () => {
    items.set([item('a', 10), item('a', 10)]);
    getPrices.and.returnValue(of([]));

    await service.sync();

    expect(getPrices).toHaveBeenCalledWith(['a']);
  });
});
