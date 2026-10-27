import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let friendlyMessage = 'An unexpected error occurred. Please try again.';
      const isLoginCall = req.url.includes('/api/auth/login');

      if (error.status === 0) {
        friendlyMessage =
          'Cannot reach the server. Make sure the backend is running on localhost:8080.';
        console.error('[ErrorInterceptor] Network error:', error.message);
      } else if (error.status === 401) {
        friendlyMessage = isLoginCall
          ? 'Invalid email or password.'
          : 'Session expired. Please log in again.';
        if (!isLoginCall) {
          auth.logout();
          void router.navigate(['/sign-in']);
        }
      } else if (error.status === 403) {
        friendlyMessage = 'You do not have permission to perform this action.';
        console.warn('[ErrorInterceptor] 403 Forbidden:', req.url);
      } else if (error.status === 404) {
        friendlyMessage = 'The requested resource was not found.';
      } else if (error.status === 409) {
        friendlyMessage =
          error.error?.message ?? 'A record with these details already exists.';
      } else if (error.status >= 500) {
        friendlyMessage =
          error.error?.message ?? 'A server error occurred. Please try again later.';
        console.error('[ErrorInterceptor] Server error:', error.status, req.url);
      }

      const enriched = new HttpErrorResponse({
        error: { ...error.error, friendlyMessage },
        headers: error.headers,
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
      });

      return throwError(() => enriched);
    })
  );
};
