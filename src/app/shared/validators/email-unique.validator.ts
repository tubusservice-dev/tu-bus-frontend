import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';

/**
 * Async validator that checks whether an email is already registered.
 *
 * - Debounced 400ms — avoids hitting the backend on every keystroke.
 * - Skips empty values so `Validators.required` owns emptiness.
 * - Returns `{ emailTaken: true }` only when the email exists AND is bound
 *   to a local password. Google-only accounts pass through (the auth modal
 *   detects them and routes the submit to /auth/link-account — Caso 3).
 * - Network errors fail open (no validation error) so the user can still
 *   submit and the server-side validation catches duplicates.
 */
export function emailUniqueValidator(authService: AuthService): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value;
    if (!value || typeof value !== 'string') return of(null);
    if (control.pristine) return of(null);

    return timer(400).pipe(
      switchMap(() =>
        authService.checkEmail(value).pipe(
          map((res) => {
            const data = res.data;
            if (!data?.exists) return null;
            if (data.isOAuthOnly) return null;
            return { emailTaken: true };
          }),
          catchError(() => of(null))
        )
      )
    );
  };
}
