# Hero Carousel — Dynamic Image Carousel for Landing Page

## Implementation Plan — 2026-03-30

### Overview

Transform the static hero image on the landing page into a dynamic, auto-cycling carousel managed from the admin settings panel. The admin can upload up to 5 images via Cloudinary, configure auto-play behavior (enable/disable + interval), and the landing page renders them with a smooth crossfade transition.

---

## Phase 1: Backend — Data Model & API

### 1.1 Extend Settings Interface

**File:** `backend/src/modules/settings/interfaces/settings.interface.ts`

- Add `IHeroImage` interface: `{ url: string; publicId: string; order: number }`
- Add `IHeroImagesConfig` interface: `{ images: IHeroImage[]; carousel: ICarouselConfig }`
- Add `heroImages: IHeroImagesConfig` to `ISettings`
- Add `UpdateHeroImagesDto`: `{ images?: IHeroImage[]; carousel?: Partial<ICarouselConfig> }`
- Update `ISettingsResponse` to include `heroImages`
- Update `DEFAULT_SETTINGS` with empty images array and default carousel config

### 1.2 Extend Mongoose Schema

**File:** `backend/src/modules/settings/models/settings.model.ts`

- Create `heroImageSchema` sub-schema: `{ url: String, publicId: String, order: Number }`
- Create `heroImagesConfigSchema`: `{ images: [heroImageSchema] (max 5), carousel: carouselConfigSchema }`
- Add `heroImages` field to main `settingsSchema`

### 1.3 Extend Settings Service

**File:** `backend/src/modules/settings/services/settings.service.ts`

- New method: `updateHeroImages(data: UpdateHeroImagesDto, adminId: string): Promise<ISettings>`
  - Validates max 5 images
  - Validates each image has `url` and `publicId`
  - Validates carousel interval if provided (1000-15000ms)
  - Uses atomic `$set` update
- Update `toResponse()` to include `heroImages` in public response

### 1.4 Extend Settings Controller

**File:** `backend/src/modules/settings/controllers/settings.controller.ts`

- New method: `updateHeroImages(req, res, next)` — extracts adminId, delegates to service

### 1.5 Extend Settings Routes

**File:** `backend/src/modules/settings/routes/settings.routes.ts`

- New route: `PUT /api/admin/settings/hero-images`
- Validation middleware with `express-validator`:
  - `images` — optional array, max length 5
  - `images.*.url` — required string URL
  - `images.*.publicId` — required string
  - `images.*.order` — required integer >= 0
  - `carousel.isEnabled` — optional boolean
  - `carousel.interval` — optional integer 1000-15000
- Protected by `authenticateAdmin` middleware

---

## Phase 2: Frontend — Model & Service

### 2.1 Extend Settings Model

**File:** `frontend/src/app/models/settings.model.ts`

- Add `HeroImage` interface: `{ url: string; publicId: string; order: number }`
- Add `HeroImagesConfig` interface: `{ images: HeroImage[]; carousel: CarouselConfig }`
- Add `heroImages: HeroImagesConfig` to `Settings` interface
- Update `DEFAULT_SETTINGS` with default values
- Add `UpdateHeroImagesDto` interface

### 2.2 Extend Settings Service

**File:** `frontend/src/app/core/services/settings.service.ts`

- New computed signal: `heroImagesConfig` — derived from `_settings`
- New method: `updateHeroImages(data: UpdateHeroImagesDto): Observable<SettingsResponse>`
  - Endpoint: `PUT ${adminUrl}/hero-images`
  - Updates local signal on success
- Update `loadSettings()` to merge `heroImages` with defaults

---

## Phase 3: Frontend — Admin Settings UI

### 3.1 Extend Settings Component TypeScript

**File:** `frontend/src/app/features/admin/settings/settings.component.ts`

- Add `'heroImages'` to `SectionKey` type
- New signals: `heroImages: signal<HeroImage[]>([])`, `isUploadingHeroImage`, `heroImageUploadError`
- Inject `UploadService`
- New `FormGroup`: `heroImagesCarouselForm` with `isEnabled` and `interval` controls
- Methods:
  - `onHeroImageSelected(event: Event)` — validate file type/size, upload to Cloudinary via `UploadService.uploadImage()`, append to `heroImages` signal
  - `removeHeroImage(index: number)` — delete from Cloudinary via `UploadService.deleteImage()`, remove from signal
  - `moveHeroImage(from: number, direction: 'up' | 'down')` — swap positions in array
  - `saveHeroImages()` — build payload from `heroImages` signal + carousel form, send via `SettingsService.updateHeroImages()`
- Populate `heroImages` signal and carousel form from `loadSettings()` response

### 3.2 Extend Settings Component Template

**File:** `frontend/src/app/features/admin/settings/settings.component.html`

- New accordion section "Imágenes del Hero" positioned as first section:
  - Section description explaining the feature
  - Image counter: "X/5 imágenes"
  - Image grid: thumbnails with:
    - Preview of uploaded image
    - Delete button (X icon) per image
    - Up/Down reorder buttons per image
    - Order number indicator
  - "+ Add Image" button (hidden when 5 images reached)
  - Hidden `<input type="file" accept="image/*">` triggered by button
  - Upload progress indicator
  - Carousel config sub-section:
    - Toggle: "Carrusel automático" (isEnabled)
    - Slider: interval 1s-15s (visible only when enabled)
    - Current interval display in seconds
  - Save button with loading/success/error states
  - Alert messages for errors and success

