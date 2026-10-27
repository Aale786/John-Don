import { Routes } from '@angular/router';
import { authGuard } from './core/auth-interceptors/auth.guard';
import { guestGuard } from './core/auth-interceptors/guest.guard';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'taxseer',
    },
    {
        path: 'sign-in',
        canActivate: [guestGuard],
        loadComponent: () =>
            import('./views/auth/sign-in/sign-in').then((m) => m.SignInComponent),
    },
    {
        path: 'taxseer',
        canActivate: [authGuard],
        loadChildren: () => import('./views/taxseer/routes'),
    },
    {
        path: '**',
        redirectTo: 'taxseer',
    },
];
