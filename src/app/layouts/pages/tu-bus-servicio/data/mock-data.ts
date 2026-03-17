/**
 * Datos hardcodeados para el landing page de Tu Bus Servicio
 * Estos datos serán reemplazados por datos del backend en el futuro
 */

// Zonas de cobertura (Municipios de Caracas)
export interface Zone {
  id: string;
  name: string;
  isAvailable: boolean;
}

export const ZONES: Zone[] = [
  { id: 'chacao', name: 'Chacao', isAvailable: true },
  { id: 'baruta', name: 'Baruta', isAvailable: true },
  { id: 'sucre', name: 'Sucre', isAvailable: true },
  { id: 'libertador', name: 'Libertador', isAvailable: true },
  { id: 'other', name: 'Otra zona', isAvailable: false },
];

// Servicios
export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  price?: number;
}

export const SERVICES: Service[] = [
  {
    id: 'oil-change',
    title: 'Cambio de Aceite',
    description: 'Servicio completo de cambio de aceite con materiales de primera calidad. Incluye revisión de niveles.',
    icon: 'oil',
    price: 0, // Gratis con combo
  },
  {
    id: 'filter-change',
    title: 'Cambio de Filtros',
    description: 'Reemplazo de filtros de aceite, aire y combustible. Mejora el rendimiento de tu vehículo.',
    icon: 'filter',
  },
  {
    id: 'diagnostic',
    title: 'Diagnóstico',
    description: 'Revisión completa del estado de tu vehículo con equipo especializado.',
    icon: 'diagnostic',
  },
  {
    id: 'home-service',
    title: 'Servicio a Domicilio',
    description: 'Llevamos el taller a tu puerta. Sin filas, sin esperas, en la comodidad de tu hogar.',
    icon: 'home',
  },
];

// Combos de productos
export interface Combo {
  id: string;
  name: string;
  description: string;
  image: string;
  originalPrice: number;
  price: number;
  discount: number;
  includes: string[];
  oilType: 'mineral' | 'semi-synthetic' | 'synthetic';
  badge?: string;
}

export const COMBOS: Combo[] = [
  {
    id: 'combo-mineral',
    name: 'Combo Mineral 15W-40',
    description: 'Ideal para vehículos con alto kilometraje. Incluye mano de obra gratis.',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/oil-mineral.jpg',
    originalPrice: 45,
    price: 35,
    discount: 22,
    includes: ['Aceite Mineral 15W-40 (4L)', 'Filtro de Aceite', 'Mano de Obra Gratis'],
    oilType: 'mineral',
    badge: 'Más vendido',
  },
  {
    id: 'combo-semi',
    name: 'Combo Semi-Sintético 10W-40',
    description: 'Balance perfecto entre protección y economía. Incluye mano de obra gratis.',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/oil-semi.jpg',
    originalPrice: 60,
    price: 48,
    discount: 20,
    includes: ['Aceite Semi-Sintético 10W-40 (4L)', 'Filtro de Aceite', 'Mano de Obra Gratis'],
    oilType: 'semi-synthetic',
  },
  {
    id: 'combo-synthetic',
    name: 'Combo Sintético 5W-30',
    description: 'Máxima protección para motores modernos. Incluye mano de obra gratis.',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/oil-synthetic.jpg',
    originalPrice: 85,
    price: 70,
    discount: 18,
    includes: ['Aceite Sintético 5W-30 (4L)', 'Filtro de Aceite', 'Mano de Obra Gratis'],
    oilType: 'synthetic',
    badge: 'Premium',
  },
  {
    id: 'combo-full',
    name: 'Combo Completo',
    description: 'El paquete más completo para el mantenimiento de tu vehículo.',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/samples/ecommerce/oil-full.jpg',
    originalPrice: 120,
    price: 95,
    discount: 21,
    includes: [
      'Aceite Sintético 5W-30 (4L)',
      'Filtro de Aceite',
      'Filtro de Aire',
      'Revisión de Niveles',
      'Mano de Obra Gratis',
    ],
    oilType: 'synthetic',
    badge: 'Recomendado',
  },
];

// Marcas de aceites
export interface Brand {
  id: string;
  name: string;
  logo: string;
}

export const BRANDS: Brand[] = [
  { id: 'mobil', name: 'Mobil', logo: 'https://res.cloudinary.com/demo/image/upload/v1/brands/mobil.png' },
  { id: 'castrol', name: 'Castrol', logo: 'https://res.cloudinary.com/demo/image/upload/v1/brands/castrol.png' },
  { id: 'valvoline', name: 'Valvoline', logo: 'https://res.cloudinary.com/demo/image/upload/v1/brands/valvoline.png' },
  { id: 'shell', name: 'Shell Helix', logo: 'https://res.cloudinary.com/demo/image/upload/v1/brands/shell.png' },
  { id: 'total', name: 'Total', logo: 'https://res.cloudinary.com/demo/image/upload/v1/brands/total.png' },
  { id: 'pennzoil', name: 'Pennzoil', logo: 'https://res.cloudinary.com/demo/image/upload/v1/brands/pennzoil.png' },
];

// Beneficios
export interface Benefit {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const BENEFITS: Benefit[] = [
  {
    id: 'free-labor',
    title: 'Mano de Obra Gratis',
    description: 'Al comprar cualquier combo, la instalación es completamente gratis.',
    icon: 'gift',
  },
  {
    id: 'home-service',
    title: 'Servicio a Domicilio',
    description: 'Llevamos el taller hasta donde estés. Sin filas, sin esperas.',
    icon: 'truck',
  },
  {
    id: 'warranty',
    title: 'Garantía de Servicio',
    description: 'Todos nuestros trabajos tienen garantía. Tu satisfacción es nuestra prioridad.',
    icon: 'shield',
  },
  {
    id: 'certified',
    title: 'Técnicos Certificados',
    description: 'Personal capacitado y con experiencia en todo tipo de vehículos.',
    icon: 'badge',
  },
];

// Información de contacto
export interface ContactInfo {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  schedule: string;
}

export const CONTACT_INFO: ContactInfo = {
  phone: '+58 412-1234567',
  whatsapp: '584121234567',
  email: 'contacto@tubusservicio.com',
  address: 'Caracas, Venezuela',
  schedule: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
};

// Hero content
export interface HeroContent {
  title: string;
  titleAccent: string;
  description: string;
  ctaPrimary: string;
  ctaSecondary: string;
  badge: string;
}

export const HERO_CONTENT: HeroContent = {
  title: 'Mantenimiento Automotriz',
  titleAccent: 'a Domicilio',
  description: 'Expertos en cambio de aceite y filtros donde estés. Mano de obra gratis al comprar nuestros combos.',
  ctaPrimary: 'Ver Catalogo',
  ctaSecondary: 'Contáctanos',
  badge: 'Servicio en Caracas',
};
