import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { OrderService } from '../../../../core/api/order.service';
import { TaxseerOrder } from './orders.data';

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
    private readonly orderService = inject(OrderService);

    orders: OrderItem[] = [];

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
        this.loadOrders();
    }

    private loadOrders(): void {
        const params: { status?: string; q?: string } = {};
        if (this.selectedStatus !== 'all') params.status = this.selectedStatus;
        if (this.searchQuery.trim()) params.q = this.searchQuery.trim();

        this.orderService.getAll(params).subscribe({
            next: (data) => {
                this.orders = data.map(o => this.mapOrder(o));
            },
            error: () => {
                // API not yet available — leave orders as empty array
            },
        });
    }

    private mapOrder(o: TaxseerOrder): OrderItem {
        // Map API status to local status
        let status: 'process' | 'accepted' | 'rejected';
        if (o.status === 'in-process') {
            status = 'process';
        } else if (o.status === 'rejected') {
            status = 'rejected';
        } else {
            status = 'accepted';
        }

        // Build forms map from formSummary string (e.g. "1099-NEC, 1099-MISC")
        const formsMap: Record<string, number> = {};
        const formKeys = o.formSummary.split(',').map(s => s.trim()).filter(Boolean);
        if (formKeys.length > 0) {
            const totalForms = o.forms;
            if (formKeys.length === 1) {
                formsMap[formKeys[0]] = totalForms;
            } else {
                // Distribute evenly — exact split is not available from summary
                const perForm = Math.floor(totalForms / formKeys.length);
                const remainder = totalForms - perForm * (formKeys.length - 1);
                formKeys.forEach((key, i) => {
                    formsMap[key] = i === formKeys.length - 1 ? remainder : perForm;
                });
            }
        }

        // Determine files status based on downloadable flag and year
        const currentYear = new Date().getFullYear();
        let files: 'ready' | 'none' | 'expired';
        if (!o.downloadable) {
            files = 'none';
        } else if (o.taxYear < currentYear - 1) {
            files = 'expired';
        } else {
            files = 'ready';
        }

        return {
            no: o.id,
            filer: o.filerName,
            placed: o.placedDate,
            year: String(o.taxYear),
            forms: formsMap,
            amt: o.amount,
            status,
            rej: o.rejectedForms > 0 ? o.rejectedForms : undefined,
            copies: o.recipientCopies,
            files,
        };
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
