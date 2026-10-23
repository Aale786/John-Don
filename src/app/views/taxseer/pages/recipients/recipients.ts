import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';

type Status = 'Submitted' | 'Requested' | 'Not requested';

type Tile = 'all' | 'Requested' | 'old' | 'Not requested';

type Recipient = {
    id: number;
    filer: string;
    name: string;
    tin: string;
    email: string;
    status: Status;
    sent?: string;
    got?: string;
    rem?: number;
}

type FilerGroup = {
    filer: string;
    recipients: Recipient[];

    total: number;
    submitted: number;
    requested: number;
    notRequested: number;

    oldestRequested: Recipient | null;
}

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

const FILER_BY_ID = Object.fromEntries(
    Object.entries(FILER_IDS).map(([name, id]) => [id, name]),
);

const TODAY = new Date('2026-01-14T12:00:00');

const INITIAL_RECIPIENTS: Recipient[] = [
    {
        id: 1,
        filer: 'Tech International Corporation',
        name: 'Mark Waugh',
        tin: '•••-••-2330',
        email: 'mark.waugh@example.com',
        status: 'Requested',
        sent: '2025-11-04',
        rem: 2,
    },
    {
        id: 2,
        filer: 'Tech International Corporation',
        name: 'Derek Randal',
        tin: '•••-••-5678',
        email: 'derek.r@example.com',
        status: 'Submitted',
        sent: '2025-11-02',
        got: '2025-11-12',
    },
    {
        id: 3,
        filer: 'Tech International Corporation',
        name: 'Priya Nair',
        tin: '•••-••-9021',
        email: 'priya.nair@example.com',
        status: 'Submitted',
        sent: '2025-11-02',
        got: '2025-11-05',
    },
    {
        id: 4,
        filer: 'Tech International Corporation',
        name: 'Hillside Legal Group PC',
        tin: '52-1234102',
        email: 'billing@hillsidelegal.example',
        status: 'Submitted',
        sent: '2025-11-02',
        got: '2025-11-03',
    },
    {
        id: 5,
        filer: 'Tech International Corporation',
        name: 'Tariq Fateh',
        tin: '8 digits on file',
        email: '',
        status: 'Not requested',
    },
    {
        id: 6,
        filer: 'Maryland Trucking Company',
        name: 'Blue Ridge Couriers',
        tin: '—',
        email: 'ops@blueridge.example',
        status: 'Requested',
        sent: '2025-12-15',
        rem: 1,
    },
    {
        id: 7,
        filer: 'Precise Technologies Inc',
        name: 'Jose Ortega',
        tin: '—',
        email: 'jortega@example.com',
        status: 'Requested',
        sent: '2025-12-20',
        rem: 1,
    },
    {
        id: 8,
        filer: 'Precise Technologies Inc',
        name: 'Karin Lindqvist',
        tin: '—',
        email: 'karin.l@example.com',
        status: 'Requested',
        sent: '2026-01-02',
        rem: 0,
    },
    {
        id: 9,
        filer: 'Avi Enterprises',
        name: 'Harbor Supply LLC',
        tin: '—',
        email: 'ap@harborsupply.example',
        status: 'Requested',
        sent: '2026-01-02',
        rem: 0,
    },
    {
        id: 10,
        filer: 'Avi Enterprises',
        name: 'Mina Patel',
        tin: '•••-••-4410',
        email: 'mina.p@example.com',
        status: 'Submitted',
        sent: '2025-12-01',
        got: '2025-12-04',
    },
    {
        id: 11,
        filer: 'Avi Enterprises',
        name: 'Owen Ortiz',
        tin: '—',
        email: '',
        status: 'Not requested',
    },
];

