import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';

export type OrderItem = {
    no: string;
    filer: string;
    placed: string;
    year: string;
    forms: Record<string, number>;
    amt: number;
    status: 'process' | 'accepted' | 'rejected';
    rej?: number;
    copies: string;
    files: 'ready' | 'none' | 'expired';
}

export type DetailFormRow = {
    form: string;
    name: string;
    tin: string;
    amount: number;
    isRejected: boolean;
}

const SAMPLE_NAMES = [
    'Aaron Adams',
    'Bianca Brooks',
    'Carlos Chen',
    'Dana Diaz',
    'Elif Evans',
    'Farah Foster',
    'Grant Garcia',
    'Hana Hughes',
];

const FILER_IDS: Record<string, number> = {
    'Tech International Corporation': 1,
    'Avi Enterprises': 9,
    'Precise Technologies Inc': 6,
    'Maryland Trucking Company': 2,
    'Virginia Technologies': 3,
    'New York Accounting': 4,
    'Dillon Consulting': 5,
    'Infinite Technologies': 7,
    'Nextlinx Technologies Inc': 8,
};

const INITIAL_ORDERS: OrderItem[] = [
    {
        no: '20261204',
        filer: 'Nextlinx Technologies Inc',
        placed: 'Jan 11, 2026',
        year: '2025',
        forms: { 'W-2': 130 },
        amt: 260,
        status: 'rejected',
        rej: 2,
        copies: 'Held until corrected',
        files: 'ready',
    },
    {
        no: '20261198',
        filer: 'Maryland Trucking Company',
        placed: 'Jan 10, 2026',
        year: '2025',
        forms: { 'W-2': 49 },
        amt: 98,
        status: 'process',
        copies: 'Sends on acceptance',
        files: 'none',
    },
    {
        no: '20261197',
        filer: 'Maryland Trucking Company',
        placed: 'Jan 10, 2026',
        year: '2025',
        forms: { '1099-NEC': 12 },
        amt: 24,
        status: 'rejected',
        rej: 1,
        copies: 'Held until corrected',
        files: 'ready',
    },
    {
        no: '20261160',
        filer: 'Tech International Corporation',
        placed: 'Jan 8, 2026',
        year: '2025',
        forms: { '1099-NEC': 26, '1099-MISC': 3 },
        amt: 58,
        status: 'accepted',
        copies: '29 emailed',
        files: 'ready',
    },
    {
        no: '20261144',
        filer: 'Infinite Technologies',
        placed: 'Jan 7, 2026',
        year: '2025',
        forms: { '1099-NEC': 28, '1099-MISC': 3 },
        amt: 62,
        status: 'accepted',
        copies: '29 emailed, 2 mailed',
        files: 'ready',
    },
    {
        no: '20261102',
        filer: 'New York Accounting',
        placed: 'Jan 5, 2026',
        year: '2025',
        forms: { '1099-NEC': 4 },
        amt: 8,
        status: 'accepted',
        copies: '4 emailed',
        files: 'ready',
    },
    {
        no: '20251031',
        filer: 'Tech International Corporation',
        placed: 'Jan 27, 2025',
        year: '2024',
        forms: { '1099-NEC': 25 },
        amt: 50,
        status: 'accepted',
        copies: '21 emailed, 4 mailed',
        files: 'expired',
    },
    {
        no: '20251012',
        filer: 'Infinite Technologies',
        placed: 'Jan 22, 2025',
        year: '2024',
        forms: { '1099-NEC': 27 },
        amt: 54,
        status: 'accepted',
        copies: '27 emailed',
        files: 'expired',
    },
];

@Component({
    selector: 'taxseer-orders',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, MatButtonModule,
      MatInputModule,
      MatSelectModule,
      MatChipsModule,
    ],
    templateUrl: './orders.html',
})
export class TaxseerOrders implements OnInit {
    private readonly route = inject(ActivatedRoute);

