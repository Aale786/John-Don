import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'taxseer',
    },
    {
        path: 'taxseer',
        loadChildren: () => import('./views/taxseer/routes'),
    },
    {
        path: '**',
        redirectTo: 'taxseer',
    },
];

