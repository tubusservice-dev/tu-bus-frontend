import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, adminLoginGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // Rutas del admin
  {
    path: 'admin',
    children: [
      // Login del admin (sin layout)
      {
        path: 'login',
        loadComponent: () =>
          import('./features/admin/login/admin-login.component').then(
            (m) => m.AdminLoginComponent
          ),
        canActivate: [adminLoginGuard],
      },
      // Rutas protegidas con layout de admin
      {
        path: '',
        loadComponent: () =>
          import('./layouts/components/admin-layout/admin-layout.component').then(
            (m) => m.AdminLayoutComponent
          ),
        canActivate: [adminGuard],
        children: [
          // Dashboard
          {
            path: '',
            loadComponent: () =>
              import('./features/admin/dashboard/admin-dashboard.component').then(
                (m) => m.AdminDashboardComponent
              ),
          },
          // Administradores
          {
            path: 'administrators',
            loadComponent: () =>
              import('./features/admin/administrators/admin-list/admin-list.component').then(
                (m) => m.AdminListComponent
              ),
          },
          {
            path: 'administrators/create',
            loadComponent: () =>
              import('./features/admin/administrators/admin-form/admin-form.component').then(
                (m) => m.AdminFormComponent
              ),
          },
          {
            path: 'administrators/edit/:id',
            loadComponent: () =>
              import('./features/admin/administrators/admin-form/admin-form.component').then(
                (m) => m.AdminFormComponent
              ),
          },
          // Usuarios (placeholder)
          {
            path: 'users',
            loadComponent: () =>
              import('./features/admin/dashboard/admin-dashboard.component').then(
                (m) => m.AdminDashboardComponent
              ),
          },
          // Productos
          {
            path: 'products',
            loadComponent: () =>
              import('./features/admin/products/product-list/product-list.component').then(
                (m) => m.ProductListComponent
              ),
          },
          {
            path: 'products/create',
            loadComponent: () =>
              import('./features/admin/products/product-form/product-form.component').then(
                (m) => m.ProductFormComponent
              ),
          },
          {
            path: 'products/edit/:id',
            loadComponent: () =>
              import('./features/admin/products/product-form/product-form.component').then(
                (m) => m.ProductFormComponent
              ),
          },
          // Líneas
          {
            path: 'lines',
            loadComponent: () =>
              import('./features/admin/lines/line-list/line-list.component').then(
                (m) => m.LineListComponent
              ),
          },
          {
            path: 'lines/create',
            loadComponent: () =>
              import('./features/admin/lines/line-form/line-form.component').then(
                (m) => m.LineFormComponent
              ),
          },
          {
            path: 'lines/edit/:id',
            loadComponent: () =>
              import('./features/admin/lines/line-form/line-form.component').then(
                (m) => m.LineFormComponent
              ),
          },
          // Categorías
          {
            path: 'categories',
            loadComponent: () =>
              import('./features/admin/categories/category-list/category-list.component').then(
                (m) => m.CategoryListComponent
              ),
          },
          {
            path: 'categories/create',
            loadComponent: () =>
              import('./features/admin/categories/category-form/category-form.component').then(
                (m) => m.CategoryFormComponent
              ),
          },
          {
            path: 'categories/edit/:id',
            loadComponent: () =>
              import('./features/admin/categories/category-form/category-form.component').then(
                (m) => m.CategoryFormComponent
              ),
          },
          // Marcas
          {
            path: 'brands',
            loadComponent: () =>
              import('./features/admin/brands/brand-list/brand-list.component').then(
                (m) => m.BrandListComponent
              ),
          },
          {
            path: 'brands/create',
            loadComponent: () =>
              import('./features/admin/brands/brand-form/brand-form.component').then(
                (m) => m.BrandFormComponent
              ),
          },
          {
            path: 'brands/edit/:id',
            loadComponent: () =>
              import('./features/admin/brands/brand-form/brand-form.component').then(
                (m) => m.BrandFormComponent
              ),
          },
          // Agencias de Envío
          {
            path: 'shipping-agencies',
            loadComponent: () =>
              import('./features/admin/shipping-agencies/shipping-agency-list/shipping-agency-list.component').then(
                (m) => m.ShippingAgencyListComponent
              ),
          },
          {
            path: 'shipping-agencies/create',
            loadComponent: () =>
              import('./features/admin/shipping-agencies/shipping-agency-form/shipping-agency-form.component').then(
                (m) => m.ShippingAgencyFormComponent
              ),
          },
          {
            path: 'shipping-agencies/edit/:id',
            loadComponent: () =>
              import('./features/admin/shipping-agencies/shipping-agency-form/shipping-agency-form.component').then(
                (m) => m.ShippingAgencyFormComponent
              ),
          },
          // Zonas
          {
            path: 'zones',
            loadComponent: () =>
              import('./features/admin/zones/zone-list/zone-list.component').then(
                (m) => m.ZoneListComponent
              ),
          },
          {
            path: 'zones/create',
            loadComponent: () =>
              import('./features/admin/zones/zone-form/zone-form.component').then(
                (m) => m.ZoneFormComponent
              ),
          },
          {
            path: 'zones/edit/:id',
            loadComponent: () =>
              import('./features/admin/zones/zone-form/zone-form.component').then(
                (m) => m.ZoneFormComponent
              ),
          },
          // Mecanicos
          {
            path: 'mechanics',
            loadComponent: () =>
              import('./features/admin/mechanics/mechanic-list/mechanic-list.component').then(
                (m) => m.MechanicListComponent
              ),
          },
          {
            path: 'mechanics/create',
            loadComponent: () =>
              import('./features/admin/mechanics/mechanic-form/mechanic-form.component').then(
                (m) => m.MechanicFormComponent
              ),
          },
          {
            path: 'mechanics/edit/:id',
            loadComponent: () =>
              import('./features/admin/mechanics/mechanic-form/mechanic-form.component').then(
                (m) => m.MechanicFormComponent
              ),
          },
          // Ordenes (admin)
          {
            path: 'orders',
            loadComponent: () =>
              import('./features/admin/orders/order-list/admin-order-list.component').then(
                (m) => m.AdminOrderListComponent
              ),
          },
          {
            path: 'orders/:id',
            loadComponent: () =>
              import('./features/admin/orders/order-detail/admin-order-detail.component').then(
                (m) => m.AdminOrderDetailComponent
              ),
          },
          // Métodos de Pago (configuración)
          {
            path: 'payment-methods',
            redirectTo: 'settings',
            pathMatch: 'full',
          },
          {
            path: 'payment-methods/create',
            loadComponent: () =>
              import('./features/admin/payment-methods/payment-method-form/payment-method-form.component').then(
                (m) => m.PaymentMethodFormComponent
              ),
          },
          {
            path: 'payment-methods/edit/:id',
            loadComponent: () =>
              import('./features/admin/payment-methods/payment-method-form/payment-method-form.component').then(
                (m) => m.PaymentMethodFormComponent
              ),
          },
          // Configuraciones
          {
            path: 'settings',
            loadComponent: () =>
              import('./features/admin/settings/settings.component').then(
                (m) => m.SettingsComponent
              ),
          },
        ],
      },
    ],
  },
  // Landing Page / Home principal (TuBus Express)
  {
    path: '',
    loadComponent: () =>
      import('./layouts/pages/tu-bus-servicio/tu-bus-servicio.component').then(
        (m) => m.TuBusServicioComponent
      ),
    pathMatch: 'full',
  },
  // Rutas de la tienda (con MainLayout)
  {
    path: '',
    loadComponent: () =>
      import('./layouts/components/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    children: [
      {
        path: 'catalogo',
        loadComponent: () =>
          import('./features/catalog/catalog.component').then((m) => m.CatalogComponent),
      },
      {
        path: 'carrito',
        loadComponent: () =>
          import('./features/cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'checkout/despacho',
        loadComponent: () =>
          import('./features/checkout/checkout-dispatch/checkout-dispatch.component').then(
            (m) => m.CheckoutDispatchComponent
          ),
      },
      {
        path: 'checkout/agencia',
        loadComponent: () =>
          import('./features/checkout/checkout-shipping-agency/checkout-shipping-agency.component').then(
            (m) => m.CheckoutShippingAgencyComponent
          ),
      },
      {
        path: 'checkout/envio',
        loadComponent: () =>
          import('./features/checkout/checkout-shipping-form/checkout-shipping-form.component').then(
            (m) => m.CheckoutShippingFormComponent
          ),
      },
      {
        path: 'checkout/delivery',
        loadComponent: () =>
          import('./features/checkout/checkout-local-delivery-form/checkout-local-delivery-form.component').then(
            (m) => m.CheckoutLocalDeliveryFormComponent
          ),
      },
      {
        path: 'checkout/vendedor',
        loadComponent: () =>
          import('./features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component').then(
            (m) => m.CheckoutSellerAgreementFormComponent
          ),
      },
      {
        path: 'checkout/cambio-aceite',
        loadComponent: () =>
          import('./features/checkout/checkout-oil-change-form/checkout-oil-change-form.component').then(
            (m) => m.CheckoutOilChangeFormComponent
          ),
      },
      {
        path: 'checkout/resumen',
        loadComponent: () =>
          import('./features/checkout/checkout-summary/checkout-summary.component').then(
            (m) => m.CheckoutSummaryComponent
          ),
      },
      {
        path: 'checkout/confirmacion/:orderId',
        loadComponent: () =>
          import('./features/checkout/checkout-confirmation/checkout-confirmation.component').then(
            (m) => m.CheckoutConfirmationComponent
          ),
        canActivate: [authGuard],
      },
      // checkout/pago/detalles route removed - payment is now handled in the summary page
      {
        path: 'producto/:id',
        loadComponent: () =>
          import('./features/product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent
          ),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/profile/profile.component').then((m) => m.ProfileComponent),
        canActivate: [authGuard],
      },
    ],
  },
  // Callback de OAuth
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];