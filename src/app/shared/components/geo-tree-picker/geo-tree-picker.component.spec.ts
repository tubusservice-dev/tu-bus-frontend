import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeoAdminTree } from '@models/geo.model';
import { GeoTreePickerComponent } from './geo-tree-picker.component';

/**
 * A small state: Libertador has one city with two parishes (one inactive),
 * Naguanagua one parish, and Valencia two cities.
 */
const TREE: GeoAdminTree = {
  state: { id: 's', code: 'VE-G', name: 'Carabobo', slug: 'carabobo', isActive: true },
  municipalities: [
    {
      id: 'm-lib', name: 'Libertador', slug: 'libertador', aliases: [], isActive: true,
      cities: [{
        id: 'c-toc', name: 'Tocuyito', slug: 'tocuyito', isCapital: true, isActive: true,
        parishes: [
          { id: 'p-toc', name: 'Tocuyito', slug: 'tocuyito', isActive: true },
          { id: 'p-ind', name: 'Independencia', slug: 'independencia', isActive: false },
        ],
      }],
    },
    {
      id: 'm-nag', name: 'Naguanagua', slug: 'naguanagua', aliases: [], isActive: true,
      cities: [{ id: 'c-nag', name: 'Naguanagua', slug: 'naguanagua', isCapital: true, isActive: true, parishes: [{ id: 'p-nag', name: 'Naguanagua', slug: 'naguanagua', isActive: true }] }],
    },
    {
      id: 'm-val', name: 'Valencia', slug: 'valencia', aliases: [], isActive: true,
      cities: [
        { id: 'c-val', name: 'Valencia', slug: 'valencia', isCapital: true, isActive: true, parishes: [{ id: 'p-cat', name: 'Catedral', slug: 'catedral', isActive: true }] },
        { id: 'c-otr', name: 'Güigüe Norte', slug: 'guigue-norte', isCapital: false, isActive: true, parishes: [{ id: 'p-sb', name: 'San Blas', slug: 'san-blas', isActive: true }] },
      ],
    },
  ],
};

describe('GeoTreePickerComponent', () => {
  let fixture: ComponentFixture<GeoTreePickerComponent>;
  let component: GeoTreePickerComponent;
  // Protected members are exercised through the component instance, as the template does.
  let api: any;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [GeoTreePickerComponent] });
    fixture = TestBed.createComponent(GeoTreePickerComponent);
    component = fixture.componentInstance;
    api = component as any;
    fixture.componentRef.setInput('tree', TREE);
    fixture.detectChanges();
  });

  const municipality = (id: string) => TREE.municipalities.find((m) => m.id === id)!;

  it('checks every active parish of a municipality at once, skipping inactive ones', () => {
    api.toggleMunicipality(municipality('m-lib'));
    expect(component.selected()).toEqual(['p-toc']);
    expect(api.municipalityState(municipality('m-lib'))).toBe('all');
  });

  it('unchecks the municipality when all its parishes are checked', () => {
    api.toggleMunicipality(municipality('m-lib'));
    api.toggleMunicipality(municipality('m-lib'));
    expect(component.selected()).toEqual([]);
  });

  it('shows a municipality with only some parishes checked as indeterminate', () => {
    api.toggleParish('p-cat');
    expect(api.municipalityState(municipality('m-val'))).toBe('some');
    expect(api.cityState(municipality('m-val').cities[0])).toBe('all');
    expect(api.partialMunicipalities()).toEqual(['Valencia']);
  });

  it('counts parishes and cities', () => {
    api.toggleMunicipality(municipality('m-val'));
    api.toggleParish('p-nag');
    expect(api.summary()).toEqual({ parishes: 3, cities: 3 });
  });

  it('marks and clears everything', () => {
    api.selectAll(true);
    expect(component.selected().sort()).toEqual(['p-cat', 'p-nag', 'p-sb', 'p-toc']);
    api.selectAll(false);
    expect(component.selected()).toEqual([]);
  });

  it('filters by any level, ignoring accents', () => {
    api.searchTerm.set('guigue');
    expect(api.visibleMunicipalities().map((m: { id: string }) => m.id)).toEqual(['m-val']);
    api.searchTerm.set('catedral');
    const [valencia] = api.visibleMunicipalities();
    expect(valencia.cities.map((c: { id: string }) => c.id)).toEqual(['c-val']);
  });

  it('changes nothing while disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    api.toggleMunicipality(municipality('m-nag'));
    expect(component.selected()).toEqual([]);
  });
});
