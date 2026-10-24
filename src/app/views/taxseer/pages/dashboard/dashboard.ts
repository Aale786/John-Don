import { CommonModule, NgClass } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { US_STATE_NAMES, US_STATES } from '../../data/taxseer-filers.data';
import { FilerService } from '../../../../core/api/filer.service';
import { RecipientService } from '../../../../core/api/recipient.service';
import {
  NecAmountsComponent,
  NecAmountRow,
  necRowErrors,
  necRowWarnings,
} from '../filing/components/nec-amounts/nec-amounts';
import { AddToCartComponent } from '../../components/add-to-cart/add-to-cart';
import { FilerFiling } from '../filer-details/filer-details.data';

type FilingMode = 'manual' | 'bulk';

type Filer = {
  id: number;
  name: string;
  ein: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  email?: string;
  stateNo?: string;
  forms: string[];
  recent?: number;
  pending: number;
  filed: number;
  w9Total: number;
  w9Received: number;
  w9Waiting: number;
  warn?: string;
};

type Recipient = {
  id: number;
  filerId: number;
  name: string;
  first?: string;
  middle?: string;
  last?: string;
  dba?: string;
  tin: string;
  type: TinType;
  country?: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  econsent: boolean;
  w9: string;
  pendingForm?: boolean;
  selected?: boolean;
};

type TinType = 'SSN' | 'EIN' | 'Unknown';

function splitName(name: string): [string, string, string] {
  const parts = name.trim().split(/\s+/);

  if (parts.length <= 1) {
    return [parts[0] ?? '', '', ''];
  }

  return [parts[0], parts.slice(1, -1).join(' '), parts[parts.length - 1]];
}

type BulkFilter = 'all' | 'err' | 'note' | 'new' | 'skip';

type BulkRow = {
  line: number;
  name: string;
  tin: string;
  type: 'SSN' | 'EIN';
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  consent: boolean;
  box1: string;
  box4: string;
  isNew: boolean;
  error: string;
  errorFields: string[];
  note: string;
  skip: boolean;
};

type FormOption = {
  code: string;
  label: string;
  due: string;
};

type FormGroup = {
  group: string;
  forms: FormOption[];
};

