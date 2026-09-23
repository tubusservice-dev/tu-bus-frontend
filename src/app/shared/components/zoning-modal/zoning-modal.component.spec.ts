import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ANALYTICS } from '@platform';
import { GeoService } from '@core/services/geo.service';
import { GeoCoverageState } from '@models/geo.model';
import { BodyScrollLockService } from '../../services/body-scroll-lock.service';
import { ZoningModalComponent, ZonePick } from './zoning-modal.component';

const TREE: GeoCoverageState[] = [
  {
    state: { id: 'car', name: 'Carabobo', slug: 'carabobo' },
    hint: 'Bejuma, Guacara',
    municipalities: [
      { id: 'val', name: 'Valencia', slug: 'valencia', deliveryStatus: 'full' },
      { id: 'mon', name: 'Montalbán', slug: 'montalban', deliveryStatus: 'partial' },
      { id: 'bej', name: 'Bejuma', slug: 'bejuma', deliveryStatus: 'none' },
    ],
  },
  { state: { id: 'mir', name: 'Miranda', slug: 'miranda' }, hint: 'Chacao', municipalities: [] },
];

@Component({
  standalone: true,
  imports: [ZoningModalComponent],
  template: `<app-zoning-modal
    [isOpen]="open()"
    [busy]="busy()"
    [allowExplore]="allowExplore()"
    (picked)="picked = $event"
    (explore)="explored = explored + 1"
    (closed)="closed = closed + 1"
  />`,
})
class HostComponent {
  open = signal(true);
  busy = signal(false);
  allowExplore = signal(true);
  picked: ZonePick | null = null;
  explored = 0;
  closed = 0;
}

describe('ZoningModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let search: jasmine.Spy;

  const el = () => fixture.nativeElement as HTMLElement;
  const buttons = (selector: string) => Array.from(el().querySelectorAll<HTMLButtonElement>(selector));
  const click = (b: HTMLElement) => {
    b.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    search = jasmine.createSpy('search').and.returnValue(
      of([{ municipality: { id: 'cha', name: 'Chacao', slug: 'chacao' }, state: TREE[1].state, matchedBy: 'municipality' }]),
    );
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: GeoService, useValue: { coverageTree: () => of(TREE), search } },
        { provide: ANALYTICS, useValue: { setScreen: () => Promise.resolve() } },
        { provide: BodyScrollLockService, useValue: { lock: () => undefined, unlock: () => undefined } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('titles itself «Elige tu ubicación» and lists the states by name only', () => {
    expect(el().querySelector('.modal-title')?.textContent).toContain('Elige tu ubicación');
    const names = buttons('app-zoning-state-step .zone-btn').map((b) => b.textContent!.trim());
    expect(names).toEqual(['Carabobo', 'Miranda']);
    expect(el().textContent).not.toContain('Bejuma, Guacara');
  });

  it('shows what each municipality gets, and reports the pick with its state', () => {
    click(buttons('app-zoning-state-step .zone-btn')[0]);

    const badges = Array.from(el().querySelectorAll('.delivery-badge')).map((b) => b.textContent!.trim());
    expect(badges).toEqual(['Delivery disponible', 'Delivery en parte del municipio', 'Solo retiro en tienda']);

    click(buttons('app-zoning-municipality-step .zone-btn')[0]);
    expect(host.picked).toEqual({
      state: TREE[0].state,
      municipality: { id: 'val', name: 'Valencia', slug: 'valencia', deliveryStatus: 'full' } as never,
    });
  });

  it('jumps straight to a municipality from the search box', fakeAsync(() => {
    const input = el().querySelector('app-search-input input') as HTMLInputElement;
    input.value = 'chac';
    input.dispatchEvent(new Event('input'));
    tick(300);
    fixture.detectChanges();

    expect(search).toHaveBeenCalledWith('chac', true);
    click(buttons('.hit-list .zone-btn')[0]);
    expect(host.picked?.municipality.name).toBe('Chacao');
    expect(host.picked?.state.name).toBe('Miranda');
  }));

  it('offers exploring without a location, unless one is already set', () => {
    click(el().querySelector('.explore__link') as HTMLButtonElement);
    expect(host.explored).toBe(1);

    host.allowExplore.set(false);
    fixture.detectChanges();
    expect(el().querySelector('.explore__link')).toBeNull();
  });

  it('closes with the ✕ and with Escape, but not while the pick is being checked', () => {
    click(el().querySelector('.close-btn') as HTMLButtonElement);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closed).toBe(2);

    host.busy.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closed).toBe(2);
    expect(el().querySelector('.resolving-overlay')).not.toBeNull();
  });
});
