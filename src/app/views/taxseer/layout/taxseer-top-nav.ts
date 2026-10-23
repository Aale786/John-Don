import { Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
    RouterLink,
    RouterLinkActive,
} from '@angular/router';

@Component({
    selector: 'taxseer-top-nav',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        MatIconModule,
    ],
    templateUrl: './taxseer-top-nav.html',
    styleUrl: './taxseer-top-nav.scss',
})
export class TaxseerTopNav {
    readonly navOpen = signal(false);

    toggleNav(): void {
        this.navOpen.update(open => !open);
    }

    closeNav(): void {
        this.navOpen.set(false);
    }
}