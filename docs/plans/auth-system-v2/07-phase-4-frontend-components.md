# Fase 4 — Componentes frontend

**Objetivo:** implementar los flujos UX de los 5 casos en Angular.

---

## 4.1. Caso 1 — Modal "completar perfil" tras OAuth

### `auth-callback.component.ts`

Tras `loadUserProfile()`:

```ts
this.authService.loadUserProfile().subscribe({
  next: () => {
    const user = this.authService.currentUser();
    if (user && !user.profileCompleted) {
      this.router.navigate(['/perfil'], { queryParams: { completeProfile: 'true' } });
      return;
    }
    const returnUrl = localStorage.getItem('oauth_return_url') || '/';
    localStorage.removeItem('oauth_return_url');
    this.router.navigateByUrl(returnUrl);
  },
  error: () => {
    this.error = 'Error al cargar el perfil. Por favor, intenta de nuevo.';
  },
});
```

### `complete-profile-modal.component.ts` (nuevo)

**Carpeta:** `frontend/src/app/shared/components/complete-profile-modal/`

- Standalone Angular component.
- Inputs: `currentUser`.
- Outputs: `closeModal`, `profileCompleted`.
- Form con: `documentType`, `documentNumber`, `phone`, `birthDate` (o `companyName` si J).
- Validaciones idénticas al register flow (reusar validators de `form-validators.ts`).
- **Dismissable**: ✕ visible, click en backdrop cierra, Esc cierra.
- Submit → `userService.updateProfile(payload)` → `authService.loadUserProfile()` para refrescar `profileCompleted`.

### `profile.component.ts`

- Detectar `?completeProfile=true` → abrir el modal automáticamente.
- Banner persistente "Completa tu perfil" mientras `profileCompleted=false`, con CTA que abre el mismo modal.

---

## 4.2. Caso 2 — Verificación email (verify-email)

### `verify-email.component.ts`

**Sin cambios estructurales.** El componente actual ya:
- Recibe token del query.
- Llama `authService.verifyEmail(token)`.
- Muestra phase `'success'` con botón.
- `goToLogin()` navega a `/` y abre auth modal en modo `'login'`.

**Verificación visual:** botón "Continuar" claro, único call-to-action en la pantalla de éxito.

---

## 4.3. Caso 3 — Vinculación de cuenta Google con password

### `auth.service.ts`

Métodos nuevos:

```ts
linkAccount(payload: LinkAccountRequest): Observable<LinkAccountResponse> {
  return this.http.post<LinkAccountResponse>(
    `${this.apiUrl}/link-account`, payload
  );
}

verifyAccountLink(token: string): Observable<AuthResponse> {
  return this.http.post<AuthResponse>(
    `${this.apiUrl}/verify-account-link`, { token }
  ).pipe(tap((response) => this.handleAuthSuccess(response)));
}

openAccountLinkModal(prefillEmail: string): void {
  this.openAuthModal('register', prefillEmail);
  this.authModalLinkAccountModeSignal.set(true);
}
```

Signal nueva `authModalLinkAccountMode: signal(false)`. El auth modal lee este flag para decidir si llamar `register` o `linkAccount`.

### `auth-modal.component.ts`

- Si `authService.authModalLinkAccountMode()` es `true`:
  - Email del step 1 se renderiza **disabled** (precargado).
  - Submit del step 2 invoca `linkAccount` en lugar de `register`.
  - Respuesta `requiresLinkVerification: true` → emite output `accountLinkPending` con `{ email, firstName }`.

### `account-link-pending-modal.component.ts` (nuevo)

**Carpeta:** `frontend/src/app/shared/components/account-link-pending-modal/`

- Similar a `verify-email-pending-modal`.
- Copy: "Te enviamos un correo para vincular tu cuenta de Google con tu nueva contraseña en TuBus Express. Revisa tu bandeja de entrada."
- Botón "Reenviar correo" → opcional (puede deferrirse a v2.1).

### `verify-account-link.component.ts` (nuevo)

**Carpeta:** `frontend/src/app/features/verify-account-link/`

- Ruta nueva `/verify-account-link`.
- Recibe `?token=` del query.
- Llama `authService.verifyAccountLink(token)`.
- Tres phases:
  - `'verifying'`: spinner.
  - `'success'`: muestra "¡Cuenta vinculada y verificada!" + botón "Continuar". Click → `returnUrl` o `/`.
  - `'invalid'`: token expirado/usado/inválido + CTA "Solicitar otro" (abre auth modal en modo register).

### `app.routes.ts`

```ts
{
  path: 'verify-account-link',
  loadComponent: () =>
    import('@features/verify-account-link/verify-account-link.component')
      .then((m) => m.VerifyAccountLinkComponent),
},
```

### `app.html` y `app.ts`

Añadir orquestación del nuevo modal:

```html
@if (showAccountLinkPendingModal()) {
  <app-account-link-pending-modal
    [email]="emailContext()"
    [firstName]="firstNameContext()"
    (closeModal)="closeAccountLinkPendingModal()"
  />
}
```

Y conectar `auth-modal` con un nuevo output `accountLinkPending`.

---

## 4.4. Caso 5 — Forgot-password con derivación a registro

### `forgot-password-modal.component.ts`

Nuevo output:

```ts
readonly accountLinkRequired = output<string>();
```

Lógica:

```ts
if (res.data.exists && res.data.requiresAccountLink) {
  this.accountLinkRequired.emit(email);
  return;
}
if (res.data.exists) {
  this.emailSent.emit(email);
} else {
  this.emailNotFound.emit(email);
}
```

### `app.html` y `app.ts`

```html
<app-forgot-password-modal
  ...
  (accountLinkRequired)="onForgotPasswordAccountLinkRequired($event)"
/>
```

```ts
onForgotPasswordAccountLinkRequired(email: string): void {
  this.showForgotPasswordModal.set(false);
  this.authService.openAccountLinkModal(email);
}
```

### `auth.model.ts`

```ts
export interface ForgotPasswordResponse {
  success: boolean;
  message?: string;
  data: {
    exists: boolean;
    requiresAccountLink?: boolean;
  };
}

export interface LinkAccountRequest extends RegisterRequest {}

export interface LinkAccountResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    requiresLinkVerification: boolean;
  };
}
```

---

## 4.5. Logout completo

### `auth.service.ts`

Refactor `logout`:

```ts
logout(): void {
  const { tokenKey, userKey } = this.getStorageKeys();
  const isAdmin = this.isAdminContext();

  // Best-effort: notify backend so JWT is server-side revoked.
  // Don't await — proceed with local cleanup regardless.
  if (!isAdmin) {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  localStorage.removeItem('oauth_return_url');
  this.currentUserSignal.set(null);
  this.router.navigate(['/']);
}
```

`prompt: 'select_account'` ya está en backend — al volver a hacer login con Google, se mostrará el selector.

---

## Validación de Fase 4

1. E2E manual de cada caso.
2. WebStorm Problems panel vacío.
3. Verificación visual: modales abren/cierran correctamente sin flicker.