type ResumeItem = {
  id: number;
  name: string;
  form: string;
  done: number;
  total: number;
  detail: string;
  when: string;
};

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
      CommonModule,
      FormsModule,
      NecAmountsComponent,
      AddToCartComponent,
      MatButtonModule,
      MatButtonToggleModule,
      MatCheckboxModule,
      MatChipsModule,
      MatInputModule,
      MatRadioModule,
      MatSelectModule,

       NgClass,
      MatFormFieldModule, MatInputModule, MatSelectModule,
      MatChipsModule, MatCheckboxModule, MatRadioModule,
      MatButtonToggleModule, MatTabsModule,
    ],
    templateUrl: './dashboard.html',
})
export class TaxseerDashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly filerService = inject(FilerService);
  private readonly recipientService = inject(RecipientService);

  cartCount = 52;
  walletBalance = 100;

  /** The current logged-in user ID — used by AddToCartComponent. */
  readonly currentUserId = 1;

  /** Completed filings for the currently-selected filer and form (step 5 review). */
  get completedFilings(): FilerFiling[] {
    // In the wizard flow the selected recipients' amount rows represent the
    // forms to file; we build a lightweight FilerFiling[] from them so the
    // AddToCartComponent can display and add them.
    return this.amountRowsToUse
      .filter(row => this.amountRowErrors(row).length === 0)
      .map(row => ({
        id: row.id.replace('recipient-', ''),
        filerId: this.selectedFilerId ?? 0,
        taxYear: this.taxYear,
        form: this.selectedForm,
        recipient: row.name,
        tin: row.tin,
        amount: row.box1 != null ? Number(row.box1) : null,
        status: 'Completed' as const,
        edited: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
  }

  /** Called by AddToCartComponent when the API cart calls complete. */
  onCartUpdated(): void {
    this.cartCount += this.completedFilings.length;
    this.doneCount = this.formCount();
    this.activeView = 'done';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  activeView: 'dashboard' | 'wizard' | 'done' = 'dashboard';
  doneCount = 0;
  mode: FilingMode = 'manual';
  step = 1;
  taxYear = 2025;
  readonly taxYears = [2025, 2024, 2023];

  filerSearch = '';
  recipientSearch = '';
  formSearch = '';

  selectedFilerId: number | null = null;
  selectedForm = '';

  amountRows: NecAmountRow[] = [];
  bulkRows: BulkRow[] = [];

  toastMessage = '';
  showToast = false;

  chooserOpen = false;
  chooserFilerId: number | null = null;

  private toastTimer?: number;

  selectedFileName = '';
  uploadedRows = 0;

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    const filing = params.get('filing');

    if (filing !== 'manual' && filing !== 'bulk') {
      return;
    }

  

    const year = Number(params.get('year'));
    const filerId = Number(params.get('filerId'));

    if (year >= 2020 && year <= 2100) {
      this.taxYear = year;
    }

    this.startFiling(
      filing,
      Number.isInteger(filerId) && filerId > 0
        ? filerId
        : undefined
    );
  }

  // Dummy filer data
  readonly resumeItems: ResumeItem[] = [
    {
      id: 1,
      name: 'Tech International Corporation',
      form: '1099-NEC',
      done: 0,
      total: 1,
      detail: 'Manual entry · Mark Waugh',
      when: 'Edited today, 10:42 AM'
    },
    {
      id: 9,
      name: 'Avi Enterprises',
      form: '1099-NEC',
      done: 10,
      total: 23,
      detail: 'Manual entry · 13 forms still pending',
      when: 'Edited yesterday'
    },
    {
      id: 6,
      name: 'Precise Technologies Inc',
      form: '1095-C',
      done: 0,
      total: 40,
      detail: 'Bulk import · 40 rows imported, not reviewed',
      when: 'Imported Jan 9'
    }
  ];

  filers: Filer[] = [];

  // Recipient data loaded from API when a filer is selected
  recipients: Recipient[] = [];

  readonly formGroups: FormGroup[] = [
    {
      group: '1099 series',
      forms: [
        {
          code: '1099-NEC',
          label: 'Nonemployee compensation',
          due: 'Feb 2'
        },
        {
          code: '1099-MISC',
          label: 'Rents, royalties, other income',
          due: 'Mar 31'
        },
        {
          code: '1099-INT',
          label: 'Interest income',
          due: 'Mar 31'
        },
        {
          code: '1099-DIV',
          label: 'Dividends and distributions',
          due: 'Mar 31'
        },
        {
          code: '1099-R',
          label: 'Pensions, annuities, IRAs',
          due: 'Mar 31'
        },
        {
          code: '1099-K',
          label: 'Payment card and network transactions',
          due: 'Mar 31'
        },
        {
          code: '1099-B',
          label: 'Broker and barter transactions',
          due: 'Mar 31'
        },
        {
          code: '1099-C',
          label: 'Cancellation of debt',
          due: 'Mar 31'
        },
        {
          code: '1099-A',
          label: 'Acquisition or abandonment of property',
          due: 'Mar 31'
        },
        {
          code: '1099-G',
          label: 'Certain government payments',
          due: 'Mar 31'
        },
        {
          code: '1099-OID',
          label: 'Original issue discount',
          due: 'Mar 31'
        },
        {
          code: '1099-PATR',
          label: 'Distributions from cooperatives',
          due: 'Mar 31'
        },
        {
          code: '1099-Q',
          label: 'Qualified education program payments',
          due: 'Mar 31'
        },
        {
          code: '1099-CAP',
          label: 'Changes in corporate control',
          due: 'Mar 31'
        },
        {
          code: '1099-H',
          label: 'Health coverage tax credit advances',
          due: 'Mar 31'
        }
      ]
    },
    {
      group: 'Wage statements',
      forms: [
        {
          code: 'W-2',
          label: 'Wage and tax statement',
          due: 'Feb 2'
        },
        {
          code: 'W-2C',
          label: 'Corrected wage and tax statement',
          due: 'As needed'
        }
      ]
    },
    {
      group: 'ACA',
      forms: [
        {
          code: '1095-C',
          label: 'Employer-provided coverage (1094-C created for you)',
          due: 'Mar 31'
        },
        {
          code: '1095-B',
          label: 'Health coverage (1094-B created for you)',
          due: 'Mar 31'
        }
      ]
    },
    {
      group: 'Extensions',
      forms: [
        {
          code: '8809',
          label: 'Extension of time to file information returns',
          due: 'Before due date'
        }
      ]
    }
  ];

  // 1099-NEC import columns [label, required]
  readonly templateColumns: [string, boolean][] = [
    ['Recipient TIN Type (SSN/EIN)', true],
    ['Recipient TIN', true],
    ['First Name', false],
    ['Middle Name', false],
    ['Last Name', false],
    ['Business Name', false],
    ['Address Line 1', true],
    ['Address Line 2', false],
    ['City', true],
    ['State', true],
    ['ZIP', true],
    ['Country', false],
    ['Email', false],
    ['E-delivery Consent (Y/N)', false],
    ['Account Number', false],
    ['Box 1 Nonemployee Compensation', true],
    ['Box 2 Direct Sales (Y/N)', false],
    ['Box 3 Excess Golden Parachute', false],
    ['Box 4 Federal Tax Withheld', false],
    ['Box 5 State Tax Withheld', false],
    ['Box 6 State', false],
    ['Box 6 Payer State No', false],
    ['Box 7 State Income', false],
    ['2nd TIN Notice (Y/N)', false]
  ];

  ngOnInit(): void {
    this.loadFilers();
  }

  private loadFilers(): void {
    const q = this.filerSearch.trim();
    if (q) {
      this.filerService.search(q).subscribe(data => this.filers = this.mapFilersFromApi(data));
    } else {
      this.filerService.getAll().subscribe(data => this.filers = this.mapFilersFromApi(data));
    }
  }

  /** Map TaxseerFiler (API shape) to the dashboard-local Filer shape */
  private mapFilersFromApi(data: any[]): Filer[] {
    return data.map(f => ({
      id: f.id,
      name: f.name,
      ein: f.ein,
      address: f.address,
      address2: f.address2,
      city: f.city,
      state: f.state,
      zip: f.zip,
      phone: f.phone,
      email: f.email,
      stateNo: f.stateId,
      forms: f.formsUsed ?? [],
      pending: f.pending ?? 0,
      filed: f.filed ?? 0,
      w9Total: f.w9Total ?? 0,
      w9Received: f.w9Received ?? 0,
      w9Waiting: (f.w9Required ?? 0) - (f.w9Received ?? 0),
      warn: f.warning,
    } as Filer));
  }

  private loadRecipients(filerId: number): void {
    const q = this.recipientSearch.trim();
    if (q) {
      this.recipientService.search(filerId, q).subscribe(data => {
        this.recipients = this.mapRecipientsFromApi(data);
      });
    } else {
      this.recipientService.getByFiler(filerId).subscribe(data => {
        this.recipients = this.mapRecipientsFromApi(data);
      });
    }
  }

  /** Map FilerRecipient (API shape) to the dashboard-local Recipient shape */
  private mapRecipientsFromApi(data: any[]): Recipient[] {
    return data.map(r => ({
      id: Number(r.id),
      filerId: r.filerId,
      name: r.name,
      tin: r.tin,
      type: (r.type as TinType) ?? 'SSN',
      address: r.address,
      city: r.city,
      state: r.state,
      zip: r.zip,
      email: r.email ?? '',
      econsent: r.econsent ?? false,
      w9: r.w9 ?? 'Not requested',
      selected: false,
    } as Recipient));
  }


  // Search and filter filers — filters locally against already-loaded list;
  // API search is triggered via onFilerSearchChange() called from the template.
  get filteredFilers(): Filer[] {
    const query = this.filerSearch
      .toLowerCase()
      .replace(/-/g, '')
      .trim();

    return this.filers.filter(filer =>
      `${filer.name} ${filer.ein}`
        .toLowerCase()
        .replace(/-/g, '')
        .includes(query)
    );
  }

  onFilerSearchChange(): void {
    this.loadFilers();
  }

  // Currently selected filer
  get currentFiler(): Filer | undefined {
    return this.filers.find(
      filer => filer.id === this.selectedFilerId
    );
  }

  get allFormOptions(): FormOption[] {
    return this.formGroups.flatMap(group => group.forms);
  }

  get selectedFormInfo(): FormOption | undefined {
    return this.allFormOptions.find(
      form => form.code === this.selectedForm
    );
  }

  get usedFormOptions(): FormOption[] {
    const used = this.currentFiler?.forms ?? [];

    return this.allFormOptions.filter(
      form =>
        used.includes(form.code) && this.matchesFormQuery(form)
    );
  }

  get visibleFormGroups(): FormGroup[] {
    const used = this.currentFiler?.forms ?? [];

    return this.formGroups
      .map(group => ({
        group: group.group,
        forms: group.forms.filter(
          form => !used.includes(form.code) && this.matchesFormQuery(form)
        ),
      }))
      .filter(group => group.forms.length > 0);
  }

  get yearNote(): string {
    return this.taxYear === 2025
      ? 'Current filing season.'
      : 'Prior year: late filing penalties may apply.';
  }

  get eFileDue(): string {
    const due = this.selectedFormInfo?.due ?? '';

    return this.taxYear === 2025 && /\d/.test(due)
      ? `${due}, 2026`
      : due;
  }

  private matchesFormQuery(form: FormOption): boolean {
    const query = this.formSearch.toLowerCase().trim();

    return (
      !query ||
      `${form.code} ${form.label}`.toLowerCase().includes(query)
    );
  }

  // Search recipients belonging to selected filer

  // Selected recipients
  get selectedRecipients(): Recipient[] {
    return this.recipients.filter(
      recipient =>
        recipient.filerId === this.selectedFilerId &&
        recipient.selected
    );
  }

  // Total of selected recipient amounts
  get recipientIssuesCount(): number {
    return this.selectedRecipients.filter(
      recipient => this.recipientIssues(recipient).length > 0
    ).length;
  }

  // Unanswered W-9 requests
  get totalWaitingW9(): number {
    return this.filers.reduce(
      (total, filer) => total + filer.w9Waiting,
      0
    );
  }

  // ==========================================================================
  // WIZARD STEPS
  // ==========================================================================

  readonly lastStep = 5;

  get stepNames(): string[] {
    return this.mode === 'bulk'
      ? ['Filer', 'Form and year', 'Upload file', 'Check data', 'Review']
      : ['Filer', 'Form and year', 'Recipients', 'Form details', 'Review'];
  }

  stepSummary(index: number): string {
    if (index === 1) {
      return this.currentFiler?.name ?? 'Choose who is filing';
    }

    if (index === 2) {
      return this.selectedForm
        ? `${this.selectedForm} · ${this.taxYear}`
        : 'Choose tax year and form';
    }

    if (this.mode === 'bulk') {
      if (index === 3) {
        return this.selectedFileName || 'Template or your own file';
      }

      if (index === 4) {
        return this.bulkRows.length
          ? `${this.bulkToProcess} rows to file`
          : 'Fix problems in the file';
      }

      return 'Check and add to cart';
    }

    if (index === 3) {
      const count = this.selectedRecipients.length;

      return count
        ? `${count} recipient${count > 1 ? 's' : ''}`
        : 'Choose who gets a form';
    }

    if (index === 4) {
      return this.step > 4 ? 'Amounts entered' : 'Enter box amounts';
    }

    return 'Check and add to cart';
  }

  // Prototype step gating: a step is clickable only when its inputs are ready
  canReach(index: number): boolean {
    if (index === 1) {
      return true;
    }

    if (index === 2) {
      return this.selectedFilerId !== null;
    }

    if (index === 3) {
      return this.selectedFilerId !== null && !!this.selectedForm;
    }

    if (this.mode === 'bulk') {
      if (index === 4) {
        return this.canReach(3) && !!this.selectedFileName;
      }

      return (
        this.canReach(4) &&
        this.bulkErrors === 0 &&
        this.bulkToProcess > 0
      );
    }

    if (index === 4) {
      return this.canReach(3) && this.selectedRecipients.length > 0;
    }

    return this.canReach(4) && this.amountsValid;
  }


  private matchers = new Map<string, ErrorStateMatcher>();
  matcher(key: string): ErrorStateMatcher {
    let m = this.matchers.get(key);
    if (!m) {
      m = { isErrorState: () => !!this.panelErrors[key] };
      this.matchers.set(key, m);
    }
    return m;
  }

  // Manual amount rows (Box 1/4/5/6/7) built from the selected recipients
  get amountRowsToUse(): NecAmountRow[] {
    return this.amountRows.length
      ? this.amountRows
      : this.buildAmountRows();
  }

  buildAmountRows(): NecAmountRow[] {
    const recipientWarning = (recipient: Recipient): string =>
      recipient.w9 !== 'Submitted' && recipient.type !== 'Unknown'
        ? 'No W-9 on file. Check whether backup withholding (24%) applied.'
        : '';

    return this.selectedRecipients.map(recipient => {
      const existing = this.amountRows.find(
        row => row.id === this.amountId(recipient)
      );

      if (existing) {
        return { ...existing };
      }

      return {
        id: this.amountId(recipient),
        name: recipient.name,
        tin: this.maskTin(recipient),
        address: `${recipient.address}, ${recipient.city} ${recipient.zip}`,
        box1: null,
        box4: null,
        box5: null,
        state: '',
        payerStateNumber: '',
        box7: null,
        box2: false,
        box3: null,
        accountNumber: '',
        secondTin: false,
        recipientIssues: this.recipientIssues(recipient),
        warning: recipientWarning(recipient),
        expanded: false
      };
    });
  }

  amountId(recipient: Recipient): string {
    return `recipient-${recipient.id}`;
  }

  rowRecipient(row: NecAmountRow): Recipient | undefined {
    return this.recipients.find(
      item => this.amountId(item) === row.id
    );
  }

  canEmailRow(row: NecAmountRow): boolean {
    const recipient = this.rowRecipient(row);

    return !!(recipient?.email && recipient?.econsent);
  }

  editAmountRow(row: NecAmountRow): void {
    this.amountRows = this.amountRows.map(item => ({
      ...item,
      expanded: item.id === row.id
    }));
    this.goStep(4);
  }

  amountRowErrors(row: NecAmountRow): string[] {
    return necRowErrors(row);
  }

  amountRowWarnings(row: NecAmountRow): string[] {
    return necRowWarnings(row);
  }

  get amountErrorCount(): number {
    return this.amountRowsToUse.filter(
      row => this.amountRowErrors(row).length > 0
    ).length;
  }

  get amountNoteCount(): number {
    return this.amountRowsToUse.filter(
      row =>
        this.amountRowErrors(row).length === 0 &&
        this.amountRowWarnings(row).length > 0
    ).length;
  }

  get amountsValid(): boolean {
    const rows = this.amountRowsToUse;

    return rows.length > 0 && this.amountErrorCount === 0;
  }

  fixRecipientRow(rowId: string): void {
    const recipient = this.recipients.find(
      item => this.amountId(item) === rowId
    );

    if (recipient) {
      this.openEditRecipient(recipient.id);
    }
  }

  box1Total(): number {
    return this.sumAmountRows('box1');
  }

  box4Total(): number {
    return this.sumAmountRows('box4');
  }

  private sumAmountRows(
    key: 'box1' | 'box4' | 'box5' | 'box7'
  ): number {
    return this.amountRowsToUse.reduce(
      (total, row) => total + (Number(row[key]) || 0),
      0
    );
  }

  get stateCopies(): string {
    const states = [
      ...new Set(
        this.amountRowsToUse
          .map(row => row.state)
          .filter(state => !!state)
      )
    ];

    return states.length ? `${states.join(', ')} included` : 'None';
  }

  // Recipient copy delivery (review step)
  delivery: Record<string, string> = {};

  copyFor(row: NecAmountRow): string {
    if (this.delivery[row.id]) {
      return this.delivery[row.id];
    }

    return this.canEmailRow(row) ? 'email' : 'mail';
  }

  setCopy(rowId: string, value: string): void {
    this.delivery[rowId] = value;
  }

  amountRowNotes(row: NecAmountRow): string[] {
    return this.amountRowWarnings(row);
  }

  onAmountRowsChange(rows: NecAmountRow[]): void {
    this.amountRows = rows;
  }

  previewAmounts(): void {
    this.notify(
      `Previewing Copy B for ${this.amountRowsToUse.length} recipient(s).`
    );
  }

  formCount(): number {
    return this.mode === 'bulk'
      ? this.bulkToProcess
      : this.amountRowsToUse.length;
  }

  // ==========================================================================
  // BULK IMPORT — CHECK DATA (step 4)
  // ==========================================================================

  bulkFilter: BulkFilter = 'all';
  bulkDelivery: 'auto' | 'mail' | 'self' = 'auto';

  bulkCopyFor(row: BulkRow): string {
    if (this.bulkDelivery === 'mail') {
      return 'Print and mail';
    }

    if (this.bulkDelivery === 'self') {
      return 'You deliver';
    }

    return row.email && row.consent ? 'Email' : 'Print and mail';
  }

  get bulkDeliveryNote(): string {
    if (this.bulkDelivery !== 'auto') {
      return '';
    }

    const email = this.bulkLiveRows.filter(
      row => this.bulkCopyFor(row) === 'Email'
    ).length;

    return `${email} by email, ${this.bulkToProcess - email} by mail`;
  }

  get bulkLiveRows(): BulkRow[] {
    return this.bulkRows.filter(row => !row.skip);
  }

  get bulkToProcess(): number {
    return this.bulkLiveRows.length;
  }

  get bulkErrors(): number {
    return this.bulkLiveRows.filter(row => row.error).length;
  }

  get bulkNotes(): number {
    return this.bulkLiveRows.filter(row => !row.error && row.note).length;
  }

  get bulkSkipped(): number {
    return this.bulkRows.length - this.bulkLiveRows.length;
  }

  get bulkNew(): number {
    return this.bulkLiveRows.filter(row => row.isNew).length;
  }

  get bulkMatched(): number {
    return this.bulkToProcess - this.bulkNew;
  }

  filerAddressLine(): string {
    const filer = this.currentFiler;

    return filer
      ? `${filer.address}, ${filer.city}, ${filer.state} ${filer.zip}`
      : '';
  }

  get bulkBox1(): number {
    return this.sumBulkColumn('box1');
  }

  get bulkBox4(): number {
    return this.sumBulkColumn('box4');
  }

  private sumBulkColumn(key: 'box1' | 'box4'): number {
    return this.bulkLiveRows.reduce(
      (total, row) => {
        const value = this.parseAmount(row[key]);

        return total + (value && !Number.isNaN(value) ? value : 0);
      },
      0
    );
  }

  get filteredBulkRows(): BulkRow[] {
    return this.bulkRows.filter(row => {
      if (this.bulkFilter === 'all') {
        return !row.skip;
      }

      if (this.bulkFilter === 'err') {
        return !row.skip && !!row.error;
      }

      if (this.bulkFilter === 'note') {
        return !row.skip && !row.error && !!row.note;
      }

      if (this.bulkFilter === 'new') {
        return !row.skip && row.isNew;
      }

      return row.skip;
    });
  }

  reviewBulkRows(): BulkRow[] {
    return this.bulkLiveRows.slice(0, 8);
  }

  useBulkFilter(filter: BulkFilter): void {
    this.bulkFilter = filter;
  }

  toggleBulkSkip(row: BulkRow): void {
    row.skip = !row.skip;

    if (this.bulkFilter === 'skip' && !row.skip) {
      this.bulkFilter = 'all';
    }

    this.recheckBulkRows();
  }

  skipBulkErrors(): void {
    this.bulkRows.forEach(row => {
      if (row.error) {
        row.skip = true;
      }
    });

    this.recheckBulkRows();
    this.bulkFilter = 'all';
    this.notify(
      'Rows with errors are skipped. Download the error report to fix them later.'
    );
  }

  updateBulkValue(
    row: BulkRow,
    field: 'tin' | 'state' | 'box1' | 'box4',
    value: string
  ): void {
    if (field === 'tin') {
      row.tin = value.replace(/\D/g, '').slice(0, 9);
    } else if (field === 'state') {
      row.state = value.trim().toUpperCase();
    } else {
      row[field] = value.trim();

      const amount = this.parseAmount(row[field]);

      if (amount !== null && !Number.isNaN(amount)) {
        row[field] = this.money(amount);
      }
    }

    this.recheckBulkRows();
  }

  private checkBulkRow(row: BulkRow): void {
    const errors: string[] = [];
    const notes: string[] = [];
    const fields = new Set<string>();

    const digits = row.tin.replace(/\D/g, '');

    if (digits.length !== 9) {
      errors.push(`TIN has ${digits.length} digits`);
      fields.add('tin');
    } else {
      const first = this.bulkRows.find(
        other => !other.skip && other.tin.replace(/\D/g, '') === digits
      );

      if (first && first !== row) {
        errors.push(
          `Same TIN as row ${first.line}. Remove one or combine the amounts.`
        );
        fields.add('tin');
      }
    }

    if (!this.stateOptions.some(state => state[0] === row.state)) {
      errors.push(`“${row.state || 'blank'}” isn't a US state`);
      fields.add('state');
    }

    const box1 = this.parseAmount(row.box1);

    if (box1 === null || Number.isNaN(box1)) {
      errors.push(`Box 1 “${row.box1}” isn't an amount`);
      fields.add('box1');
    } else if (box1 < 600) {
      notes.push('Below the $600 threshold for 2025');
    }

    const box4 = this.parseAmount(row.box4);

    if (Number.isNaN(box4)) {
      errors.push("Box 4 isn't an amount");
      fields.add('box4');
    } else if (box4 && box1 && box4 > box1) {
      errors.push('Box 4 is more than Box 1');
      fields.add('box4');
    }

    row.error = errors.join('. ');
    row.errorFields = row.skip ? [] : [...fields];
    row.note = notes.join(' ');
  }

  bulkBad(row: BulkRow, field: 'tin' | 'state' | 'box1' | 'box4'): boolean {
    return !row.skip && row.errorFields.includes(field);
  }

  private recheckBulkRows(): void {
    this.bulkRows.forEach(row => this.checkBulkRow(row));
  }

  parseAmount(value: string): number | null {
    if (value === '' || value == null) {
      return null;
    }

    return Number(String(value).replace(/[$,\s]/g, ''));
  }

  // ==========================================================================
  // WIZARD NAVIGATION
  // ==========================================================================

  // Start manual entry or bulk import
  startFiling(mode: FilingMode, filerId?: number): void {
    this.mode = mode;
    this.selectedFilerId = filerId ?? null;
    this.step = filerId ? 2 : 1;

    this.activeView = 'wizard';
    this.selectedForm = '';
    this.formSearch = '';
    this.recipientSearch = '';
    this.recipientFilter = 'all';
    this.selectedFileName = '';
    this.uploadedRows = 0;
    this.bulkRows = [];
    this.bulkFilter = 'all';
    this.bulkDelivery = 'auto';
    this.amountRows = [];
    this.delivery = {};
    this.showToast = false;

    this.recipients.forEach(recipient => {
      recipient.selected = false;
    });

    // Load recipients for pre-selected filer
    if (filerId != null) {
      this.loadRecipients(filerId);
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Return to dashboard
  goDashboard(): void {
    this.activeView = 'dashboard';

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  chooseFiler(id: number): void {
    if (this.selectedFilerId === id) {
      return;
    }

    this.selectedFilerId = id;
    this.selectedForm = '';
    this.amountRows = [];
    this.delivery = {};
    this.recipients.forEach(recipient => {
      recipient.selected = false;
    });

    // Load recipients for the selected filer from the API
    this.loadRecipients(id);
  }

  // Enter on the filer search takes the top match, like the prototype
  takeTopFilerMatch(): void {
    const top = this.filteredFilers[0];

    if (!top) {
      return;
    }

    this.chooseFiler(top.id);
    this.goStep(2);
  }

  chooseForm(code: string): void {
    console.log("code:", code)
    if (this.selectedForm === code) {
      return;
    }

    if (this.step > 3) {
      this.step = 3;
    }

    this.selectedForm = code;
    this.recipients.forEach(recipient => {
      recipient.selected = false;
    });
    this.amountRows = [];
    this.delivery = {};
  }

  chooseYear(year: number): void {
    this.taxYear = year;
  }

  changeFiler(): void {
    this.goStep(1);
  }

  toggleRecipient(recipient: Recipient): void {
    recipient.selected = !recipient.selected;
  }

  goStep(index: number): void {
    if (index === this.step || !this.canReach(index)) {
      return;
    }

    this.enterStep(index);
  }

  private enterStep(index: number): void {
    this.step = index;

    if (index === 4 && this.mode === 'manual') {
      this.amountRows = this.buildAmountRows();
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  get nextLabel(): string {
    if (this.step === 5) {
      const count = this.formCount();

      return `Add ${count} form${count === 1 ? '' : 's'} to cart`;
    }

    if (this.step === 4) {
      return 'Review';
    }

    if (this.step === 3) {
      if (this.mode === 'bulk') {
        const count = this.bulkRows.length || this.uploadedRows;

        return count ? `Check ${count} rows` : 'Check rows';
      }

      const count = this.selectedRecipients.length;

      return count ? `Enter amounts for ${count}` : 'Enter amounts';
    }

    return 'Continue';
  }

  get nextEnabled(): boolean {
    if (this.step === 5) {
      return this.formCount() > 0;
    }

    if (this.step === 4) {
      return this.mode === 'bulk'
        ? this.bulkErrors === 0 && this.bulkToProcess > 0
        : this.amountsValid;
    }

    return this.canReach(this.step + 1);
  }

  get footerMessage(): string {
    const filer = this.currentFiler;

    if (this.step === 1) {
      return filer
        ? `Filing for ${filer.name}, EIN ${this.formatEin(filer.ein)}`
        : 'Select a filer. Press Enter to take the top match.';
    }

    if (this.step === 2) {
      return this.selectedForm
        ? `${this.selectedForm} for tax year ${this.taxYear}`
        : 'Choose the form to file.';
    }

    if (this.step === 3) {
      if (this.mode === 'bulk') {
        return this.selectedFileName
          ? `${this.uploadedRows} rows ready to check`
          : 'Upload a file to continue.';
      }

      const count = this.selectedRecipients.length;

      if (!count) {
        return 'Select at least one recipient.';
      }

      const bad = this.selectedRecipients.filter(
        recipient => this.recipientIssues(recipient).length > 0
      ).length;

      if (bad) {
        return `${bad} selected recipient${bad > 1 ? 's need' : ' needs'} a fix before filing. You can still enter amounts now.`;
      }

      return `${count} recipient${count > 1 ? 's' : ''} selected`;
    }

    if (this.step === 4) {
      if (this.mode === 'bulk') {
        return this.bulkErrors
          ? `Fix or skip ${this.bulkErrors} row${this.bulkErrors > 1 ? 's' : ''} to continue. ${this.bulkToProcess - this.bulkErrors} rows are ready.`
          : `All ${this.bulkToProcess} rows ready${this.bulkNotes ? `, ${this.bulkNotes} with a note` : ''}.`;
      }

      const rows = this.amountRowsToUse.length;
      const bad = this.amountErrorCount;

      return bad
        ? `${rows - bad} of ${rows} ready. ${bad} need${bad === 1 ? 's' : ''} a fix before review.`
        : `All ${rows} form${rows > 1 ? 's' : ''} ready${this.amountNoteCount ? `, ${this.amountNoteCount} with a note to check` : ''}.`;
    }

    const count = this.formCount();

    return `${count} form${count > 1 ? 's' : ''} for ${filer?.name ?? 'this filer'}`;
  }

  // Wizard navigation
  nextStep(): void {
    if (!this.nextEnabled) {
      this.notify(this.footerMessage);
      return;
    }

    if (this.step === 5) {
      this.addToCart();
      return;
    }

    this.enterStep(this.step + 1);
  }

  previousStep(): void {
    if (this.step > 1) {
      this.enterStep(this.step - 1);
    }
  }

  addToCart(): void {
    const count = this.formCount();

    this.cartCount += count;
    this.doneCount = count;
    this.activeView = 'done';

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  get doneFiler(): Filer | undefined {
    return this.filers.find(filer => filer.id === this.selectedFilerId);
  }

  get doneHeading(): string {
    return `${this.doneCount} ${this.selectedForm} form${
      this.doneCount > 1 ? 's' : ''
    } added to cart`;
  }

  get doneDetail(): string {
    const imported =
      this.mode === 'bulk' && this.selectedFileName
        ? `, imported from ${this.selectedFileName}`
        : '';

    return `${
      this.doneFiler?.name ?? 'This filer'
    }, tax year ${this.taxYear}${imported}. Your cart now has ${
      this.cartCount
    } forms.`;
  }

  get sameFilerLabel(): string {
    const action =
      this.mode === 'bulk' ? 'Import another file' : 'Another form';

    return `${action} for ${this.doneFiler?.name ?? 'this filer'}`;
  }

  checkout(): void {
    this.notify('Checkout opened');
  }

  fileAgainSameFiler(): void {
    this.startFiling(this.mode, this.selectedFilerId ?? undefined);
  }

  fileAgainOtherFiler(): void {
    this.startFiling(this.mode);
  }

  keepPending(): void {
    this.notify('Kept as pending. Find it on the dashboard.');
    this.goDashboard();
  }

  saveAndExit(): void {
    this.notify('Draft saved as pending.');
    this.goDashboard();
  }

  toManualEntry(): void {
    this.mode = 'manual';
    this.bulkRows = [];
    this.amountRows = this.buildAmountRows();
    this.step = 3;
  }

  toBulkEntry(): void {
    this.mode = 'bulk';
    this.amountRows = [];
    this.recipients.forEach(recipient => {
      recipient.selected = false;
    });
    this.step = 3;
  }

  sendW9Requests(): void {
    const missing = this.selectedRecipients.filter(
      recipient => recipient.w9 !== 'Submitted'
    );

    missing.forEach(recipient => {
      recipient.w9 = 'Requested';
    });

    this.notify(
      missing.length
        ? `W-9 requests sent to ${missing.length} recipient(s).`
        : 'Every selected recipient already has a W-9 on file.'
    );
  }

  // Demo file selection
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      this.loadRows(file.name);
    }
  }

  loadDemoFile(): void {
    const filerName = this.currentFiler?.name.split(' ')[0] ?? 'taxseer';

    this.loadRows(`${filerName}-1099-NEC-${this.taxYear}.xlsx`);
  }

  private loadRows(fileName: string): void {
    this.selectedFileName = fileName;
    this.bulkRows = this.demoBulkRows();
    this.recheckBulkRows();
    this.uploadedRows = this.bulkRows.length;
    this.bulkFilter = this.bulkErrors ? 'err' : 'all';
  }

  private demoBulkRows(): BulkRow[] {
    const firstNames = [
      'Aaron', 'Bianca', 'Carlos', 'Dana', 'Elif', 'Farah', 'Grant', 'Hana',
      'Isaac', 'Jada', 'Kofi', 'Lena', 'Marco', 'Nia', 'Owen', 'Pooja',
      'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Victor', 'Wes', 'Ximena',
      'Yusuf', 'Zoe'
    ];
    const lastNames = [
      'Adams', 'Brooks', 'Chen', 'Diaz', 'Evans', 'Foster', 'Garcia',
      'Hughes', 'Iqbal', 'Jensen', 'Kim', 'Lopez', 'Moore', 'Nguyen',
      'Ortiz', 'Patel', 'Reyes', 'Shah', 'Turner', 'Vance'
    ];
    const cities: [string, string, string][] = [
      ['Rockville', 'MD', '20850'],
      ['Bethesda', 'MD', '20814'],
      ['Silver Spring', 'MD', '20910'],
      ['Columbia', 'MD', '21044'],
      ['Arlington', 'VA', '22201'],
      ['Washington', 'DC', '20001']
    ];
    const streets = ['Oak', 'Maple', 'Cedar', 'Pine'];
    const kinds = ['Design', 'Supply', 'Services', 'Consulting'];

    const saved = this.recipients.filter(
      recipient =>
        recipient.filerId === this.selectedFilerId &&
        this.recipientIssues(recipient).length === 0
    );

    const rows: BulkRow[] = [];

    for (let index = 0; index < 46; index++) {
      const known = saved[index];
      const city = cities[index % 6];
      const first = firstNames[index % 26];
      const last = lastNames[(index * 7) % 20];
      const isEin = index % 8 === 0;
      const amount = 1500 + ((index * 7331) % 24000);

      const row: BulkRow = known
        ? {
            line: index + 2,
            name: known.name,
            tin: known.tin,
            type: known.type === 'EIN' ? 'EIN' : 'SSN',
            address: known.address,
            city: known.city,
            state: known.state,
            zip: known.zip,
            email: known.email,
            consent: known.econsent,
            box1: this.money(amount),
            box4: index % 9 === 0 ? this.money(amount * 0.24) : '',
            isNew: false,
            error: '',
            errorFields: [],
            note: '',
            skip: false
          }
        : {
            line: index + 2,
            name: isEin
              ? `${last} ${kinds[index % 4]} LLC`
              : `${first} ${last}`,
            tin: String(300000000 + index * 1047291).slice(0, 9),
            type: isEin ? 'EIN' : 'SSN',
            address: `${100 + index * 3} ${streets[index % 4]} St`,
            city: city[0],
            state: city[1],
            zip: city[2],
            email:
              index % 3 ? `${first.toLowerCase()}.${last.toLowerCase()}@example.com` : '',
            consent: index % 3 === 1,
            box1: this.money(amount),
            box4: index % 9 === 0 ? this.money(amount * 0.24) : '',
            isNew: true,
            error: '',
            errorFields: [],
            note: '',
            skip: false
          };

      rows.push(row);
    }

    // Same problems the prototype plants in its sample spreadsheet.
    rows[6].tin = rows[6].tin.slice(0, 8);
    rows[13].state = 'MENDOZA';
    rows[21].box1 = '12,00O.00';
    rows[29].box1 = '450.00';
    rows[38].tin = rows[10].tin;

    rows.forEach(row => {
      row.isNew = !this.recipients.some(
        recipient => recipient.tin.replace(/\D/g, '') === row.tin.replace(/\D/g, '')
      );
    });

    return rows;
  }

  maskBulkTin(row: BulkRow): string {
    return row.type === 'SSN'
      ? `•••-••-${row.tin.slice(-4)}`
      : this.formatEin(row.tin);
  }

  money(value: number | null): string {
    return (Number(value) || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Display a toast message
  notify(message: string): void {
    this.toastMessage = message;
    this.showToast = true;

    clearTimeout(this.toastTimer);

    this.toastTimer = window.setTimeout(() => {
      this.showToast = false;
    }, 3200);
  }

  // Format EIN
  formatEin(ein: string): string {
    return ein.length === 9
      ? `${ein.slice(0, 2)}-${ein.slice(2)}`
      : ein;
  }

  // Mask recipient TIN
  maskTin(recipient: Recipient): string {
    const tin = recipient.tin;

    if (tin.length !== 9) {
      return tin;
    }

    return recipient.type === 'EIN'
      ? this.formatEin(tin)
      : `•••-••-${tin.slice(5)}`;
  }

  // ==========================================================================
  // PROTOTYPE DATA HELPERS
  // ==========================================================================

  readonly stateOptions: [string, string][] = US_STATES.map(code => [
    code,
    US_STATE_NAMES[code]
  ]);

  recipientIssues(recipient: Recipient): string[] {
    const issues: string[] = [];
    const digits = recipient.tin.replace(/\D/g, '');

    if (recipient.type !== 'Unknown' && digits.length !== 9) {
      issues.push(`TIN has ${digits.length} digits`);
    }

    if (recipient.type === 'Unknown') {
      issues.push('No TIN on file');
    }

    if (!this.stateOptions.some(state => state[0] === recipient.state)) {
      issues.push(`“${recipient.state || 'blank'}” isn't a US state`);
    }

    if (!recipient.city) {
      issues.push('City missing');
    }

    if (recipient.zip && !/^\d{5}(-?\d{4})?$/.test(recipient.zip)) {
      issues.push('ZIP format');
    }

    if (!recipient.zip) {
      issues.push('ZIP missing');
    }

    return issues;
  }

  // Deadline countdown anchored to the prototype's demo date
  private readonly today = new Date('2026-01-14T12:00:00');

  daysUntil(date: string): number {
    return Math.ceil(
      (new Date(`${date}T12:00:00`).getTime() - this.today.getTime()) /
        86400000
    );
  }

  get daysToFeb2(): number {
    return this.daysUntil('2026-02-02');
  }

  get daysToMar31(): number {
    return this.daysUntil('2026-03-31');
  }

  // Column mapping shown after a file is uploaded
  get mappedColumns(): [string, boolean][] {
    const optional = [
      'Email',
      'E-delivery Consent (Y/N)',
      'Box 4 Federal Tax Withheld',
      'Business Name'
    ];

    return this.templateColumns.filter(
      column => column[1] || optional.includes(column[0])
    );
  }

  // Step 3 and 4 only detail the 1099-NEC flow, like the prototype
  get necFlow(): boolean {
    return this.selectedForm === '1099-NEC';
  }

  // ==========================================================================
  // STEP 1 / DASHBOARD ROUTING
  // ==========================================================================

  get recentFilers(): Filer[] {
    return this.filteredFilers
      .filter(filer => filer.recent)
      .sort((a, b) => (a.recent ?? 0) - (b.recent ?? 0));
  }

  get otherFilers(): Filer[] {
    return this.filteredFilers.filter(filer => !filer.recent);
  }

  get filerGroups(): { label: string; filers: Filer[] }[] {
    const groups: { label: string; filers: Filer[] }[] = [];

    if (this.recentFilers.length) {
      groups.push({ label: 'Recently worked on', filers: this.recentFilers });
    }

    if (this.otherFilers.length) {
      groups.push({ label: 'All filers', filers: this.otherFilers });
    }

    return groups;
  }

  // Prototype: the first resume row drops into the amount step,
  // the rest only point at the saved filing.
  resume(index: number): void {
    if (index !== 0) {
      this.notify('Opens that filing at the step where it was left');
      return;
    }

    this.startFiling('manual', 1);
    this.selectedForm = '1099-NEC';
    this.taxYear = 2025;
    this.recipients.forEach(recipient => {
      recipient.selected = recipient.id === 1;
    });
    this.amountRows = this.buildAmountRows();
    this.step = 4;
  }

  newFilingFor(id: number): void {
    this.chooserFilerId = id;
    this.chooserOpen = true;
  }

  get chooserFiler(): Filer | undefined {
    return this.filers.find(filer => filer.id === this.chooserFilerId);
  }

  get chooserTitle(): string {
    const filer = this.chooserFiler;

    return filer ? `New filing for ${filer.name}` : 'New filing';
  }

  get chooserSub(): string {
    const filer = this.chooserFiler;

    return filer
      ? `EIN ${this.formatEin(filer.ein)} · ${filer.city}, ${filer.state}`
      : '';
  }

  closeChooser(): void {
    this.chooserOpen = false;
    this.chooserFilerId = null;
  }

  startFromChooser(mode: FilingMode): void {
    const filerId = this.chooserFilerId;

    this.chooserOpen = false;
    this.startFiling(mode, filerId ?? undefined);
  }

  goFiler(id: number): void {
    this.router.navigate(['/taxseer', 'filers', id]);
  }

  goFilerRecipients(id: number): void {
    this.router.navigate(['/taxseer', 'filers', id], {
      queryParams: { tab: 'recipients' }
    });
  }

  downloadTemplate(code: string): void {
    this.notify(
      code === '1099-NEC'
        ? `Downloaded ${code} template for tax year ${this.taxYear}.`
        : `Downloading TaxSeer's ${code} Excel template.`
    );
  }

  // ==========================================================================
  // RIGHT-SIDE PANELS (filer and recipient add / edit)
  // ==========================================================================

  panelOpen = false;
  panelKind: 'filer' | 'recipient' = 'filer';
  panelEditing = false;
  panelTitle = '';
  panelErrors: Record<string, string> = {};

  filerForm: Filer = this.blankFiler();
  recipientForm: Recipient = this.blankRecipient(1);

  private panelFilerId: number | null = null;
  private panelRecipientId: number | null = null;

  private blankFiler(): Filer {
    return {
      id: 0,
      name: '',
      ein: '',
      address: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
      email: '',
      stateNo: '',
      forms: [],
      pending: 0,
      filed: 0,
      w9Total: 0,
      w9Received: 0,
      w9Waiting: 0
    };
  }

  private blankRecipient(filerId: number): Recipient {
    return {
      id: 0,
      filerId,
      name: '',
      first: '',
      middle: '',
      last: '',
      dba: '',
      tin: '',
      type: 'SSN',
      country: 'US',
      address: '',
      address2: '',
      city: '',
      state: '',
      zip: '',
      email: '',
      econsent: false,
      w9: 'Not requested',
      selected: false
    };
  }

  openAddFiler(): void {
    this.panelKind = 'filer';
    this.panelEditing = false;
    this.panelFilerId = null;
    this.panelTitle = 'Add filer';
    this.panelErrors = {};
    this.filerForm = this.blankFiler();
    this.panelOpen = true;
    console.log(this.panelOpen)
  }

  openEditFiler(id: number): void {
    const filer = this.filers.find(item => item.id === id);

    if (!filer) {
      return;
    }

    this.panelKind = 'filer';
    this.panelEditing = true;
    this.panelFilerId = id;
    this.panelTitle = 'Edit filer';
    this.panelErrors = {};
    this.filerForm = { ...filer, ein: this.formatEin(filer.ein), forms: [...filer.forms] };
    this.panelOpen = true;
  }

  openAddRecipient(): void {
    this.panelKind = 'recipient';
    this.panelEditing = false;
    this.panelRecipientId = null;
    this.panelTitle = 'Add recipient';
    this.panelErrors = {};
    this.recipientForm = this.blankRecipient(this.selectedFilerId ?? 1);
    this.panelOpen = true;
  }

  openEditRecipient(id: number): void {
    const recipient = this.recipients.find(item => item.id === id);

    if (!recipient) {
      return;
    }

    this.panelKind = 'recipient';
    this.panelEditing = true;
    this.panelRecipientId = id;
    this.panelTitle = 'Edit recipient';
    this.panelErrors = {};
    this.recipientForm = {
      ...recipient,
      first: recipient.first ?? splitName(recipient.name)[0],
      middle: recipient.middle ?? splitName(recipient.name)[1],
      last: recipient.last ?? splitName(recipient.name)[2],
      tin: this.formatTin(recipient.tin.replace(/\D/g, ''), recipient.type),
      country: recipient.country ?? 'US'
    };
    this.panelOpen = true;
  }

  closePanel(): void {
    this.panelOpen = false;
    this.panelErrors = {};
  }

  readonly tinTypes: [TinType, string][] = [
    ['SSN', 'SSN (individual)'],
    ['EIN', 'EIN (business)'],
    ['Unknown', "Don't have it yet"]
  ];

  get isBusinessRecipient(): boolean {
    return this.recipientForm.type === 'EIN';
  }

  get isUnknownTin(): boolean {
    return this.recipientForm.type === 'Unknown';
  }

  get panelTinLabel(): string {
    return this.panelKind === 'filer' ? 'EIN' : this.recipientForm.type;
  }

  get panelRecipientIssues(): string[] {
    return this.panelEditing && this.panelKind === 'recipient'
      ? this.recipientIssues(this.recipientForm)
      : [];
  }

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    if (this.panelOpen) {
      this.closePanel();
    } else if (this.chooserOpen) {
      this.closeChooser();
    }
  }

  onPanelTin(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 9);

    if (this.panelKind === 'recipient') {
      this.recipientForm.tin = this.formatTin(digits, this.recipientForm.type);
    } else {
      this.filerForm.ein = this.formatEin(digits.slice(0, 9));
    }
  }

  formatTin(digits: string, type: TinType): string {
    if (type === 'EIN') {
      return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
    }

    if (digits.length > 5) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    }

    if (digits.length > 3) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    return digits;
  }

  get panelTinPlaceholder(): string {
    const type = this.recipientForm.type;

    return type === 'EIN' ? '12-3456789' : '123-45-6789';
  }

  saveFiler(): void {
    const form = this.filerForm;
    const ein = form.ein.replace(/\D/g, '');
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors['name'] = 'Enter the legal name.';
    }

    if (ein.length !== 9) {
      errors['ein'] = `EIN must be 9 digits. You entered ${ein.length}.`;
    } else if (
      this.filers.some(
        item => item.ein === ein && item.id !== this.panelFilerId
      )
    ) {
      errors['ein'] = 'Another filer on this account already uses this EIN.';
    }

    if (!form.address.trim()) {
      errors['address'] = 'Enter a street address.';
    }

    if (!form.city.trim()) {
      errors['city'] = 'Enter a city.';
    }

    if (!this.stateOptions.some(state => state[0] === form.state)) {
      errors['state'] = 'Choose a state.';
    }

    if (!/^\d{5}(-?\d{4})?$/.test(form.zip)) {
      errors['zip'] = '5 or 9 digits.';
    }

    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      errors['email'] = 'Check the email address.';
    }

    this.panelErrors = errors;

    if (Object.keys(errors).length) {
      return;
    }

    form.name = form.name.trim();
    form.ein = ein;

    const existing = this.filers.find(
      filer => filer.id === this.panelFilerId
    );

    if (existing) {
      Object.assign(existing, form);
      delete existing.warn;
      this.notify(`${form.name} updated`);
    } else {
      form.id = Date.now();
      form.warn = undefined;
      this.filers.push(form);
      this.notify(`${form.name} added`);

      if (this.activeView === 'wizard' && this.step === 1) {
        this.selectedFilerId = form.id;
      }
    }

    this.closePanel();
  }

  saveRecipient(withW9?: boolean): void {
    const form = this.recipientForm;
    const tin = form.tin.replace(/\D/g, '');

    if (form.type !== 'EIN') {
      form.name = [form.first, form.middle, form.last]
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    const errors: Record<string, string> = {};

    if (form.type !== 'Unknown' && tin.length !== 9) {
      errors['tin'] = `${form.type} must be 9 digits. You entered ${tin.length}.`;
    }

    if (
      form.type === 'EIN'
        ? !form.name.trim()
        : !(form.first?.trim() && form.last?.trim())
    ) {
      errors['name'] =
        form.type === 'EIN'
          ? 'Enter the business name.'
          : 'Enter first and last name.';
    }

    if (!form.address.trim()) {
      errors['address'] = 'Enter a street address.';
    }

    if (!form.city.trim()) {
      errors['city'] = 'Enter a city.';
    }

    if (form.country !== 'FOREIGN') {
      if (!this.stateOptions.some(state => state[0] === form.state)) {
        errors['state'] = 'Choose a state.';
      }

      if (!/^\d{5}(-?\d{4})?$/.test(form.zip)) {
        errors['zip'] = '5 or 9 digits.';
      }
    }

    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      errors['email'] = 'Check the email address.';
    }

    if (withW9 && !form.email) {
      errors['email'] = 'Add an email to send the W-9 request.';
    }

    this.panelErrors = errors;

    if (Object.keys(errors).length) {
      return;
    }

    form.name = form.name.trim();
    form.tin = tin;

    if (withW9) {
      form.w9 = 'Requested';
    }

    const existing = this.recipients.find(
      recipient => recipient.id === this.panelRecipientId
    );

    if (existing) {
      Object.assign(existing, form);
      this.notify(`${form.name} updated`);
    } else {
      form.id = this.nextRecipientId();
      form.filerId = this.selectedFilerId ?? form.filerId;
      form.selected = true;
      this.recipients.push(form);
      this.notify(
        `${form.name} added and selected${withW9 ? '. W-9 request sent.' : ''}`
      );
    }

    this.closePanel();
  }

  private nextRecipientId(): number {
    return this.recipients.reduce(
      (highest, recipient) => Math.max(highest, recipient.id),
      0
    ) + 1;
  }

  // Recipient list filtering (step 3)
  recipientFilter: 'all' | 'ready' | 'fix' | 'now9' = 'all';

  readonly recipientFilters: ['all' | 'ready' | 'fix' | 'now9', string][] = [
    ['all', 'All'],
    ['ready', 'Ready'],
    ['fix', 'Needs a fix'],
    ['now9', 'No W-9']
  ];

  w9Class(recipient: Recipient): string {
    if (recipient.w9 === 'Submitted') {
      return 'p-ok';
    }

    return recipient.w9 === 'Requested' ? 'p-warn' : 'p-neutral';
  }

  get filerHasRecipients(): boolean {
    return this.recipients.some(
      recipient => recipient.filerId === this.selectedFilerId
    );
  }

  get visibleRecipients(): Recipient[] {
    const query = this.recipientSearch.toLowerCase().trim();

    return this.recipients.filter(recipient => {
      if (recipient.filerId !== this.selectedFilerId) {
        return false;
      }

      if (
        query &&
        !`${recipient.name} ${recipient.tin.slice(-4)}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }

      const issues = this.recipientIssues(recipient).length;

      if (this.recipientFilter === 'ready') {
        return issues === 0;
      }

      if (this.recipientFilter === 'fix') {
        return issues > 0;
      }

      if (this.recipientFilter === 'now9') {
        return recipient.w9 !== 'Submitted';
      }

      return true;
    });
  }

  get allVisibleSelected(): boolean {
    const shown = this.visibleRecipients;

    return shown.length > 0 && shown.every(recipient => recipient.selected);
  }

  toggleAllRecipients(): void {
    const select = !this.allVisibleSelected;

    this.visibleRecipients.forEach(recipient => {
      recipient.selected = select;
    });
  }

}
