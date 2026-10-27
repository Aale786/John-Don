import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
    RouterLink,
    RouterLinkActive,
} from '@angular/router';
import { WalletService } from '../../../core/api-service/wallet.service';
import { AuthService } from '../../../core/auth-interceptors/auth.service';

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
    private readonly auth = inject(AuthService);

    readonly navOpen = signal(false);
    readonly walletBalance = signal(0);
    readonly currentUser = this.auth.currentUser;

    constructor() {
        this.walletService.getBalance().subscribe({
            next: (w: { balance: number }) => this.walletBalance.set(w.balance),
            error: () => { /* keep default 0 */ },
        });
    }

    displayName(): string {
        const user = this.currentUser();
        if (!user) {
            return '';
        }
        return user.firstName || user.email;
    }

    avatarLetter(): string {
        const name = this.displayName();
        return name ? name.charAt(0).toUpperCase() : '?';
    }

    signOut(): void {
        this.auth.logout();
    }

    toggleNav(): void {
        this.navOpen.update(open => !open);
    }

    closeNav(): void {
        this.navOpen.set(false);
    }
}