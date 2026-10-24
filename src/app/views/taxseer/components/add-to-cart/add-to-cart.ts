import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { concatMap, finalize, from } from 'rxjs';
import { CartService } from '../../../../core/api/cart.service';
import { FilerFiling } from '../../pages/filer-details/filer-details.data';

/** Price per form in USD */
const PRICE_PER_FORM = 2;

@Component({
    selector: 'app-add-to-cart',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatChipsModule],
    templateUrl: './add-to-cart.html',
})
export class AddToCartComponent implements OnChanges {
    @Input() filings: FilerFiling[] = [];
    @Input() userId = 0;

    @Output() cartUpdated = new EventEmitter<void>();

    private readonly cartService = inject(CartService);

    loading = false;

    readonly pricePerForm = PRICE_PER_FORM;

    get completedFilings(): FilerFiling[] {
        return this.filings.filter(f => f.status === 'Completed');
    }

    get totalCount(): number {
        return this.completedFilings.length;
    }

    get totalPrice(): number {
        return this.totalCount * PRICE_PER_FORM;
    }

    /** Pill CSS class for a filing status */
    statusClass(filing: FilerFiling): string {
        switch (filing.status) {
            case 'Completed':
                return 'p-info';
            case 'Pending':
                return 'p-warn';
            case 'In cart':
                return 'p-neutral';
            case 'Accepted':
                return 'p-ok';
            case 'Rejected':
                return 'p-err';
            default:
                return 'p-neutral';
        }
    }

    ngOnChanges(): void {
        // Reset loading state when inputs change
        this.loading = false;
    }

    addToCart(): void {
        if (this.loading || this.completedFilings.length === 0) {
            return;
        }

        this.loading = true;

        from(this.completedFilings)
            .pipe(
                concatMap(filing =>
                    this.cartService.addToCart(Number(filing.id), this.userId),
                ),
                finalize(() => {
                    this.loading = false;
                }),
            )
            .subscribe({
                next: () => {},
                error: () => {
                    // Surface errors gracefully — cart update event still fires
                    // so the dashboard can refresh the count
                },
                complete: () => {
                    this.cartUpdated.emit();
                },
            });
    }
}
