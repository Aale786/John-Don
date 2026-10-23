import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaxseerTopNav } from './taxseer-top-nav';

@Component({
    selector: 'taxseer-layout',
    standalone: true,
    imports: [
        RouterOutlet,
        TaxseerTopNav,
    ],
    templateUrl: './taxseer-layout.html',
    styleUrl: './taxseer-layout.scss',
})
export class TaxseerLayout {}