@Component({
    selector: 'taxseer-recipients',
    standalone: true,
    imports: [CommonModule, MatButtonModule,
      MatInputModule,
      MatChipsModule,
    ],
    templateUrl: './recipients.html',
})
export class TaxseerRecipients {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);

    recipients: Recipient[] = INITIAL_RECIPIENTS.map((recipient) => ({
        ...recipient,
    }));

    searchText = '';

    onlyOpen = false;

    activeTile: Tile = 'all';

    expandedFilers = new Set<string>([
        'Tech International Corporation',
    ]);

    toastMessage = '';
    toastVisible = false;

    private toastTimer?: ReturnType<typeof setTimeout>;

    constructor() {
        this.applyDeepLink();
    }

    // ---------------------------------------------------------
    // Prototype counts
    // ---------------------------------------------------------

    get totalRecipients(): number {
        return this.recipients.length;
    }

    get waitingCount(): number {
        return this.recipients.filter(
            (recipient) => recipient.status === 'Requested',
        ).length;
    }

    get overdueCount(): number {
        return this.recipients.filter(
            (recipient) =>
                recipient.status === 'Requested' &&
                this.daysAgo(recipient.sent) > 30,
        ).length;
    }

    get notRequestedCount(): number {
        return this.recipients.filter(
            (recipient) => recipient.status === 'Not requested',
        ).length;
    }

    // ---------------------------------------------------------
    // Search
    // ---------------------------------------------------------

    onSearch(value: string): void {
        this.searchText = value;

        if (value.trim()) {
            this.groups().forEach((group) => {
                this.expandedFilers.add(group.filer);
            });
        }
    }

    // ---------------------------------------------------------
    // Tiles
    // ---------------------------------------------------------

    setTile(tile: Tile): void {
        this.activeTile = tile;

        if (tile !== 'all') {
            this.groups().forEach((group) => {
                this.expandedFilers.add(group.filer);
            });
        }

        console.log(tile)
    }

    // ---------------------------------------------------------
    // Grouping
    // ---------------------------------------------------------

    groups(): FilerGroup[] {
        const matchingRecipients = this.recipients.filter((recipient) =>
            this.matchesFilters(recipient),
        );

        const filerNames = [
            ...new Set(matchingRecipients.map((recipient) => recipient.filer)),
        ];

        return filerNames
            .map((filer) => {
                const recipientsForFiler = this.recipients.filter(
                    (recipient) => recipient.filer === filer,
                );

                const visibleRecipients = matchingRecipients.filter(
                    (recipient) => recipient.filer === filer,
                );

                const submitted = recipientsForFiler.filter(
                    (recipient) => recipient.status === 'Submitted',
                );

                const requested = recipientsForFiler.filter(
                    (recipient) => recipient.status === 'Requested',
                );

                const notRequested = recipientsForFiler.filter(
                    (recipient) => recipient.status === 'Not requested',
                );

                const oldestRequested =
                    requested.length > 0
                        ? requested.reduce((oldest, current) => {
                              if (!oldest.sent) {
                                  return current;
                              }

                              if (!current.sent) {
                                  return oldest;
                              }

                              return this.daysAgo(current.sent) >
                                  this.daysAgo(oldest.sent)
                                  ? current
                                  : oldest;
                          })
                        : null;

                return {
                    filer,
                    recipients: visibleRecipients,

                    total: recipientsForFiler.length,
                    submitted: submitted.length,
                    requested: requested.length,
                    notRequested: notRequested.length,

                    oldestRequested,
                };
            })
            .filter((group) => {
                if (!this.onlyOpen) {
                    return true;
                }

                return group.requested > 0;
            })
            .sort((a, b) => a.filer.localeCompare(b.filer));
    }

    // ---------------------------------------------------------
    // Filtering
    // ---------------------------------------------------------

    private matchesFilters(recipient: Recipient): boolean {
        const tileMatches =
            this.activeTile === 'all' ||
            (this.activeTile === 'old' &&
                recipient.status === 'Requested' &&
                this.daysAgo(recipient.sent) > 30) ||
            recipient.status === this.activeTile;

        const query = this.searchText.trim().toLowerCase();

        const searchMatches =
            !query ||
            `${recipient.filer} ${recipient.name}`
                .toLowerCase()
                .includes(query);

        return tileMatches && searchMatches;
    }

    // ---------------------------------------------------------
    // Expand / collapse
    // ---------------------------------------------------------

    isExpanded(filer: string): boolean {
        return this.expandedFilers.has(filer);
    }

    toggleFiler(filer: string): void {
        if (this.expandedFilers.has(filer)) {
            this.expandedFilers.delete(filer);
        } else {
            this.expandedFilers.add(filer);
        }
    }

    get allExpanded(): boolean {
        const groups = this.groups();

        return (
            groups.length > 0 &&
            groups.every((group) =>
                this.expandedFilers.has(group.filer),
            )
        );
    }

    toggleAll(): void {
        const groups = this.groups();

        if (this.allExpanded) {
            groups.forEach((group) => {
                this.expandedFilers.delete(group.filer);
            });
        } else {
            groups.forEach((group) => {
                this.expandedFilers.add(group.filer);
            });
        }
    }

    // ---------------------------------------------------------
    // Filer navigation
    // ---------------------------------------------------------

    openFiler(filerId: number): void {
        const filerName = FILER_BY_ID[filerId];

        if (!filerName) {
            return;
        }

        this.router.navigate(['/taxseer/filers', filerId], {
            queryParams: {
                tab: 'recipients',
            },
        });
    }

    filerId(filer: string): number {
        return FILER_IDS[filer] ?? 1;
    }

    // ---------------------------------------------------------
    // Filer actions
    // ---------------------------------------------------------

    remindFiler(group: FilerGroup): void {
        const waiting = this.recipients.filter(
            (recipient) =>
                recipient.filer === group.filer &&
                recipient.status === 'Requested',
        );

        if (!waiting.length) {
            return;
        }

        waiting.forEach((recipient) => {
            recipient.rem = (recipient.rem ?? 0) + 1;
        });

        this.showToast(
            `Reminders sent to ${waiting.length} recipients`,
        );
    }

    requestFiler(group: FilerGroup): void {
        const waiting = this.recipients.filter(
            (recipient) =>
                recipient.filer === group.filer &&
                recipient.status === 'Not requested' &&
                !!recipient.email,
        );

        if (!waiting.length) {
            return;
        }

        waiting.forEach((recipient) => {
            recipient.status = 'Requested';
            recipient.sent = '2026-01-14';
            recipient.rem = 0;
        });

        this.showToast(
            `W-9 requests sent to ${waiting.length} recipients`,
        );
    }

    // ---------------------------------------------------------
    // Recipient actions
    // ---------------------------------------------------------

    viewW9(recipient: Recipient): void {
        this.showToast(`Viewing W-9 for ${recipient.name}`);
    }

    addEmail(recipient: Recipient): void {
        this.showToast(`Add an email address for ${recipient.name}`);
    }

    resendRequest(recipient: Recipient): void {
        if (recipient.status !== 'Requested') {
            return;
        }

        recipient.rem = (recipient.rem ?? 0) + 1;

        this.showToast(
            `Reminder sent to ${recipient.name}`,
        );
    }

    requestRecipient(recipient: Recipient): void {
        if (!recipient.email) {
            this.addEmail(recipient);
            return;
        }

        recipient.status = 'Requested';
        recipient.sent = '2026-01-14';
        recipient.rem = 0;

        this.showToast(
            `W-9 request sent to ${recipient.name}`,
        );
    }

    // ---------------------------------------------------------
    // Header actions
    // ---------------------------------------------------------

    exportRecipients(): void {
        this.showToast('W-9 status exported to Excel');
    }

    remindAll(): void {
        const waiting = this.recipients.filter(
            (recipient) => recipient.status === 'Requested',
        );

        waiting.forEach((recipient) => {
            recipient.rem = (recipient.rem ?? 0) + 1;
        });

        this.showToast(
            `Reminders sent to ${waiting.length} recipients`,
        );
    }

    // ---------------------------------------------------------
    // Recipient helpers
    // ---------------------------------------------------------

    statusClass(status: Status): string {
        switch (status) {
            case 'Submitted':
                return 'p-ok';

            case 'Requested':
                return 'p-warn';

            case 'Not requested':
                return 'p-neutral';
        }
    }

    formatDate(date?: string): string {
        if (!date) {
            return '';
        }

        return new Date(`${date}T12:00:00`).toLocaleDateString(
            'en-US',
            {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            },
        );
    }

    daysAgo(date?: string): number {
        if (!date) {
            return 0;
        }

        return Math.round(
            (TODAY.getTime() -
                new Date(`${date}T12:00:00`).getTime()) /
                86400000,
        );
    }

    daysAgoForDisplay(date?: string): string {
        const days = this.daysAgo(date);

        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    // ---------------------------------------------------------
    // Deep link
    // /taxseer/recipients?filer=1
    // ---------------------------------------------------------

    private applyDeepLink(): void {
        const filerId = Number(
            this.route.snapshot.queryParamMap.get('filer'),
        );

        if (!filerId) {
            return;
        }

        const filerName = FILER_BY_ID[filerId];

        if (!filerName) {
            return;
        }

        this.searchText = filerName;
        this.expandedFilers = new Set([filerName]);
    }

    // ---------------------------------------------------------
    // Toast
    // ---------------------------------------------------------

    private showToast(message: string): void {
        this.toastMessage = message;
        this.toastVisible = true;

        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }

        this.toastTimer = setTimeout(() => {
            this.toastVisible = false;
        }, 2400);
    }
}