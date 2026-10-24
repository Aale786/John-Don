import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TaxseerFiler, TaxseerFilerStore, US_STATES, US_STATE_NAMES, formatEin } from '../../data/taxseer-filers.data';
import { TAXSEER_ORDERS } from '../orders/orders.data';
import {
  DOWNLOAD_TYPES,
  FILING_STEPS,
  STEP_HELP,
  FilerDownload,
  FilerFiling,
  FilerRecipient,
  FilingStatus,
} from './filer-details.data';
import { FilerService } from '../../../../core/api/filer.service';
import { RecipientService } from '../../../../core/api/recipient.service';
import { FilingService } from '../../../../core/api/filing.service';
import { DownloadService } from '../../../../core/api/download.service';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';

type Tab =
  | 'filer'
  | 'recipients'
  | 'filings'
  | 'orders'
  | 'status'
  | 'downloads'
  | 'summary';

type Tile = {
  value: number;
  label: string;
  tab: Tab;
  status?: FilingStatus;
  warn?: boolean;
  rejected?: number;
}

type FilerDialog = {
  kind: 'delete' | 'copy' | 'delete-form';
  title: string;
  body: string;
  ok: string;
}

type FilerEditErrors = {
  name?: string;
  ein?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
}

@Component({
  selector: 'taxseer-filer-details',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule, MatFormFieldModule,
    MatInputModule,  MatSelectModule,
      MatTabsModule,
    ],
  templateUrl: './filer-details.html',
})
export class FilerDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly store = inject(TaxseerFilerStore);
  private readonly filerService = inject(FilerService);
  private readonly recipientService = inject(RecipientService);
  private readonly filingService = inject(FilingService);
  private readonly downloadService = inject(DownloadService);
  readonly states = US_STATES;
  readonly stateNames = US_STATE_NAMES;
  readonly formatEin = formatEin;
  readonly downloadTypes = DOWNLOAD_TYPES;
  readonly steps = FILING_STEPS;
  readonly stepHelp = STEP_HELP;
  readonly years = [2025, 2024, 2023];

  private readonly routeId = toSignal(
    this.route.paramMap.pipe(
      map(params => Number(params.get('filerId')))
    ),
    { initialValue: Number(this.route.snapshot.paramMap.get('filerId')) }
  );

  private readonly routeTab = toSignal(
    this.route.queryParamMap.pipe(
      map(params => params.get('tab') ?? 'filer')
    ),
    { initialValue: this.route.snapshot.queryParamMap.get('tab') ?? 'filer' }
  );

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'filer', label: 'Filer' },
    { id: 'recipients', label: 'Recipients' },
    { id: 'filings', label: 'Filings' },
    { id: 'orders', label: 'Orders' },
    { id: 'status', label: 'Forms status' },
    { id: 'downloads', label: 'Downloads' },
    { id: 'summary', label: 'Summary' },
  ];

  readonly recipientsState = signal<FilerRecipient[]>([]);
  readonly filingsState = signal<FilerFiling[]>([]);
  readonly downloadsState = signal<FilerDownload[]>([]);

  readonly year = signal(2025);
  readonly status = signal<FilingStatus>('Pending');
  readonly formFilter = signal('all');
  readonly filingSearch = signal('');
  readonly filingSelected = signal<string[]>([]);
  readonly recipientSearch = signal('');
  readonly recipientSelected = signal<string[]>([]);
  readonly openOrders = signal<string[]>([]);
  readonly summaryMode = signal<'filed' | 'pending'>('filed');
  readonly downloadType = signal(DOWNLOAD_TYPES[0]);

  readonly switchOpen = signal(false);
  readonly switchSearch = signal('');
  readonly chooserOpen = signal(false);
  readonly dialog = signal<FilerDialog | null>(null);
  readonly copyTarget = signal(0);
  private filingToDelete: string | null = null;
  readonly toastMsg = signal('');

  readonly editOpen = signal(false);
  editForm: TaxseerFiler = this.blankFiler();
  readonly editErrors = signal<FilerEditErrors>({});

  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  readonly filerData = signal<TaxseerFiler | undefined>(undefined);

  readonly filer = computed(() => this.filerData());

  constructor() {
    // Reload API data whenever the route filer ID changes
    effect(() => {
      const id = this.routeId();
      if (id) {
        this.loadFilerData(id);
      }
    });
  }

  ngOnInit(): void {
    // Initial load is handled by the effect above
  }

  private loadFilerData(id: number): void {
    this.filerService.getById(id).subscribe(f => {
      this.filerData.set(f);
      // Also keep the store in sync for nav list
      this.store.save(f);
    });

    this.recipientService.getByFiler(id).subscribe(data =>
      this.recipientsState.set(data.map(r => ({ ...r })))
    );

    this.filingService.getByFiler(id).subscribe(data =>
      this.filingsState.set([...data])
    );

    this.downloadService.getByFiler(id).subscribe(data =>
      this.downloadsState.set([...data])
    );
  }

  readonly filerIndex = computed(() =>
    this.store.filers().findIndex(f => f.id === this.routeId())
  );

  readonly isLastFiler = computed(
    () => this.filerIndex() === this.store.filers().length - 1
  );

  readonly prevName = computed(
    () => this.store.filers()[this.filerIndex() - 1]?.name ?? ''
  );

  readonly nextName = computed(
    () => this.store.filers()[this.filerIndex() + 1]?.name ?? ''
  );

  readonly tab = computed<Tab>(() => {
    const value = this.routeTab();
    return this.tabs.some(t => t.id === value) ? value as Tab : 'filer';
  });

  readonly switchResults = computed(() => {
    const q = this.switchSearch().trim().toLowerCase().replace(/-/g, '');

    return this.store.filers().filter(f =>
      `${f.name}${f.ein}`.toLowerCase().includes(q)
    );
  });

  readonly recipients = computed(() =>
    this.recipientsState().filter(r => r.filerId === this.routeId())
  );

  readonly filteredRecipients = computed(() => {
    const q = this.recipientSearch().trim().toLowerCase();

    return this.recipients().filter(r =>
      `${r.name} ${r.tin.slice(-4)} ${r.city}`.toLowerCase().includes(q)
    );
  });

  readonly allRecipientsSelected = computed(() => {
    const list = this.filteredRecipients();

    return list.length > 0 &&
      list.every(r => this.recipientSelected().includes(r.id));
  });

  readonly yearFilings = computed(() =>
    this.filingsState().filter(
      row => row.filerId === this.routeId() && row.taxYear === this.year()
    )
  );

  readonly formsInYear = computed(() =>
    [...new Set(this.yearFilings().map(row => row.form))]
  );

  readonly pipeRows = computed(() =>
    this.steps
      .filter(step => step.status !== 'Rejected')
      .map(step => ({ ...step, count: this.matched(step.status) }))
  );

  readonly rejectedCount = computed(() => this.matched('Rejected'));

  readonly filings = computed(() =>
    this.yearFilings().filter(row => this.matches(row))
  );

  readonly filteredFilings = computed(() =>
    this.filings().filter(row => row.status === this.status())
  );

  readonly selectedCompleted = computed(() =>
    this.filingSelected().filter(id => {
      const row = this.filingsState().find(x => x.id === id);
      return !!row && row.status === 'Completed';
    }).length
  );

  readonly allFilingsSelected = computed(() => {
    const list = this.filteredFilings();

    return list.length > 0 &&
      list.every(row => this.filingSelected().includes(row.id));
  });

  readonly filerOrders = computed(() =>
    TAXSEER_ORDERS.filter(o => o.filerName === this.filer()?.name)
  );

  readonly acceptedForYear = computed(() =>
    this.yearFilings().filter(row => row.status === 'Accepted').length
  );

  readonly downloads = computed(() =>
    this.downloadsState().filter(d => d.filerId === this.routeId())
  );

  readonly matrix = computed(() =>
    this.formsInYear().map(form => {
      const rows = this.yearFilings().filter(row => row.form === form);

      return {
        form,
        counts: this.steps.map(step => ({
          status: step.status,
          label: step.status,
          value: rows.filter(row => row.status === step.status).length,
        })),
        total: rows.length,
      };
    })
  );

  readonly matrixTotals = computed(() =>
    this.steps.map(step => ({
      label: step.status,
      value: this.yearFilings().filter(row => row.status === step.status).length,
    }))
  );

  readonly summaryRows = computed(() => {
    const filed = this.summaryMode() === 'filed';
    const keep: FilingStatus[] = filed
      ? ['Submitted', 'Accepted']
      : ['Pending', 'Completed', 'In cart', 'Rejected'];

    const set = this.yearFilings().filter(row => keep.includes(row.status));
    const forms = [...new Set(set.map(row => row.form))];
    const total = (rows: FilerFiling[]) =>
      rows.reduce((sum, row) => sum + (row.amount || 0), 0);

    return {
      empty: set.length === 0,
      rows: forms.map(form => {
        const group = set.filter(row => row.form === form);

        return {
          form,
          count: group.length,
          recipients: new Set(group.map(row => row.recipient)).size,
          amount: this.money(total(group)),
        };
      }),
      total: {
        count: set.length,
        recipients: new Set(set.map(row => row.recipient)).size,
        amount: this.money(total(set)),
      },
    };
  });

  readonly tiles = computed<Tile[]>(() => {
    const f = this.filer();
    if (!f) return [];

    const c = (status: FilingStatus) =>
      this.yearFilings().filter(row => row.status === status).length;

    return [
      {
        value: this.recipients().length,
        label: `recipients${f.w9Required ? `, ${f.w9Required} W-9 waiting` : ''}`,
        tab: 'recipients',
      },
      {
        value: c('Pending'),
        label: 'pending forms',
        tab: 'filings',
        status: 'Pending',
        warn: true,
      },
      {
        value: c('Completed') + c('In cart'),
        label: 'ready or in cart',
        tab: 'filings',
        status: 'Completed',
      },
      {
        value: c('Accepted'),
        label: `accepted for ${this.year()}`,
        tab: 'filings',
        status: 'Accepted',
        rejected: c('Rejected'),
      },
    ];
  });

  readonly tabCount = computed<Partial<Record<Tab, number>>>(() => ({
    recipients: this.recipients().length,
    filings:
      this.countInYear('Pending') + this.countInYear('Completed'),
    orders: this.filerOrders().length,
    downloads: this.downloads().filter(d => d.status === 'Ready').length,
  }));

  private countInYear(status: FilingStatus): number {
    return this.yearFilings().filter(row => row.status === status).length;
  }

  private matches(row: FilerFiling): boolean {
    const form = this.formFilter();
    const q = this.filingSearch().trim().toLowerCase();

    if (form !== 'all' && row.form !== form) return false;

    return !q || `${row.recipient} ${row.tin}`.toLowerCase().includes(q);
  }

  private matched(status: FilingStatus): number {
    return this.filings().filter(row => row.status === status).length;
  }

  formsOfOrder(orderId: string): FilerFiling[] {
    return this.filingsState().filter(row => row.order === orderId);
  }

  formsOfRecipient(recipient: FilerRecipient): number {
    return this.yearFilings().filter(
      row => row.recipient === recipient.name
    ).length;
  }

  money(value: number | null): string {
    if (value == null || Number.isNaN(value)) return '';

    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  maskTin(r: FilerRecipient): string {
    if (r.tin.length !== 9) return r.tin;

    return r.type === 'EIN'
      ? formatEin(r.tin)
      : `•••-••-${r.tin.slice(5)}`;
  }

  recipientIssues(r: FilerRecipient): string[] {
    const issues: string[] = [];

    if (!/^\d{9}$/.test(r.tin)) {
      issues.push(`TIN has ${r.tin.replace(/\D/g, '').length} digits`);
    }
    if (!US_STATES.includes(r.state)) {
      issues.push(`“${r.state || 'blank'}” isn't a US state`);
    }
    if (!r.city) issues.push('City missing');
    if (!r.zip) issues.push('ZIP missing');
    else if (!/^\d{5}(-?\d{4})?$/.test(r.zip)) issues.push('ZIP format');

    return issues;
  }

  w9Pill(w9: FilerRecipient['w9']): string {
    return w9 === 'Submitted'
      ? 'p-ok'
      : w9 === 'Requested' ? 'p-warn' : 'p-neutral';
  }

  orderPill(status: string): string {
    return status === 'accepted'
      ? 'p-ok'
      : status === 'rejected' ? 'p-err' : 'p-info';
  }

  orderLabel(status: string): string {
    return status === 'accepted'
      ? 'Accepted'
      : status === 'rejected' ? 'Rejected' : 'In process';
  }

  downloadPill(status: FilerDownload['status']): string {
    return status === 'Ready'
      ? 'p-ok'
      : status === 'Preparing' ? 'p-info' : 'p-neutral';
  }

  pillFor(status: FilingStatus): string {
    return this.steps.find(step => step.status === status)?.pill ?? 'p-neutral';
  }

  einDisplay(): string {
    return formatEin(this.editForm.ein);
  }

  backToFilers(): void {
    this.router.navigate(['/taxseer/filers']);
  }

  /* ---------- navigation ---------- */

  setTab(tab: Tab): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'filer' ? { tab: null } : { tab },
      queryParamsHandling: 'merge',
    });
  }

  jump(tab: Tab, status?: FilingStatus): void {
    if (status) this.status.set(status);
    this.filingSelected.set([]);
    this.setTab(tab);
    console.log(tab)
  }

  jumpFromMatrix(status: FilingStatus, form: string): void {
    this.status.set(status);
    this.formFilter.set(form);
    this.filingSelected.set([]);
    this.setTab('filings');
  }

  selectFiler(f: TaxseerFiler): void {
    this.switchOpen.set(false);
    this.switchSearch.set('');
    this.filingSelected.set([]);
    this.recipientSelected.set([]);
    this.recipientSearch.set('');
    this.openOrders.set([]);
    this.router.navigate(['/taxseer/filers', f.id], {
      queryParams: this.tab() === 'filer' ? {} : { tab: this.tab() },
    });
  }

  move(direction: number): void {
    const next = this.store.filers()[this.filerIndex() + direction];
    if (next) this.selectFiler(next);
  }

  toggleSwitch(): void {
    this.switchOpen.set(!this.switchOpen());
  }

  startFiling(mode: 'manual' | 'bulk'): void {
    const filer = this.filer();
    if (!filer) return;

    this.chooserOpen.set(false);
    this.router.navigate(['/taxseer/dashboard'], {
      queryParams: { filing: mode, filerId: filer.id, year: this.year() },
    });
  }

  /* ---------- filings ---------- */

  setYear(year: number): void {
    this.year.set(year);
    this.filingSelected.set([]);
  }

  setStatus(status: FilingStatus): void {
    this.status.set(status);
    this.filingSelected.set([]);
  }

  toggleFiling(id: string): void {
    this.filingSelected.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  toggleAllFilings(): void {
    if (this.allFilingsSelected()) {
      this.filingSelected.set([]);
      return;
    }

    this.filingSelected.set(this.filteredFilings().map(row => row.id));
  }

  addSelectedToCart(): void {
    const ids = this.filingSelected();
    if (!ids.length) return;

    this.filingsState.update(list =>
      list.map((row): FilerFiling =>
        ids.includes(row.id) && row.status === 'Completed'
          ? { ...row, status: 'In cart' }
          : row
      )
    );

    this.filingSelected.set([]);
    this.toast(`${ids.length} form${ids.length > 1 ? 's' : ''} added to cart`);
  }

  removeFromCart(id: string): void {
    this.filingsState.update(list =>
      list.map((row): FilerFiling =>
        row.id === id ? { ...row, status: 'Completed' } : row
      )
    );

    this.toast('Removed from cart. It is back under Completed.');
  }

  /* ---------- recipients ---------- */

  toggleRecipient(id: string): void {
    this.recipientSelected.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  toggleAllRecipients(): void {
    if (this.allRecipientsSelected()) {
      this.recipientSelected.set([]);
      return;
    }

    this.recipientSelected.set(this.filteredRecipients().map(r => r.id));
  }

  requestW9(r: FilerRecipient): void {
    this.recipientsState.update(list =>
      list.map((x): FilerRecipient =>
        x.id === r.id ? { ...x, w9: 'Requested' } : x
      )
    );

    this.toast(
      r.email
        ? `W-9 request sent to ${r.email}`
        : `${r.name} has no email. Add one to send the request.`
    );
  }

  requestW9Selected(): void {
    const ids = this.recipientSelected();
    let skipped = 0;

    this.recipientsState.update(list =>
      list.map((r): FilerRecipient => {
        if (!ids.includes(r.id)) return r;
        if (r.w9 === 'Submitted') {
          skipped++;
          return r;
        }

        return { ...r, w9: 'Requested' };
      })
    );

    this.recipientSelected.set([]);
    this.toast(
      `W-9 requested from ${ids.length - skipped}` +
      (skipped ? `. ${skipped} already submitted, skipped` : '')
    );
  }

  askDeleteRecipients(): void {
    const n = this.recipientSelected().length;
    if (!n) return;

    this.copyTarget.set(0);
    this.dialog.set({
      kind: 'delete',
      title: `Delete ${n} recipient${n > 1 ? 's' : ''}?`,
      body:
        'Recipients with pending forms keep those forms until you delete ' +
        'them. Filed returns are not affected.',
      ok: 'Delete',
    });
  }

  askCopyRecipients(): void {
    const n = this.recipientSelected().length;
    if (!n) return;

    const first = this.store.filers().find(f => f.id !== this.routeId());
    this.copyTarget.set(first ? first.id : 0);
    this.dialog.set({
      kind: 'copy',
      title: `Copy ${n} recipient${n > 1 ? 's' : ''} to another filer`,
      body: '',
      ok: 'Copy recipients',
    });
  }

  askDeleteFiling(id: string): void {
    this.filingToDelete = id;
    this.dialog.set({
      kind: 'delete-form',
      title: 'Delete this form?',
      body: 'The draft is removed. The recipient stays saved.',
      ok: 'Delete',
    });
  }

  confirmDialog(): void {
    const state = this.dialog();
    if (!state) return;

    if (state.kind === 'delete-form') {
      const id = this.filingToDelete;
      this.filingsState.update(list => list.filter(x => x.id !== id));
      this.filingToDelete = null;
      this.toast('Form deleted');
    } else if (state.kind === 'delete') {
      const ids = this.recipientSelected();
      this.recipientsState.update(list =>
        list.filter(r => !ids.includes(r.id))
      );
      this.recipientSelected.set([]);
      this.toast(`${ids.length} recipient${ids.length > 1 ? 's' : ''} deleted`);
    } else {
      this.copyRecipients();
    }

    this.dialog.set(null);
  }

  closeDialog(): void {
    this.dialog.set(null);
  }

  private copyRecipients(): void {
    const target = this.copyTarget();
    const ids = this.recipientSelected();
    let copied = 0;

    this.recipientsState.update(list => {
      const additions = list
        .filter(r => ids.includes(r.id))
        .filter(r => !list.some(x => x.filerId === target && x.tin === r.tin))
        .map((r, i) => ({
          ...r,
          id: `c${Date.now()}-${i}`,
          filerId: target,
        }));

      copied = additions.length;

      return [...list, ...additions];
    });

    const filer = this.store.getById(target);
    this.recipientSelected.set([]);
    this.toast(
      `${copied} recipient${copied === 1 ? '' : 's'} copied to ` +
      `${filer?.name ?? 'filer'}${copied < ids.length ? `. ${ids.length - copied} already there` : ''}`
    );
  }

  /* ---------- orders / downloads / summary ---------- */

  toggleOrder(id: string): void {
    this.openOrders.update(list =>
      list.includes(id) ? list.filter(x => x !== id) : [...list, id]
    );
  }

  goOrders(): void {
    this.router.navigate(['/taxseer/orders'], {
      queryParams: { filer: this.routeId() },
    });
  }

  goRecipients(): void {
    this.router.navigate(['/taxseer/recipients'], {
      queryParams: { filer: this.routeId() },
    });
  }

  addRecipient(): void {
    this.router.navigate(['/taxseer/recipients'], {
      queryParams: { filer: this.routeId(), add: 1 },
    });
  }

  editRecipient(r: FilerRecipient): void {
    this.router.navigate(['/taxseer/recipients'], {
      queryParams: { filer: this.routeId(), recipient: r.id },
    });
  }

  prepareDownload(): void {
    const entry: FilerDownload = {
      id: `d${Date.now()}`,
      filerId: this.routeId(),
      by: 'Mary Pierce',
      date: 'Just now',
      type: this.downloadType(),
      forms: this.acceptedForYear(),
      status: 'Preparing',
    };

    this.downloadsState.update(list => [entry, ...list]);
    this.toast('Preparing. It will be ready here in a moment.');

    setTimeout(() => {
      this.downloadsState.update(list =>
        list.map((d): FilerDownload =>
        d.id === entry.id ? { ...d, status: 'Ready' } : d
      )
      );
      this.toast('Download ready');
    }, 1800);
  }

  /* ---------- edit filer panel ---------- */

  openEdit(): void {
    const f = this.filer();
    if (!f) return;

    this.editForm = { ...f, formsUsed: [...f.formsUsed] };
    this.editErrors.set({});
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
  }

  onEinInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 9);

    input.value = digits.length > 2
      ? `${digits.slice(0, 2)}-${digits.slice(2)}`
      : digits;

    this.editForm.ein = digits;
  }

  saveEdit(): void {
    const f = this.editForm;
    const errors: FilerEditErrors = {};

    if (!f.name.trim()) errors.name = 'Enter the legal name.';
    if (!/^\d{9}$/.test(f.ein)) {
      errors.ein = `EIN must be 9 digits. You entered ${f.ein.length}.`;
    } else if (
      this.store.filers().some(x => x.ein === f.ein && x.id !== f.id)
    ) {
      errors.ein = 'Another filer on this account already uses this EIN.';
    }
    if (!f.address.trim()) errors.address = 'Enter a street address.';
    if (!f.city.trim()) errors.city = 'Enter a city.';
    if (!US_STATES.includes(f.state)) errors.state = 'Choose a state.';
    if (!/^\d{5}(-?\d{4})?$/.test(f.zip)) errors.zip = '5 or 9 digits.';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      errors.email = 'Check the email address.';
    }

    this.editErrors.set(errors);
    if (Object.keys(errors).length) return;

    const updated: TaxseerFiler = {
      ...f,
      name: f.name.trim(),
      city: f.city.trim(),
      address: f.address.trim(),
      warning: undefined,
    };

    this.filerService.update(updated.id, updated).subscribe(saved => {
      this.filerData.set(saved);
      this.store.save(saved);
      this.closeEdit();
      this.toast(`${saved.name} updated`);
    });
  }

  /* ---------- exports ---------- */

  exportRecipients(): void {
    const f = this.filer();
    if (!f) return;

    this.downloadCsv(`recipients-${f.id}.csv`, [
      ['Name', 'TIN type', 'TIN', 'Address', 'City', 'State', 'ZIP', 'Email', 'W-9'],
      ...this.recipients().map(r => [
        r.name, r.type, r.tin, r.address,
        r.city, r.state, r.zip, r.email, r.w9,
      ]),
    ]);
  }

  exportFilings(): void {
    const f = this.filer();
    if (!f) return;

    this.downloadCsv(`forms-${f.id}-${this.year()}.csv`, [
      ['Form', 'Recipient', 'TIN', 'Box 1', 'Status', 'Last change'],
      ...this.filings().map(row => [
        row.form, row.recipient, row.tin,
        row.amount ?? '', row.status, row.edited,
      ]),
    ]);
  }

  private downloadCsv(
    filename: string,
    rows: (string | number)[][]
  ): void {
    const csv = rows.map(row =>
      row.map(value =>
        '"' + String(value ?? '').replace(/"/g, '""') + '"'
      ).join(',')
    ).join('\r\n');

    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  /* ---------- helpers ---------- */

  toast(message: string): void {
    this.toastMsg.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMsg.set(''), 2400);
  }

  trackTile(_: number, tile: Tile): string {
    return tile.label;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.switchOpen()) return;
    if ((event.target as HTMLElement).closest('.switch-wrap')) return;

    this.switchOpen.set(false);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.editOpen.set(false);
      this.switchOpen.set(false);
      this.chooserOpen.set(false);
      this.dialog.set(null);
      return;
    }

    const tag = (event.target as HTMLElement)?.tagName;

    if (this.chooserOpen()) {
      if (event.key === 'n' || event.key === 'N') this.startFiling('manual');
      else if (event.key === 'i' || event.key === 'I') this.startFiling('bulk');
      return;
    }

    if (
      tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' ||
      event.metaKey || event.ctrlKey || event.altKey || this.editOpen()
    ) return;

    if (event.key === '[') this.move(-1);
    else if (event.key === ']') this.move(1);
  }

  private blankFiler(): TaxseerFiler {
    return {
      id: 0, name: '', name2: '', ein: '',
      address: '', address2: '', city: '',
      state: 'MD', zip: '', email: '', phone: '',
      stateId: '', mask: false, formsUsed: [],
      pending: 0, ready: 0, filed: 0,
      w9Total: 0, w9Required: 0, w9Received: 0,
    };
  }
}
