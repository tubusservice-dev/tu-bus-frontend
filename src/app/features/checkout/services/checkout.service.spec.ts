import { TestBed } from '@angular/core/testing';
import { CheckoutService } from './checkout.service';
import { SettingsService } from '../../../core/services/settings.service';
import { CartService } from '../../../core/services/cart.service';
import { LocationService } from '../../../core/services/location.service';
import { Vehicle } from '../../../models/vehicle.model';

// ============================================
// MOCKS
// ============================================

const mockVehicle = (id: string, placa: string): Vehicle => ({
  id,
  user: 'user-1',
  placa,
  marca: 'Toyota',
  modelo: 'Corolla',
  year: 2020,
  kilometraje: 50000,
  engineType: {
    fuelType: 'gasolina',
    displacement: '2.0L',
    cylinders: 4,
    oilCapacityLiters: 4.5,
  },
  isActive: true,
  createdAt: new Date(),
});

const mockSettingsService = {
  dispatchConfig: () => ({
    modules: {
      storePickup: true,
      shippingAgency: true,
      sellerAgreement: true,
    },
    storePickup: { address: 'Calle 1', schedule: '8am-6pm' },
  }),
};

const mockCartService = {
  hasOilChangeService: () => false,
};

const mockLocationService = {
  hasCoverage: () => true,
  hasDelivery: () => true,
  hasInStoreOilChange: () => false,
  deliveryConfig: () => ({ freeDelivery: true, deliveryCharge: 0 }),
  branches: () => [
    { id: 'b-1', name: 'Sucursal A', address: 'Dir A', whatsappPhone: '0412', hasInStoreOilChange: false, schedule: [] },
    { id: 'b-2', name: 'Sucursal B', address: 'Dir B', whatsappPhone: '0414', hasInStoreOilChange: true, schedule: [] },
  ],
  branchesWithOilChange: () => [
    { id: 'b-2', name: 'Sucursal B', address: 'Dir B', whatsappPhone: '0414', hasInStoreOilChange: true, schedule: [] },
  ],
};

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CheckoutService,
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: CartService, useValue: mockCartService },
        { provide: LocationService, useValue: mockLocationService },
      ],
    });
    service = TestBed.inject(CheckoutService);
  });

  afterEach(() => {
    service.resetCheckout();
  });

  // ==================== MULTI-VEHICLE ====================

  describe('Multi-vehicle selection', () => {
    it('should start with empty selectedVehicles', () => {
      expect(service.selectedVehicles()).toEqual([]);
      expect(service.hasVehicle()).toBeFalse();
    });

    it('should add a vehicle via addVehicle()', () => {
      const v1 = mockVehicle('v-1', 'ABC123');
      service.addVehicle(v1);

      expect(service.selectedVehicles()).toHaveSize(1);
      expect(service.selectedVehicles()[0].id).toBe('v-1');
      expect(service.hasVehicle()).toBeTrue();
    });

    it('should not add duplicate vehicle', () => {
      const v1 = mockVehicle('v-1', 'ABC123');
      service.addVehicle(v1);
      service.addVehicle(v1);

      expect(service.selectedVehicles()).toHaveSize(1);
    });

    it('should add multiple different vehicles', () => {
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.addVehicle(mockVehicle('v-2', 'XYZ789'));

      expect(service.selectedVehicles()).toHaveSize(2);
    });

    it('should remove a vehicle by ID', () => {
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.addVehicle(mockVehicle('v-2', 'XYZ789'));
      service.removeVehicle('v-1');

      expect(service.selectedVehicles()).toHaveSize(1);
      expect(service.selectedVehicles()[0].id).toBe('v-2');
    });

    it('should toggle vehicle (add if not present, remove if present)', () => {
      const v1 = mockVehicle('v-1', 'ABC123');
      service.toggleVehicle(v1); // add
      expect(service.selectedVehicles()).toHaveSize(1);

      service.toggleVehicle(v1); // remove
      expect(service.selectedVehicles()).toHaveSize(0);
    });

    it('should clear all vehicles', () => {
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.addVehicle(mockVehicle('v-2', 'XYZ789'));
      service.clearVehicles();

      expect(service.selectedVehicles()).toEqual([]);
    });

    it('deprecated selectVehicle() should set single vehicle', () => {
      const v1 = mockVehicle('v-1', 'ABC123');
      service.selectVehicle(v1);

      expect(service.selectedVehicles()).toHaveSize(1);
      expect(service.selectedVehicle()).toEqual(v1); // deprecated compat
    });

    it('deprecated clearVehicle() should clear all', () => {
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.clearVehicle();

      expect(service.selectedVehicles()).toEqual([]);
    });
  });

  // ==================== DISPATCH TYPE & BRANCH ====================

  describe('Dispatch type selection', () => {
    it('should preserve branch for ALL dispatch types', () => {
      const branch = { id: 'b-1', name: 'Sucursal A', address: 'Dir A', whatsappPhone: '0412', hasInStoreOilChange: false, schedule: [] };
      service.selectBranch(branch);
      expect(service.selectedBranch()).toEqual(branch);

      // Switch to local_delivery — branch should be preserved
      service.selectDispatchType('local_delivery');
      expect(service.selectedBranch()).toEqual(branch);

      // Switch to shipping_agency — branch should still be preserved
      service.selectDispatchType('shipping_agency');
      expect(service.selectedBranch()).toEqual(branch);

      // Switch to seller_agreement — still preserved
      service.selectDispatchType('seller_agreement');
      expect(service.selectedBranch()).toEqual(branch);
    });

    it('should clear vehicles when switching away from oil change types', () => {
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.selectDispatchType('oil_change_service');
      expect(service.selectedVehicles()).toHaveSize(1); // preserved

      service.selectDispatchType('store_pickup');
      expect(service.selectedVehicles()).toHaveSize(0); // cleared
    });

    it('should preserve vehicles when switching between oil change types', () => {
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.selectDispatchType('oil_change_service');
      expect(service.selectedVehicles()).toHaveSize(1);

      service.selectDispatchType('in_store_oil_change');
      expect(service.selectedVehicles()).toHaveSize(1); // preserved
    });
  });

  // ==================== BILLING ADDRESS ====================

  describe('Billing address', () => {
    it('should start with null billing address', () => {
      expect(service.billingAddress()).toBeNull();
    });

    it('should set billing address from shipping source', () => {
      service.setBillingAddress({
        source: 'shipping',
        fullName: 'Juan Perez',
        address: 'Av Principal',
        city: 'Caracas',
      });

      const ba = service.billingAddress();
      expect(ba).toBeTruthy();
      expect(ba!.source).toBe('shipping');
      expect(ba!.fullName).toBe('Juan Perez');
    });

    it('should set billing address from profile source', () => {
      service.setBillingAddress({
        source: 'profile',
        fullName: 'Maria Lopez',
        address: 'Calle 5',
        city: 'Valencia',
      });

      expect(service.billingAddress()!.source).toBe('profile');
    });

    it('should set billing address from custom source', () => {
      service.setBillingAddress({
        source: 'custom',
        fullName: 'Custom Name',
        documentType: 'V',
        documentNumber: '12345678',
        address: 'New Address',
        city: 'Maracaibo',
        state: 'Zulia',
      });

      const ba = service.billingAddress();
      expect(ba!.source).toBe('custom');
      expect(ba!.documentNumber).toBe('12345678');
    });
  });

  // ==================== RESET ====================

  describe('Reset', () => {
    it('should clear all state on resetCheckout()', () => {
      service.selectDispatchType('store_pickup');
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.selectBranch({ id: 'b-1', name: 'S', address: 'A', whatsappPhone: '0', hasInStoreOilChange: false, schedule: [] });
      service.setBillingAddress({ source: 'profile', address: 'X', city: 'Y' });

      service.resetCheckout();

      expect(service.dispatchType()).toBeNull();
      expect(service.selectedVehicles()).toEqual([]);
      expect(service.selectedBranch()).toBeNull();
      expect(service.billingAddress()).toBeNull();
    });

    it('should clear all state on clearDispatchType()', () => {
      service.selectDispatchType('oil_change_service');
      service.addVehicle(mockVehicle('v-1', 'ABC123'));
      service.selectBranch({ id: 'b-1', name: 'S', address: 'A', whatsappPhone: '0', hasInStoreOilChange: false, schedule: [] });

      service.clearDispatchType();

      expect(service.dispatchType()).toBeNull();
      expect(service.selectedVehicles()).toEqual([]);
      expect(service.selectedBranch()).toBeNull();
    });
  });
});