### 3.3 Extend Settings Component Styles

**File:** `frontend/src/app/features/admin/settings/settings.component.scss`

- Styles for hero images grid (responsive)
- Thumbnail cards with aspect-ratio
- Upload button styling
- Reorder button styling
- Image counter badge
- Upload progress indicator

---

## Phase 4: Frontend — Landing Page Hero Component

### 4.1 Refactor Hero Component TypeScript

**File:** `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-hero/tubus-hero.component.ts`

- Inject `SettingsService`
- New signals:
  - `heroImages = computed(() => settingsService.heroImagesConfig().images)` — sorted by order
  - `carouselEnabled = computed(() => settingsService.heroImagesConfig().carousel.isEnabled)`
  - `carouselInterval = computed(() => settingsService.heroImagesConfig().carousel.interval)`
  - `currentIndex = signal(0)`
  - `currentImage = computed(() => ...)` — current image URL or fallback to `assets/img/promociones.jpg`
  - `nextImage = computed(() => ...)` — preload next image for smooth transition
  - `isTransitioning = signal(false)` — controls CSS transition state
- Auto-play logic using `effect()` + `setInterval`:
  - Only starts if `carouselEnabled()` is true AND `heroImages().length > 1`
  - Cycles `currentIndex` modulo `heroImages().length`
  - Cleans up interval via `DestroyRef.onDestroy()`
  - Triggers `isTransitioning` for CSS animations
- Fallback: if `heroImages().length === 0`, display static `assets/img/promociones.jpg`

### 4.2 Refactor Hero Component Template

**File:** `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-hero/tubus-hero.component.html`

- Replace static `<img>` with dynamic carousel container:
  - Two stacked `<img>` elements for crossfade transition
  - Active image at full opacity, transitioning image fades in
  - `[src]` bound to computed signals
  - `alt` attribute dynamic
- Keep floating stats (stat-1, stat-2) unchanged — positioned relative to the image container
- Maintain existing image-wrapper structure and classes

### 4.3 Extend Hero Component Styles

**File:** `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-hero/tubus-hero.component.scss`

- Crossfade animation:
  - `.carousel-image` base class: absolute positioning, full size, opacity transition
  - `.carousel-image.active` — opacity 1, z-index 1
  - `.carousel-image.next` — opacity 0, z-index 0
  - Transition duration: ~800ms ease-in-out
- Maintain existing `.image-wrapper` styles (aspect-ratio, rounded corners, shadow)
- Ensure floating stats remain above carousel images (z-index management)

---

## Files Impacted

| # | File | Action |
|---|------|--------|
| 1 | `backend/src/modules/settings/interfaces/settings.interface.ts` | Extend interfaces + DTO + defaults |
| 2 | `backend/src/modules/settings/models/settings.model.ts` | New sub-schema for hero images |
| 3 | `backend/src/modules/settings/services/settings.service.ts` | New `updateHeroImages` method + update `toResponse` |
| 4 | `backend/src/modules/settings/controllers/settings.controller.ts` | New `updateHeroImages` handler |
| 5 | `backend/src/modules/settings/routes/settings.routes.ts` | New PUT route + validations |
| 6 | `frontend/src/app/models/settings.model.ts` | New interfaces + update defaults |
| 7 | `frontend/src/app/core/services/settings.service.ts` | New method + computed signal |
| 8 | `frontend/src/app/features/admin/settings/settings.component.ts` | New section logic (upload, reorder, save) |
| 9 | `frontend/src/app/features/admin/settings/settings.component.html` | New accordion section UI |
| 10 | `frontend/src/app/features/admin/settings/settings.component.scss` | Styles for hero images management |
| 11 | `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-hero/tubus-hero.component.ts` | Dynamic carousel logic |
| 12 | `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-hero/tubus-hero.component.html` | Dynamic image rendering |
| 13 | `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-hero/tubus-hero.component.scss` | Crossfade animations |

## Architectural Decisions

1. **Hero images stored as Cloudinary URLs in Settings document** — follows existing product image pattern
2. **Separate carousel config from existing `homeCarousel`** — SoC: each carousel has independent configuration
3. **Max 5 images** — validated on both frontend and backend
4. **Graceful fallback** — static `promociones.jpg` shown when no images configured
5. **Crossfade transition** — smoother UX than slide for a hero section
6. **Cloudinary cleanup on delete** — prevents orphaned assets
7. **No reuse of `ImageCarouselComponent`** — hero needs auto-play crossfade without navigation controls, fundamentally different from the product gallery carousel

## Constraints & Edge Cases

- Images uploaded one at a time (not batch) to provide immediate feedback
- Carousel auto-play pauses concept can be added later (hover pause)
- Mobile: hero image section is hidden (`hidden lg:block`), so carousel only renders on desktop
- If admin deletes all images while carousel is running, fallback kicks in immediately via reactive signals
- Order field ensures deterministic image sequence regardless of upload order
