import { Injectable, computed, signal, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  stock: number;
  freeOilChangeService?: boolean;
  /**
   * Aggregated vehicleTypes from the product's categories (e.g. ['carro','all']).
   * Used during checkout to warn when the user's selected vehicle(s) do not
   * match the product. Absent for legacy items — treated as compatible.
   */
  vehicleTypes?: string[];
}

export interface AddToCartResult {
  success: boolean;
  error?: 'not_authenticated' | 'stock_exceeded' | 'out_of_stock';
  message?: string;
  currentQuantity?: number;
  maxStock?: number;
}

const CART_STORAGE_KEY = 'shopping_cart';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);

  /** Trackea el estado previo de autenticación para detectar logout */
  private wasAuthenticated = false;

  /** Items del carrito */
  private readonly _items = signal<CartItem[]>(this.loadFromStorage());

  /** Signal público de solo lectura */
  readonly items = this._items.asReadonly();

  /** Cantidad total de items */
  readonly totalItems = computed(() =>
    this._items().reduce((total, item) => total + item.quantity, 0)
  );

  /** Subtotal del carrito */
  readonly subtotal = computed(() =>
    this._items().reduce((total, item) => total + item.price * item.quantity, 0)
  );

  /** Verificar si el carrito está vacío */
  readonly isEmpty = computed(() => this._items().length === 0);

  /** Verificar si algún item tiene servicio de cambio de aceite gratis */
  readonly hasOilChangeService = computed(() =>
    this._items().some(item => item.freeOilChangeService === true)
  );

  constructor() {
    // Inicializar el estado de autenticación
    this.wasAuthenticated = this.authService.isAuthenticated();

    // Effect que detecta cuando el usuario se desconecta y limpia el carrito
    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();

      // Si antes estaba autenticado y ahora no lo está → logout
      if (this.wasAuthenticated && !isAuthenticated) {
        console.log('[CartService] Usuario desconectado - limpiando carrito');
        this._items.set([]);
        localStorage.removeItem(CART_STORAGE_KEY);
      }

      // Actualizar el estado para la próxima comparación
      this.wasAuthenticated = isAuthenticated;
    });
  }

  /**
   * Returns true when at least one cart item is missing the `vehicleTypes`
   * field — indicating it was persisted before that metadata existed. Used by
   * checkout pages to decide whether to re-hydrate from the backend.
   */
  readonly hasStaleMetadata = computed(() =>
    this._items().some((i) => i.vehicleTypes === undefined)
  );

  /**
   * Updates `vehicleTypes` (and optional `freeOilChangeService`) on existing
   * cart items from a product-id → metadata map. Used to back-fill data on
   * items persisted before these fields existed. Does not create new items.
   */
  syncItemMetadata(
    metadataById: Map<string, { vehicleTypes?: string[]; freeOilChangeService?: boolean }>
  ): void {
    if (metadataById.size === 0) return;

    this._items.update((items) => {
      let changed = false;
      const next = items.map((item) => {
        const meta = metadataById.get(item.id);
        if (!meta) return item;

        const updated: CartItem = { ...item };
        if (meta.vehicleTypes !== undefined && item.vehicleTypes === undefined) {
          updated.vehicleTypes = meta.vehicleTypes;
          changed = true;
        }
        if (
          meta.freeOilChangeService !== undefined &&
          item.freeOilChangeService === undefined
        ) {
          updated.freeOilChangeService = meta.freeOilChangeService;
          changed = true;
        }
        return updated;
      });

      if (changed) this.saveToStorage(next);
      return next;
    });
  }

  /**
   * Cargar carrito desde localStorage
   * Filtra items sin stock válido (items viejos antes de la implementación)
   */
  private loadFromStorage(): CartItem[] {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (!stored) return [];

      const items: CartItem[] = JSON.parse(stored);
      // Filtrar y normalizar items
      return items
        .filter(item => {
          // Si el item no tiene stock definido o válido, lo removemos
          if (item.stock === undefined || item.stock === null) {
            console.log('[CartService] Filtering out item without stock:', item.id);
            return false;
          }
          if (typeof item.stock !== 'number' || isNaN(item.stock)) {
            console.log('[CartService] Filtering out item with invalid stock:', item.id, item.stock);
            return false;
          }
          return true;
        })
        .map(item => ({
          ...item,
          // Asegurar que stock sea un número válido
          stock: Math.max(0, Math.floor(item.stock))
        }));
    } catch {
      return [];
    }
  }

  /**
   * Guardar carrito en localStorage
   */
  private saveToStorage(items: CartItem[]): void {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isUserAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  /**
   * Obtener la cantidad de un producto en el carrito
   */
  getItemQuantity(productId: string): number {
    const item = this._items().find((i) => i.id === productId);
    return item?.quantity || 0;
  }

  /**
   * Verificar si se puede agregar más de un producto
   */
  canAddMore(productId: string, stock: number, quantityToAdd: number = 1): boolean {
    const currentQuantity = this.getItemQuantity(productId);
    const validStock = typeof stock === 'number' && !isNaN(stock) ? stock : 0;
    return currentQuantity + quantityToAdd <= validStock;
  }

  /**
   * Obtener la cantidad disponible para agregar
   */
  getAvailableToAdd(productId: string, stock: number): number {
    const currentQuantity = this.getItemQuantity(productId);
    const validStock = typeof stock === 'number' && !isNaN(stock) ? stock : 0;
    return Math.max(0, validStock - currentQuantity);
  }

  /**
   * Agregar item al carrito con validación de stock
   */
  addItem(item: Omit<CartItem, 'quantity'>, quantity: number = 1): AddToCartResult {
    // Validar y normalizar el stock
    const validStock = typeof item.stock === 'number' && !isNaN(item.stock) ? item.stock : 0;

    console.log('[CartService] addItem called:', {
      itemId: item.id,
      itemName: item.name,
      rawStock: item.stock,
      validatedStock: validStock,
      quantityToAdd: quantity
    });

    if (!this.isUserAuthenticated()) {
      return {
        success: false,
        error: 'not_authenticated',
        message: 'Debes iniciar sesión para agregar productos al carrito',
      };
    }

    // Validar stock
    if (validStock <= 0) {
      return {
        success: false,
        error: 'out_of_stock',
        message: 'Este producto está agotado',
      };
    }

    const currentQuantity = this.getItemQuantity(item.id);
    const newTotalQuantity = currentQuantity + quantity;

    if (newTotalQuantity > validStock) {
      return {
        success: false,
        error: 'stock_exceeded',
        message: `Solo hay ${validStock} unidades disponibles. Ya tienes ${currentQuantity} en el carrito.`,
        currentQuantity,
        maxStock: validStock,
      };
    }

    this._items.update((items) => {
      const existingItem = items.find((i) => i.id === item.id);
      let newItems: CartItem[];

      if (existingItem) {
        newItems = items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                quantity: i.quantity + quantity,
                stock: validStock,
                // Re-hydrate metadata that newer backend responses may include
                // even when the item was already in the cart. Critical for
                // legacy items persisted before these fields existed.
                vehicleTypes: item.vehicleTypes ?? i.vehicleTypes,
                freeOilChangeService: item.freeOilChangeService ?? i.freeOilChangeService,
              }
            : i
        );
      } else {
        newItems = [...items, { ...item, stock: validStock, quantity }];
      }

      this.saveToStorage(newItems);
      return newItems;
    });

    return {
      success: true,
      currentQuantity: newTotalQuantity,
      maxStock: validStock,
    };
  }

  /**
   * Remover item del carrito
   */
  removeItem(itemId: string): void {
    this._items.update((items) => {
      const newItems = items.filter((item) => item.id !== itemId);
      this.saveToStorage(newItems);
      return newItems;
    });
  }

  /**
   * Actualizar cantidad de un item con validación de stock
   * @returns true si se actualizó, false si excede el stock
   */
  updateQuantity(itemId: string, quantity: number): boolean {
    if (quantity <= 0) {
      this.removeItem(itemId);
      return true;
    }

    const item = this._items().find((i) => i.id === itemId);
    if (!item) return false;

    // Validar que stock sea un número válido
    const stock = typeof item.stock === 'number' && !isNaN(item.stock) ? item.stock : 0;

    // Validar stock
    if (quantity > stock) {
      return false;
    }

    this._items.update((items) => {
      const newItems = items.map((i) =>
        i.id === itemId ? { ...i, quantity } : i
      );
      this.saveToStorage(newItems);
      return newItems;
    });

    return true;
  }

  /**
   * Incrementar cantidad con validación de stock
   * @returns true si se incrementó, false si excede el stock
   */
  incrementQuantity(itemId: string): boolean {
    const item = this._items().find((i) => i.id === itemId);
    if (!item) {
      console.log('[CartService] Item not found:', itemId);
      return false;
    }

    // Validar que stock sea un número válido
    const stock = typeof item.stock === 'number' && !isNaN(item.stock) ? item.stock : 0;

    console.log('[CartService] Increment check:', {
      itemId,
      currentQuantity: item.quantity,
      rawStock: item.stock,
      validatedStock: stock,
      canIncrement: item.quantity < stock
    });

    // Validar stock - debe ser estrictamente menor
    if (item.quantity >= stock) {
      console.log('[CartService] Cannot increment - at max stock');
      return false;
    }

    this._items.update((items) => {
      const newItems = items.map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i
      );
      this.saveToStorage(newItems);
      return newItems;
    });

    return true;
  }

  /**
   * Verificar si un item puede incrementarse (reactivo)
   * Se recalcula automáticamente cuando cambian los items
   */
  canIncrementItem(itemId: string): boolean {
    // Acceder al signal para crear dependencia reactiva
    const items = this._items();
    const item = items.find((i) => i.id === itemId);
    if (!item) return false;
    // Validar que stock sea un número válido
    const stock = typeof item.stock === 'number' && !isNaN(item.stock) ? item.stock : 0;
    return item.quantity < stock;
  }

  /**
   * Obtener item por ID (reactivo)
   */
  getItem(itemId: string): CartItem | undefined {
    return this._items().find((i) => i.id === itemId);
  }

  /**
   * Decrementar cantidad
   */
  decrementQuantity(itemId: string): void {
    const item = this._items().find((i) => i.id === itemId);
    if (item && item.quantity > 1) {
      this._items.update((items) => {
        const newItems = items.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
        this.saveToStorage(newItems);
        return newItems;
      });
    } else {
      this.removeItem(itemId);
    }
  }

  /**
   * Vaciar carrito
   */
  clearCart(): void {
    this._items.set([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }

  /**
   * Generar mensaje de WhatsApp con formato de factura
   */
  generateWhatsAppMessage(): string {
    const user = this.authService.currentUser();
    const items = this._items();
    const subtotal = this.subtotal();

    let message = `🧾 *PEDIDO - TuBus Express*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Datos del cliente
    message += `👤 *DATOS DEL CLIENTE*\n`;
    message += `Nombre: ${user?.firstName || ''} ${user?.lastName || ''}\n`;
    if (user?.email) {
      message += `Email: ${user.email}\n`;
    }
    message += `\n`;

    // Detalle de productos
    message += `📦 *DETALLE DEL PEDIDO*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    items.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      message += `\n${index + 1}. ${item.name}\n`;
      message += `   Cant: ${item.quantity} x $${item.price.toFixed(2)}\n`;
      message += `   Subtotal: $${itemTotal.toFixed(2)}\n`;
    });

    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *TOTAL: $${subtotal.toFixed(2)}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    message += `📅 Fecha: ${new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}\n\n`;

    message += `_Gracias por tu compra!_ 🙏`;

    return message;
  }

  /**
   * Abrir WhatsApp con el pedido
   */
  openWhatsAppCheckout(): void {
    const whatsappConfig = this.settingsService.whatsappConfig();

    // Verificar si WhatsApp está habilitado
    if (!whatsappConfig.isEnabled) {
      console.warn('WhatsApp checkout está deshabilitado');
      return;
    }

    const message = this.generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = whatsappConfig.phoneNumber;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }

  /**
   * Verificar si WhatsApp checkout está habilitado
   */
  isWhatsAppEnabled(): boolean {
    return this.settingsService.whatsappConfig().isEnabled;
  }
}
