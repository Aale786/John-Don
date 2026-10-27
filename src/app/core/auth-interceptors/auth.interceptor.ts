import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE } from '../api-service/api.config';
import { AuthService } from './auth.service';

/** True only for this app's API (same-origin `/api` or the configured API_BASE). */
export function isTaxseerApiRequest(url: string): boolean {
  if (url.startsWith('/api/')) {
    return true;
  }

  const prefix = API_BASE.replace(/\/$/, '');
  return prefix.length > 0 && url.startsWith(`${prefix}/api/`);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isLoginCall = req.url.includes('/api/auth/login');

  if (!token || isLoginCall || !isTaxseerApiRequest(req.url)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};
