
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

import { CartService } from '../../../../core/api-service/cart.service';
import { FilerFiling } from '../../pages/filer-details/filer-details.data';

const PRICE_PER_FORM = 2;

@Component({
    selector: 'app-add-to-cart',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatChipsModule,
    ],
    templateUrl: './add-to-cart.html',
})
export class AddToCartComponent implements OnChanges {

    @Input() filings: FilerFiling[] = [];

    @Output() cartUpdated = new EventEmitter<void>();

    private readonly cartService = inject(CartService);

    loading = false;
    errorMessage = '';
    successMessage = '';

    readonly pricePerForm = PRICE_PER_FORM;

    get completedFilings(): FilerFiling[] {
        return (this.filings ?? []).filter(
            filing => filing.status === 'Completed'
        );
    }

    get totalCount(): number {
        return this.completedFilings.length;
    }

    get totalPrice(): number {
        return this.totalCount * PRICE_PER_FORM;
    }

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
        this.loading = false;
        this.errorMessage = '';
        this.successMessage = '';
    }

    addToCart(): void {

        if (this.loading || this.completedFilings.length === 0) {
            return;
        }

        // Validate actual database filing IDs.
        const filings = this.completedFilings;

        const invalidFiling = filings.find(
            filing => !Number.isInteger(Number(filing.id)) ||
                Number(filing.id) <= 0
        );

        if (invalidFiling) {
            this.errorMessage =
                `Invalid filing ID for ${invalidFiling.recipient}. ` +
                'Use the actual numeric filing ID from PostgreSQL.';
            return;
        }

        this.loading = true;
        this.errorMessage = '';
        this.successMessage = '';

        from(filings)
            .pipe(
                concatMap(filing =>
                    this.cartService.addToCart(Number(filing.id))
                ),
                finalize(() => {
                    this.loading = false;
                })
            )
            .subscribe({
                next: () => {},

                error: (error) => {
                    console.error('Add to cart failed:', error);

                    this.errorMessage =
                        error?.error?.message ||
                        'Unable to add filings to cart. Please try again.';

                    this.cartUpdated.emit();
                },

                complete: () => {
                    this.successMessage =
                        'Filings successfully added to cart.';

                    this.cartUpdated.emit();
                }
            });
    }
}