    readonly orders = INITIAL_ORDERS;

    selectedStatus: 'all' | 'process' | 'rejected' | 'accepted' = 'all';
    searchQuery = '';
    selectedFiler = 'all';
    selectedYear = 'all';

    expandedOrders = new Set<string>();

    toastMessage = '';
    toastVisible = false;
    private toastTimeout: ReturnType<typeof setTimeout> | undefined;

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            if (params['status'] && ['all', 'process', 'rejected', 'accepted'].includes(params['status'])) {
                this.selectedStatus = params['status'];
            }
            if (params['filer']) {
                const filerId = Number(params['filer']);
                const foundName = Object.entries(FILER_IDS).find(([, id]) => id === filerId)?.[0];
                if (foundName) {
                    this.selectedFiler = foundName;
                }
            }
        });
    }

    get filerOptions(): string[] {
        return [...new Set(this.orders.map(o => o.filer))].sort();
    }

    get baseFilteredOrders(): OrderItem[] {
        return this.orders.filter(o => {
            const matchesFiler = this.selectedFiler === 'all' || o.filer === this.selectedFiler;
            const matchesYear = this.selectedYear === 'all' || o.year === this.selectedYear;
            const q = this.searchQuery.trim().toLowerCase();
            const matchesSearch = !q || o.no.toLowerCase().includes(q) || o.filer.toLowerCase().includes(q);
            return matchesFiler && matchesYear && matchesSearch;
        });
    }

    get filteredOrders(): OrderItem[] {
        return this.baseFilteredOrders.filter(o => {
            if (this.selectedStatus === 'all') return true;
            return o.status === this.selectedStatus;
        });
    }

    get counts() {
        const base = this.baseFilteredOrders;
        return {
            all: base.length,
            process: base.filter(o => o.status === 'process').length,
            rejected: base.filter(o => o.status === 'rejected').length,
            accepted: base.filter(o => o.status === 'accepted').length,
        };
    }

    get totalSpent(): number {
        return this.baseFilteredOrders.reduce((sum, o) => sum + o.amt, 0);
    }

    setStatus(status: 'all' | 'process' | 'rejected' | 'accepted'): void {
        this.selectedStatus = status;
    }

    toggleExpand(orderNo: string): void {
        if (this.expandedOrders.has(orderNo)) {
            this.expandedOrders.delete(orderNo);
        } else {
            this.expandedOrders.add(orderNo);
        }
    }

    isExpanded(orderNo: string): boolean {
        return this.expandedOrders.has(orderNo);
    }

    clearFilters(): void {
        this.selectedStatus = 'all';
        this.searchQuery = '';
        this.selectedFiler = 'all';
        this.selectedYear = 'all';
    }

    getFilerId(name: string): number {
        return FILER_IDS[name] || 1;
    }

    getFormKeys(forms: Record<string, number>): string {
        return Object.keys(forms).join(', ');
    }

    getFormTotal(forms: Record<string, number>): number {
        return Object.values(forms).reduce((sum, val) => sum + val, 0);
    }

    getDetailRows(order: OrderItem): DetailFormRow[] {
        const rows: DetailFormRow[] = [];
        let i = 0;
        Object.entries(order.forms).forEach(([form, count]) => {
            const limit = Math.min(count, 4);
            for (let k = 0; k < limit; k++, i++) {
                const isRejected = order.status === 'rejected' && i < (order.rej || 0);
                rows.push({
                    form,
                    name: SAMPLE_NAMES[i % SAMPLE_NAMES.length],
                    tin: `•••-••-${String(1200 + i * 71).slice(-4)}`,
                    amount: 2400 + i * 1375,
                    isRejected,
                });
            }
        });
        return rows;
    }

    showToast(message: string): void {
        this.toastMessage = message;
        this.toastVisible = true;
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => {
            this.toastVisible = false;
        }, 2500);
    }
}
