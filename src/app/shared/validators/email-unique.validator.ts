import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';

/**
 * Async validator that checks whether an email is already registered.
 *
 * - Debounced 400ms — avoids hitting the backend on every keystroke.
 * - Skips empty values so `Validators.required` owns emptiness.
 * - Returns `{ emailTaken: true }` when the email exists, otherwise null.
 * - Network errors fail open (no validation error) so the user can still submit
 *   and the server-side validation catches duplicates.
 */
export function emailUniqueValidator(authService: AuthService): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = control.value;
    if (!value || typeof value !== 'string') return of(null);
    if (control.pristine) return of(null);

    return timer(400).pipe(
      switchMap(() =>
        authService.checkEmail(value).pipe(
          map((res) => (res.data?.exists ? { emailTaken: true } : null)),
          catchError(() => of(null))
        )
      )
    );
  };
}
