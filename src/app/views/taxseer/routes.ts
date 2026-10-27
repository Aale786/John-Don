import { Routes } from '@angular/router';
import { TaxseerLayout } from './layout/taxseer-layout';

export default [
    {
        path: '',
        component: TaxseerLayout,
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'dashboard',
            },
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./pages/dashboard/dashboard')
                        .then(m => m.TaxseerDashboard),
            },
            {
                path: 'filers',
                pathMatch: 'full',
                redirectTo: 'filers/1',
            },
            {
                path: 'filers/:filerId',
                loadComponent: () =>
                    import('./pages/filer-details/filer-details')
                        .then(m => m.FilerDetailsComponent),
            },
            {
                path: 'filing/new',
                pathMatch: 'full',
                redirectTo: route => {
                    const query = new URLSearchParams(
                        route.queryParams as Record<string, string>
                    ).toString();

                    return query ? `dashboard?${query}` : 'dashboard';
                },
            },
            {
                path: 'filing/feb2',
                redirectTo: 'filing/new',
                pathMatch: 'full',
            },
            {
                path: 'filing/mar31',
                redirectTo: 'filing/new',
                pathMatch: 'full',
            },
            {
                path: 'recipients',
                loadComponent: () =>
                    import('./pages/recipients/recipients')
                        .then(m => m.TaxseerRecipients),
            },
            {
                path: 'w9',
                redirectTo: 'recipients',
                pathMatch: 'full',
            },
            {
                path: 'orders',
                loadComponent: () =>
                    import('./pages/orders/orders')
                        .then(m => m.TaxseerOrders),
            },
            {
                path:'cart',
                loadComponent: () =>
                    import('./components/add-to-cart/add-to-cart')
                .then(m => m.AddToCartComponent)
            },
            {
                path: 'settings',
                loadComponent: () =>
                    import('./pages/settings/settings')
                        .then(m => m.Settings),
            },
            {
                path: '**',
                redirectTo: 'dashboard',
            },
        ],
    },
] satisfies Routes;
