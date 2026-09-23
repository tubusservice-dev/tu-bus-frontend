import { CityDeliveryConfig, GeoAdminTree, NEW_CITY_TERMS } from '@models/geo.model';
import { alignCityConfig, zoneCities } from './city-config.util';

const TREE: GeoAdminTree = {
  state: { id: 's', code: 'VE-G', name: 'Carabobo', slug: 'carabobo', isActive: true },
  municipalities: [
    {
      id: 'm-lib', name: 'Libertador', slug: 'libertador', aliases: [], isActive: true,
      cities: [{
        id: 'c-toc', name: 'Tocuyito', slug: 'tocuyito', isCapital: true, isActive: true,
        parishes: [
          { id: 'p-toc', name: 'Tocuyito', slug: 'tocuyito', isActive: true },
          { id: 'p-ind', name: 'Independencia', slug: 'independencia', isActive: true },
        ],
      }],
    },
    {
      id: 'm-nag', name: 'Naguanagua', slug: 'naguanagua', aliases: [], isActive: true,
      cities: [{ id: 'c-nag', name: 'Naguanagua', slug: 'naguanagua', isCapital: true, isActive: true, parishes: [{ id: 'p-nag', name: 'Naguanagua', slug: 'naguanagua', isActive: true }] }],
    },
  ],
};

describe('city-config util', () => {
  it('lists only the cities with parishes in the zone, with those parishes', () => {
    const cities = zoneCities([TREE], ['p-ind']);
    expect(cities.map((c) => c.city.id)).toEqual(['c-toc']);
    expect(cities[0].parishes).toEqual([{ id: 'p-ind', name: 'Independencia' }]);
    expect(cities[0].municipalityName).toBe('Libertador');
  });

  it('gives a new city free delivery and keeps existing terms', () => {
    const current: CityDeliveryConfig[] = [{ city: 'c-toc', hasDelivery: true, freeDelivery: false, deliveryCharge: 4, parishOverrides: [] }];
    expect(alignCityConfig([TREE], current, ['p-toc', 'p-nag'])).toEqual([
      current[0],
      { city: 'c-nag', ...NEW_CITY_TERMS, parishOverrides: [] },
    ]);
  });

  it('covers every state of a zone that spans several, such as metropolitan Caracas', () => {
    const miranda: GeoAdminTree = {
      state: { id: 'mir', code: 'VE-M', name: 'Miranda', slug: 'miranda', isActive: true },
      municipalities: [
        {
          id: 'm-cha', name: 'Chacao', slug: 'chacao', aliases: [], isActive: true,
          cities: [{ id: 'c-cha', name: 'Chacao', slug: 'chacao', isCapital: true, isActive: true, parishes: [{ id: 'p-cha', name: 'Chacao', slug: 'chacao', isActive: true }] }],
        },
      ],
    };
    const cities = zoneCities([TREE, miranda], ['p-nag', 'p-cha']);
    expect(cities.map((c) => [c.city.id, c.stateName])).toEqual([
      ['c-nag', 'Carabobo'],
      ['c-cha', 'Miranda'],
    ]);
    expect(alignCityConfig([TREE, miranda], [], ['p-nag', 'p-cha']).map((c) => c.city)).toEqual(['c-nag', 'c-cha']);
  });

  it('drops cities and exceptions no longer in the zone', () => {
    const current: CityDeliveryConfig[] = [
      { city: 'c-toc', hasDelivery: true, freeDelivery: true, deliveryCharge: 0, parishOverrides: [{ parish: 'p-ind', hasDelivery: false, freeDelivery: false, deliveryCharge: 0 }] },
      { city: 'c-nag', hasDelivery: true, freeDelivery: true, deliveryCharge: 0, parishOverrides: [] },
    ];
    expect(alignCityConfig([TREE], current, ['p-toc'])).toEqual([
      { city: 'c-toc', hasDelivery: true, freeDelivery: true, deliveryCharge: 0, parishOverrides: [] },
    ]);
  });
});
