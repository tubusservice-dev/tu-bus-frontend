import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Response types para operaciones admin
 */
export interface CityResponse {
  success: boolean;
  data: City;
  message?: string;
}

export interface CityListResponse {
  success: boolean;
  data: City[];
}

export interface CreateCityDto {
  code: string;
  name: string;
  isActive?: boolean;
}

export interface UpdateCityDto {
  code?: string;
  name?: string;
  isActive?: boolean;
}

export interface CreateMunicipalityDto {
  code: string;
  name: string;
  isActive?: boolean;
}

export interface UpdateMunicipalityDto {
  code?: string;
  name?: string;
  isActive?: boolean;
}

/**
 * Interface para Municipio
 */
export interface Municipality {
  code: string;
  name: string;
  isActive: boolean;
}

export interface DeliveryConfig {
  freeDelivery: boolean;
  additionalCharge: boolean;
  additionalChargeAmount: number;
}

/**
 * Interface para Ciudad
 */
export interface City {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  deliveryConfig?: DeliveryConfig;
  municipalities: Municipality[];
}

/**
 * Zona seleccionada (ciudad + municipio)
 */
export interface SelectedZone {
  city: City;
  municipality: Municipality;
}

const ZONE_STORAGE_KEY = 'tubus_selected_zone';

@Injectable({
  providedIn: 'root'
})
export class ZoneService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/zones`;
  private readonly adminUrl = `${environment.apiUrl}/zones/admin`;

  // Signals
  private readonly _cities = signal<City[]>([]);
  private readonly _selectedCity = signal<City | null>(null);
  private readonly _selectedMunicipality = signal<Municipality | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Computed signals públicos
  readonly cities = this._cities.asReadonly();
  readonly selectedCity = this._selectedCity.asReadonly();
  readonly selectedMunicipality = this._selectedMunicipality.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly activeCities = computed(() =>
    this._cities().filter(c => c.isActive)
  );

  readonly inactiveCities = computed(() =>
    this._cities().filter(c => !c.isActive)
  );

  readonly availableMunicipalities = computed(() => {
    const city = this._selectedCity();
    if (!city) return [];
    return city.municipalities.filter(m => m.isActive);
  });

  readonly hasSelection = computed(() =>
    this._selectedCity() !== null && this._selectedMunicipality() !== null
  );

  readonly selectedZone = computed<SelectedZone | null>(() => {
    const city = this._selectedCity();
    const municipality = this._selectedMunicipality();
    if (!city || !municipality) return null;
    return { city, municipality };
  });

  readonly isInCoverage = computed(() => {
    const city = this._selectedCity();
    return city?.isActive ?? false;
  });

  constructor() {
    this.loadSavedZone();
  }

  /**
   * Cargar ciudades desde el API
   */
  loadCities(): Observable<City[]> {
    this._isLoading.set(true);
    this._error.set(null);

    return this.http.get<City[]>(this.apiUrl).pipe(
      tap(cities => {
        this._cities.set(cities);
        this._isLoading.set(false);
        // Restaurar selección si existe
        this.restoreSelectionIfExists();
      }),
      catchError(error => {
        console.error('Error loading cities:', error);
        this._error.set('Error al cargar las ciudades');
        this._isLoading.set(false);
        // Cargar datos de fallback
        this.loadFallbackData();
        return of([]);
      })
    );
  }

  /**
   * Seleccionar una ciudad
   */
  selectCity(city: City): void {
    this._selectedCity.set(city);
    this._selectedMunicipality.set(null); // Reset municipio
    this.saveToStorage();
  }

  /**
   * Seleccionar un municipio
   */
  selectMunicipality(municipality: Municipality): void {
    this._selectedMunicipality.set(municipality);
    this.saveToStorage();
  }

  /**
   * Limpiar selección
   */
  clearSelection(): void {
    this._selectedCity.set(null);
    this._selectedMunicipality.set(null);
    localStorage.removeItem(ZONE_STORAGE_KEY);
  }

  /**
   * Cargar zona guardada desde localStorage
   */
  private loadSavedZone(): void {
    const saved = localStorage.getItem(ZONE_STORAGE_KEY);
    if (saved) {
      try {
        JSON.parse(saved);
        // La selección se restaurará cuando se carguen las ciudades
      } catch {
        localStorage.removeItem(ZONE_STORAGE_KEY);
      }
    }
  }

  /**
   * Restaurar selección si las ciudades están cargadas
   */
  private restoreSelectionIfExists(): void {
    const saved = localStorage.getItem(ZONE_STORAGE_KEY);
    if (!saved) return;

    try {
      const zone = JSON.parse(saved);
      const city = this._cities().find(c => c.code === zone.cityCode);
      if (city) {
        this._selectedCity.set(city);
        const municipality = city.municipalities.find(m => m.code === zone.municipalityCode);
        if (municipality) {
          this._selectedMunicipality.set(municipality);
        }
      }
    } catch {
      localStorage.removeItem(ZONE_STORAGE_KEY);
    }
  }

  /**
   * Guardar selección en localStorage
   */
  private saveToStorage(): void {
    const city = this._selectedCity();
    const municipality = this._selectedMunicipality();

    if (city && municipality) {
      localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify({
        cityCode: city.code,
        municipalityCode: municipality.code
      }));
    }
  }

  // ==================== MÉTODOS ADMIN ====================

  /**
   * Obtener todas las ciudades (admin - incluye inactivas)
   */
  getAllAdmin(): Observable<City[]> {
    return this.http.get<City[]>(this.apiUrl);
  }

  /**
   * Obtener ciudad por ID (admin)
   */
  getById(id: string): Observable<City> {
    return this.http.get<City>(`${this.apiUrl}/id/${id}`);
  }

  /**
   * Crear ciudad (admin)
   */
  create(data: CreateCityDto): Observable<City> {
    return this.http.post<City>(this.adminUrl, data);
  }

  /**
   * Actualizar ciudad (admin)
   */
  update(id: string, data: UpdateCityDto): Observable<City> {
    return this.http.put<City>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Eliminar ciudad (admin)
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }

  /**
   * Agregar municipio a una ciudad (admin)
   */
  addMunicipality(cityId: string, data: CreateMunicipalityDto): Observable<City> {
    return this.http.post<City>(`${this.adminUrl}/${cityId}/municipalities`, data);
  }

  /**
   * Actualizar municipio de una ciudad (admin)
   */
  updateMunicipality(cityId: string, code: string, data: UpdateMunicipalityDto): Observable<City> {
    return this.http.put<City>(`${this.adminUrl}/${cityId}/municipalities/${code}`, data);
  }

  /**
   * Eliminar municipio de una ciudad (admin)
   */
  removeMunicipality(cityId: string, code: string): Observable<City> {
    return this.http.delete<City>(`${this.adminUrl}/${cityId}/municipalities/${code}`);
  }

  /**
   * Datos de fallback si el API falla
   */
  private loadFallbackData(): void {
    const fallbackCities: City[] = [
      {
        id: '1',
        code: 'CCS',
        name: 'Caracas',
        isActive: true,
        municipalities: [
          { code: 'CHA', name: 'Chacao', isActive: true },
          { code: 'BAR', name: 'Baruta', isActive: true },
          { code: 'SUC', name: 'Sucre', isActive: true },
          { code: 'LIB', name: 'Libertador', isActive: true },
          { code: 'HAT', name: 'El Hatillo', isActive: true },
        ],
      },
      {
        id: '2',
        code: 'VLC',
        name: 'Valencia',
        isActive: false,
        municipalities: [
          { code: 'VAL', name: 'Valencia', isActive: true },
          { code: 'NAG', name: 'Naguanagua', isActive: true },
        ],
      },
      {
        id: '3',
        code: 'MRC',
        name: 'Maracay',
        isActive: false,
        municipalities: [
          { code: 'GIR', name: 'Girardot', isActive: true },
        ],
      },
      {
        id: '4',
        code: 'MBO',
        name: 'Maracaibo',
        isActive: false,
        municipalities: [
          { code: 'MBO', name: 'Maracaibo', isActive: true },
        ],
      },
      {
        id: '5',
        code: 'BQT',
        name: 'Barquisimeto',
        isActive: false,
        municipalities: [
          { code: 'IRI', name: 'Iribarren', isActive: true },
        ],
      },
    ];

    this._cities.set(fallbackCities);
    this.restoreSelectionIfExists();
  }
}
