import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { GeoService } from '@core/services/geo.service';
import { CoverageService } from '@core/services/coverage.service';
import { LocationRef, MunicipalityCoverage, ParishDelivery } from '@models/geo.model';
import { CascadeLevel, LocationCascadeComponent } from './location-cascade.component';

const place = (id: string, name = id) => ({ id, name, slug: id });

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, LocationCascadeComponent],
  template: `<app-location-cascade
    [formControl]="control"
    [source]="source()"
    [levels]="levels()"
    [fixed]="fixed()"
    [deliverableOnly]="deliverableOnly()"
    (deliveryChange)="delivery = $event"
    fixedNote="Para cambiarla, hazlo desde el inicio."
  />`,
})
class HostComponent {
  control = new FormControl<LocationRef | null>(null);
  source = signal<'coverage' | 'national'>('national');
  levels = signal<CascadeLevel[]>(['state', 'municipality', 'city']);
  fixed = signal<Partial<LocationRef> | null>(null);
  deliverableOnly = signal(false);
  delivery: ParishDelivery | null | undefined;
}

const MUNICIPALITY_COVERAGE: MunicipalityCoverage = {
  branches: [],
  cities: [
    {
      id: 'c-cha',
      name: 'Chacao',
      parishes: [
        { id: 'p-a', name: 'A', hasDelivery: true, freeDelivery: true, deliveryCharge: 0 },
        { id: 'p-b', name: 'B', hasDelivery: false, freeDelivery: false, deliveryCharge: 0 },
      ],
    },
  ],
  deliveryStatus: 'partial',
  minDeliveryCharge: 0,
  allFree: true,
};

describe('LocationCascadeComponent', () => {
  let geo: Record<string, jasmine.Spy>;
  let coverage: Record<string, jasmine.Spy>;

  const mount = (setup: (host: HostComponent) => void = () => undefined) => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: GeoService, useValue: geo },
        { provide: CoverageService, useValue: coverage },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    return fixture;
  };

  const selects = (fixture: ReturnType<typeof mount>) => fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
  const choose = (fixture: ReturnType<typeof mount>, index: number, value: string) => {
    const select = selects(fixture)[index];
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    geo = {
      states: jasmine.createSpy().and.returnValue(of([place('mir', 'Miranda'), place('car', 'Carabobo')])),
      municipalities: jasmine.createSpy().and.returnValue(of([place('cha', 'Chacao'), place('bar', 'Baruta')])),
      // Chacao has a single city: it is picked on its own.
      cities: jasmine.createSpy().and.returnValue(of([place('c-cha', 'Chacao')])),
      parishes: jasmine.createSpy().and.returnValue(of([])),
      coverageTree: jasmine.createSpy().and.returnValue(of([])),
    };
    coverage = {
      municipality: jasmine.createSpy().and.returnValue(of(MUNICIPALITY_COVERAGE)),
      parish: jasmine.createSpy().and.returnValue(of({ hasDelivery: true, freeDelivery: true, deliveryCharge: 0, branchIds: ['b1'] })),
    };
  });

  it('walks the national cascade and completes the value, picking a lone option by itself', () => {
    const fixture = mount();
    const host = fixture.componentInstance;

    expect(selects(fixture).length).toBe(3);
    expect(host.control.value).toBeNull();

    choose(fixture, 0, 'mir');
    expect(geo['municipalities']).toHaveBeenCalledWith('mir');
    expect(host.control.value).toBeNull();

    choose(fixture, 1, 'cha');
    expect(host.control.value).toEqual({
      state: { id: 'mir', name: 'Miranda' },
      municipality: { id: 'cha', name: 'Chacao' },
      city: { id: 'c-cha', name: 'Chacao' },
    });
  });

  it('clears the levels below when an upper one changes', () => {
    const fixture = mount();
    choose(fixture, 0, 'mir');
    choose(fixture, 1, 'cha');
    choose(fixture, 0, 'car');

    expect(fixture.componentInstance.control.value).toBeNull();
    expect(selects(fixture)[2].disabled).toBeTrue();
  });

  it('shows the fixed levels as text, with no way to change them from the form', () => {
    const fixture = mount((host) => {
      host.source.set('coverage');
      host.levels.set(['city', 'parish']);
      host.fixed.set({ state: { id: 'mir', name: 'Miranda' }, municipality: { id: 'cha', name: 'Chacao' } });
    });

    expect(fixture.nativeElement.textContent).toContain('Chacao, Miranda');
    expect(fixture.nativeElement.textContent).toContain('Para cambiarla, hazlo desde el inicio.');
    expect(fixture.nativeElement.querySelector('.cascade-fixed button')).toBeNull();
  });

  it('lists only places with delivery when asked, and emits the terms of the parish picked', () => {
    const fixture = mount((host) => {
      host.source.set('coverage');
      host.levels.set(['city', 'parish']);
      host.deliverableOnly.set(true);
      host.fixed.set({ state: { id: 'mir', name: 'Miranda' }, municipality: { id: 'cha', name: 'Chacao' } });
    });
    const host = fixture.componentInstance;

    // The only city and its only deliverable parish are picked on their own.
    expect(coverage['municipality']).toHaveBeenCalledOnceWith('cha');
    expect(host.control.value?.parish).toEqual({ id: 'p-a', name: 'A' });
    expect(coverage['parish']).toHaveBeenCalledWith('p-a');
    expect(host.delivery).toEqual({ hasDelivery: true, freeDelivery: true, deliveryCharge: 0, branchIds: ['b1'] });
  });

  it('shows a value written by the form', () => {
    const fixture = mount();
    fixture.componentInstance.control.setValue({
      state: { id: 'mir', name: 'Miranda' },
      municipality: { id: 'cha', name: 'Chacao' },
      city: { id: 'c-cha', name: 'Chacao' },
    });
    fixture.detectChanges();

    expect(Array.from(selects(fixture)).map((s) => s.value)).toEqual(['mir', 'cha', 'c-cha']);
  });

  it('follows the form when it disables the control', () => {
    const fixture = mount();
    fixture.componentInstance.control.disable();
    fixture.detectChanges();

    expect(Array.from(selects(fixture)).every((s) => s.disabled)).toBeTrue();
  });

  it('starts over when the fixed municipality changes, never keeping the old one', () => {
    const fixture = mount((host) => {
      host.source.set('coverage');
      host.levels.set(['city', 'parish']);
      host.deliverableOnly.set(true);
      host.fixed.set({ state: { id: 'car', name: 'Carabobo' }, municipality: { id: 'nag', name: 'Naguanagua' } });
    });
    const host = fixture.componentInstance;
    expect(host.control.value?.parish).toEqual({ id: 'p-a', name: 'A' });

    // The new municipality delivers nowhere: nothing can be picked.
    coverage['municipality'].and.returnValue(of({ ...MUNICIPALITY_COVERAGE, cities: [], deliveryStatus: 'none' }));
    host.fixed.set({ state: { id: 'car', name: 'Carabobo' }, municipality: { id: 'sdi', name: 'San Diego' } });
    fixture.detectChanges();

    expect(coverage['municipality']).toHaveBeenCalledWith('sdi');
    expect(host.control.value).toBeNull();
    expect(host.delivery).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('San Diego, Carabobo');
  });
});
