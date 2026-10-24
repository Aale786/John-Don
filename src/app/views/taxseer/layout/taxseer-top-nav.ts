import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
    RouterLink,
    RouterLinkActive,
} from '@angular/router';
import { WalletService } from '../../../core/api/wallet.service';

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
    private readonly walletService = inject(WalletService);

    readonly navOpen = signal(false);
    readonly walletBalance = signal(100);

    constructor() {
        this.walletService.getBalance(1).subscribe({
            next: (w: { balance: number }) => this.walletBalance.set(w.balance),
            error: () => { /* keep default 100 */ },
        });
    }

    toggleNav(): void {
        this.navOpen.update(open => !open);
    }

    closeNav(): void {
        this.navOpen.set(false);
    }
}