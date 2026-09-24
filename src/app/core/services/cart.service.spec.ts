import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EXTERNAL_LINK, ANALYTICS } from '@platform';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';
import { CartItem, CartService } from './cart.service';

const STORAGE_KEY = 'shopping_cart';
const item = (id: string, price: number, quantity = 1): CartItem => ({ id, name: id, price, quantity, image: '', stock: 5 });

describe('CartService.applyCurrentPrices', () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([item('a', 10, 2), item('b', 5)]));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
        { provide: SettingsService, useValue: {} },
        { provide: EXTERNAL_LINK, useValue: {} },
        { provide: ANALYTICS, useValue: { logEvent: () => Promise.resolve() } },
      ],
    });
    service = TestBed.inject(CartService);
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('updates the price, the subtotal and the saved cart', () => {
    const changed = service.applyCurrentPrices(new Map([['a', 12]]));

    expect(changed).toBeTrue();
    expect(service.items().find((i) => i.id === 'a')!.price).toBe(12);
    expect(service.subtotal()).toBe(12 * 2 + 5);
    const saved: CartItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.find((i) => i.id === 'a')!.price).toBe(12);
  });

  it('keeps the price of products the catalogue did not answer for', () => {
    service.applyCurrentPrices(new Map([['a', 12]]));

    expect(service.items().find((i) => i.id === 'b')!.price).toBe(5);
  });

  it('reports no change when every price is already current', () => {
    const before = service.items();

    expect(service.applyCurrentPrices(new Map([['a', 10], ['b', 5]]))).toBeFalse();
    expect(service.items()).toBe(before);
  });
});
