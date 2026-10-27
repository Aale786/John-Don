import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorStateMatcher } from '@angular/material/core';
import { FilerService } from '../../../../core/api-service/filer.service';
import { RecipientService } from '../../../../core/api-service/recipient.service';
import { NecAmountRow, necRowErrors, necRowWarnings } from './nec-amounts.types';
import { US_STATE_NAMES, US_STATES } from '../../data/taxseer-filers.data';
import { isCompleteTin, normalizeTin } from '../../../../core/validation/tin';
import { FilerFiling } from '../filer-details/filer-details.data';

// ─── Exported Types ───────────────────────────────────────────────────────────

export type FilingMode = 'manual' | 'bulk';
export type TinType = 'SSN' | 'EIN' | 'Unknown';
export type BulkFilter = 'all' | 'err' | 'note' | 'new' | 'skip';

export type Filer = {
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

export type Recipient = {
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

export type BulkRow = {
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

export type FormOption = { code: string; label: string; due: string };
export type FormGroup = { group: string; forms: FormOption[] };
export type ResumeItem = {
  id: number;
  name: string;
  form: string;
  done: number;
  total: number;
  detail: string;
  when: string;
};

// ─── Private helper ───────────────────────────────────────────────────────────

function splitName(name: string): [string, string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return [parts[0] ?? '', '', ''];
  return [parts[0], parts.slice(1, -1).join(' '), parts[parts.length - 1]];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly router = inject(Router);
  private readonly filerService = inject(FilerService);
  private readonly recipientService = inject(RecipientService);

  // ── Private writable signals ──────────────────────────────────────────────

  private readonly _activeView = signal<'dashboard' | 'wizard' | 'done'>('dashboard');
  private readonly _step = signal(1);
  private readonly _mode = signal<FilingMode>('manual');
  private readonly _taxYear = signal(2025);
  private readonly _selectedFilerId = signal<number | null>(null);
  private readonly _selectedForm = signal('');
  private readonly _formSearch = signal('');
  private readonly _filerSearch = signal('');
  private readonly _recipientSearch = signal('');

  private readonly _filers = signal<Filer[]>([]);
  private readonly _recipients = signal<Recipient[]>([]);
  private readonly _amountRows = signal<NecAmountRow[]>([]);
  private readonly _bulkRows = signal<BulkRow[]>([]);

  private readonly _selectedFileName = signal('');
  private readonly _uploadedRows = signal(0);
  private readonly _bulkFilter = signal<BulkFilter>('all');
  private readonly _bulkDelivery = signal<'auto' | 'mail' | 'self'>('auto');

  private readonly _recipientFilter = signal<'all' | 'ready' | 'fix' | 'now9'>('all');
  private readonly _delivery = signal<Record<string, string>>({});

  private readonly _cartCount = signal(52);
  private readonly _walletBalance = signal(100);
  private readonly _toastMessage = signal('');
  private readonly _showToast = signal(false);
  private _toastTimer?: number;

  private readonly _chooserOpen = signal(false);
  private readonly _chooserFilerId = signal<number | null>(null);

  private readonly _panelOpen = signal(false);
  private readonly _panelKind = signal<'filer' | 'recipient'>('filer');
  private readonly _panelEditing = signal(false);
  private readonly _panelTitle = signal('');
  private readonly _panelErrors = signal<Record<string, string>>({});

  private readonly _filerForm = signal<Filer>(this.blankFiler());
  private readonly _recipientForm = signal<Recipient>(this.blankRecipient(1));

  private readonly _doneCount = signal(0);

  // Plain private fields (not signals)
  private panelFilerId: number | null = null;
  private panelRecipientId: number | null = null;

  // ── Public read-only signal surfaces ─────────────────────────────────────

  readonly activeView = this._activeView.asReadonly();
  readonly step = this._step.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly taxYear = this._taxYear.asReadonly();
  readonly selectedFilerId = this._selectedFilerId.asReadonly();
  readonly selectedForm = this._selectedForm.asReadonly();
  readonly formSearch = this._formSearch.asReadonly();
  readonly filerSearch = this._filerSearch.asReadonly();
  readonly recipientSearch = this._recipientSearch.asReadonly();

  readonly filers = this._filers.asReadonly();
  readonly recipients = this._recipients.asReadonly();
  readonly amountRows = this._amountRows.asReadonly();
  readonly bulkRows = this._bulkRows.asReadonly();

  readonly selectedFileName = this._selectedFileName.asReadonly();
  readonly uploadedRows = this._uploadedRows.asReadonly();
  readonly bulkFilter = this._bulkFilter.asReadonly();
  readonly bulkDelivery = this._bulkDelivery.asReadonly();

  readonly recipientFilter = this._recipientFilter.asReadonly();
  readonly delivery = this._delivery.asReadonly();

  readonly cartCount = this._cartCount.asReadonly();
  readonly walletBalance = this._walletBalance.asReadonly();
  readonly toastMessage = this._toastMessage.asReadonly();
  readonly showToast = this._showToast.asReadonly();

  readonly chooserOpen = this._chooserOpen.asReadonly();
  readonly chooserFilerId = this._chooserFilerId.asReadonly();

  readonly panelOpen = this._panelOpen.asReadonly();
  readonly panelKind = this._panelKind.asReadonly();
  readonly panelEditing = this._panelEditing.asReadonly();
  readonly panelTitle = this._panelTitle.asReadonly();
  readonly panelErrors = this._panelErrors.asReadonly();

  readonly filerForm = this._filerForm.asReadonly();
  readonly recipientForm = this._recipientForm.asReadonly();
  readonly doneCount = this._doneCount.asReadonly();

  // ── Setter methods ────────────────────────────────────────────────────────

  setActiveView(v: 'dashboard' | 'wizard' | 'done'): void { this._activeView.set(v); }
  setStep(n: number): void { this._step.set(n); }
  setMode(m: FilingMode): void { this._mode.set(m); }
  setTaxYear(y: number): void { this._taxYear.set(y); }
  setSelectedFilerId(id: number | null): void { this._selectedFilerId.set(id); }
  setSelectedForm(code: string): void { this._selectedForm.set(code); }
  setFilerSearch(q: string): void { this._filerSearch.set(q); }
  setRecipientSearch(q: string): void { this._recipientSearch.set(q); }
  setFormSearch(q: string): void { this._formSearch.set(q); }
  setAmountRows(rows: NecAmountRow[]): void { this._amountRows.set(rows); }
  setBulkRows(rows: BulkRow[]): void { this._bulkRows.set(rows); }
  setSelectedFileName(name: string): void { this._selectedFileName.set(name); }
  setUploadedRows(n: number): void { this._uploadedRows.set(n); }
  setBulkFilter(f: BulkFilter): void { this._bulkFilter.set(f); }
  setBulkDelivery(v: 'auto' | 'mail' | 'self'): void { this._bulkDelivery.set(v); }
  setRecipientFilter(v: 'all' | 'ready' | 'fix' | 'now9'): void { this._recipientFilter.set(v); }
  setCartCount(n: number): void { this._cartCount.set(n); }
  setChooserOpen(open: boolean): void { this._chooserOpen.set(open); }
  setChooserFilerId(id: number | null): void { this._chooserFilerId.set(id); }
  setPanelOpen(open: boolean): void { this._panelOpen.set(open); }
  setPanelKind(k: 'filer' | 'recipient'): void { this._panelKind.set(k); }
  setPanelEditing(v: boolean): void { this._panelEditing.set(v); }
  setPanelTitle(t: string): void { this._panelTitle.set(t); }
  setPanelErrors(errors: Record<string, string>): void { this._panelErrors.set(errors); }
  setDoneCount(n: number): void { this._doneCount.set(n); }

  setDelivery(rowId: string, value: string): void {
    this._delivery.update(d => ({ ...d, [rowId]: value }));
  }

  updateFilerForm(updater: (f: Filer) => Filer): void { this._filerForm.update(updater); }
  updateRecipientForm(updater: (r: Recipient) => Recipient): void { this._recipientForm.update(updater); }

  /** Convenience field update helpers for templates */
  updateFilerField<K extends keyof Filer>(key: K, value: Filer[K]): void {
    this._filerForm.update(f => ({ ...f, [key]: value }));
  }

  updateRecipientField<K extends keyof Recipient>(key: K, value: Recipient[K]): void {
    this._recipientForm.update(r => ({ ...r, [key]: value }));
  }

  // ── Static readonly data ──────────────────────────────────────────────────

  readonly taxYears = [2025, 2024, 2023];

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

  readonly formGroups: FormGroup[] = [
    {
      group: '1099 series',
      forms: [
        { code: '1099-NEC', label: 'Nonemployee compensation', due: 'Feb 2' },
        { code: '1099-MISC', label: 'Rents, royalties, other income', due: 'Mar 31' },
        { code: '1099-INT', label: 'Interest income', due: 'Mar 31' },
        { code: '1099-DIV', label: 'Dividends and distributions', due: 'Mar 31' },
        { code: '1099-R', label: 'Pensions, annuities, IRAs', due: 'Mar 31' },
        { code: '1099-K', label: 'Payment card and network transactions', due: 'Mar 31' },
        { code: '1099-B', label: 'Broker and barter transactions', due: 'Mar 31' },
        { code: '1099-C', label: 'Cancellation of debt', due: 'Mar 31' },
        { code: '1099-A', label: 'Acquisition or abandonment of property', due: 'Mar 31' },
        { code: '1099-G', label: 'Certain government payments', due: 'Mar 31' },
        { code: '1099-OID', label: 'Original issue discount', due: 'Mar 31' },
        { code: '1099-PATR', label: 'Distributions from cooperatives', due: 'Mar 31' },
        { code: '1099-Q', label: 'Qualified education program payments', due: 'Mar 31' },
        { code: '1099-CAP', label: 'Changes in corporate control', due: 'Mar 31' },
        { code: '1099-H', label: 'Health coverage tax credit advances', due: 'Mar 31' },
      ]
    },
    {
      group: 'Wage statements',
      forms: [
        { code: 'W-2', label: 'Wage and tax statement', due: 'Feb 2' },
        { code: 'W-2C', label: 'Corrected wage and tax statement', due: 'As needed' },
      ]
    },
    {
      group: 'ACA',
      forms: [
        { code: '1095-C', label: 'Employer-provided coverage (1094-C created for you)', due: 'Mar 31' },
        { code: '1095-B', label: 'Health coverage (1094-B created for you)', due: 'Mar 31' },
      ]
    },
    {
      group: 'Extensions',
      forms: [
        { code: '8809', label: 'Extension of time to file information returns', due: 'Before due date' },
      ]
    }
  ];

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
    ['2nd TIN Notice (Y/N)', false],
  ];

  readonly stateOptions: [string, string][] = US_STATES.map(code => [code, US_STATE_NAMES[code]]);

  readonly tinTypes: [TinType, string][] = [
    ['SSN', 'SSN (individual)'],
    ['EIN', 'EIN (business)'],
    ['Unknown', "Don't have it yet"],
  ];

  readonly recipientFilters: ['all' | 'ready' | 'fix' | 'now9', string][] = [
    ['all', 'All'],
    ['ready', 'Ready'],
    ['fix', 'Needs a fix'],
    ['now9', 'No W-9'],
  ];

  readonly necStates = US_STATES;

  readonly lastStep = 5;

  // ── Computed signals ──────────────────────────────────────────────────────

  readonly currentFiler = computed(() =>
    this._filers().find(f => f.id === this._selectedFilerId())
  );

  readonly filteredFilers = computed(() => {
    const query = this._filerSearch().toLowerCase().replace(/-/g, '').trim();
    return this._filers().filter(filer =>
      `${filer.name} ${filer.ein}`.toLowerCase().replace(/-/g, '').includes(query)
    );
  });

  readonly allFormOptions = computed(() =>
    this.formGroups.flatMap(g => g.forms)
  );

  readonly selectedFormInfo = computed(() =>
    this.allFormOptions().find(f => f.code === this._selectedForm())
  );

  readonly usedFormOptions = computed(() => {
    const used = this.currentFiler()?.forms ?? [];
    return this.allFormOptions().filter(form => used.includes(form.code) && this.matchesFormQuery(form));
  });

  readonly visibleFormGroups = computed(() => {
    const used = this.currentFiler()?.forms ?? [];
    return this.formGroups
      .map(group => ({
        group: group.group,
        forms: group.forms.filter(form => !used.includes(form.code) && this.matchesFormQuery(form)),
      }))
      .filter(group => group.forms.length > 0);
  });

  readonly yearNote = computed(() =>
    this._taxYear() === 2025
      ? 'Current filing season.'
      : 'Prior year: late filing penalties may apply.'
  );

  readonly eFileDue = computed(() => {
    const due = this.selectedFormInfo()?.due ?? '';
    return this._taxYear() === 2025 && /\d/.test(due) ? `${due}, 2026` : due;
  });

  readonly selectedRecipients = computed(() =>
    this._recipients().filter(r => r.filerId === this._selectedFilerId() && r.selected)
  );

  readonly recipientIssuesCount = computed(() =>
    this.selectedRecipients().filter(r => this.recipientIssues(r).length > 0).length
  );

  readonly totalWaitingW9 = computed(() =>
    this._filers().reduce((t, f) => t + f.w9Waiting, 0)
  );

  readonly stepNames = computed(() =>
    this._mode() === 'bulk'
      ? ['Filer', 'Form and year', 'Upload file', 'Check data', 'Review']
      : ['Filer', 'Form and year', 'Recipients', 'Form details', 'Review']
  );

  readonly nextLabel = computed(() => {
    if (this._step() === 5) {
      const count = this.formCount();
      return `Add ${count} form${count === 1 ? '' : 's'} to cart`;
    }
    if (this._step() === 4) return 'Review';
    if (this._step() === 3) {
      if (this._mode() === 'bulk') {
        const count = this._bulkRows().length || this._uploadedRows();
        return count ? `Check ${count} rows` : 'Check rows';
      }
      const count = this.selectedRecipients().length;
      return count ? `Enter amounts for ${count}` : 'Enter amounts';
    }
    return 'Continue';
  });

  readonly nextEnabled = computed(() => {
    if (this._step() === 5) return this.formCount() > 0;
    if (this._step() === 4) {
      return this._mode() === 'bulk'
        ? this.bulkErrors() === 0 && this.bulkToProcess() > 0
        : this.amountsValid();
    }
    return this.canReach(this._step() + 1);
  });

  readonly footerMessage = computed(() => {
    const filer = this.currentFiler();
    if (this._step() === 1) {
      return filer
        ? `Filing for ${filer.name}, EIN ${this.formatEin(filer.ein)}`
        : 'Select a filer. Press Enter to take the top match.';
    }
    if (this._step() === 2) {
      return this._selectedForm()
        ? `${this._selectedForm()} for tax year ${this._taxYear()}`
        : 'Choose the form to file.';
    }
    if (this._step() === 3) {
      if (this._mode() === 'bulk') {
        return this._selectedFileName()
          ? `${this._uploadedRows()} rows ready to check`
          : 'Upload a file to continue.';
      }
      const count = this.selectedRecipients().length;
      if (!count) return 'Select at least one recipient.';
      const bad = this.selectedRecipients().filter(r => this.recipientIssues(r).length > 0).length;
      if (bad) {
        return `${bad} selected recipient${bad > 1 ? 's need' : ' needs'} a fix before filing. You can still enter amounts now.`;
      }
      return `${count} recipient${count > 1 ? 's' : ''} selected`;
    }
    if (this._step() === 4) {
      if (this._mode() === 'bulk') {
        return this.bulkErrors()
          ? `Fix or skip ${this.bulkErrors()} row${this.bulkErrors() > 1 ? 's' : ''} to continue. ${this.bulkToProcess() - this.bulkErrors()} rows are ready.`
          : `All ${this.bulkToProcess()} rows ready${this.bulkNotes() ? `, ${this.bulkNotes()} with a note` : ''}.`;
      }
      const rows = this.amountRowsToUse().length;
      const bad = this.amountErrorCount();
      return bad
        ? `${rows - bad} of ${rows} ready. ${bad} need${bad === 1 ? 's' : ''} a fix before review.`
        : `All ${rows} form${rows > 1 ? 's' : ''} ready${this.amountNoteCount() ? `, ${this.amountNoteCount()} with a note to check` : ''}.`;
    }
    const count = this.formCount();
    return `${count} form${count > 1 ? 's' : ''} for ${filer?.name ?? 'this filer'}`;
  });

  readonly doneFiler = computed(() =>
    this._filers().find(f => f.id === this._selectedFilerId())
  );

  readonly doneHeading = computed(() =>
    `${this._doneCount()} ${this._selectedForm()} form${this._doneCount() > 1 ? 's' : ''} added to cart`
  );

  readonly doneDetail = computed(() => {
    const imported = this._mode() === 'bulk' && this._selectedFileName()
      ? `, imported from ${this._selectedFileName()}`
      : '';
    return `${this.doneFiler()?.name ?? 'This filer'}, tax year ${this._taxYear()}${imported}. Your cart now has ${this._cartCount()} forms.`;
  });

  readonly sameFilerLabel = computed(() => {
    const action = this._mode() === 'bulk' ? 'Import another file' : 'Another form';
    return `${action} for ${this.doneFiler()?.name ?? 'this filer'}`;
  });

  readonly amountRowsToUse = computed(() =>
    this._amountRows().length ? this._amountRows() : this.buildAmountRows()
  );

  readonly amountErrorCount = computed(() =>
    this.amountRowsToUse().filter(row => this.amountRowErrors(row).length > 0).length
  );

  readonly amountNoteCount = computed(() =>
    this.amountRowsToUse().filter(row =>
      this.amountRowErrors(row).length === 0 && this.amountRowWarnings(row).length > 0
    ).length
  );

  readonly amountsValid = computed(() => {
    const rows = this.amountRowsToUse();
    return rows.length > 0 && this.amountErrorCount() === 0;
  });

  readonly necTotalBox1 = computed(() => this.sumAmountRows('box1'));
  readonly necTotalBox4 = computed(() => this.sumAmountRows('box4'));
  readonly necTotalBox5 = computed(() => this.sumAmountRows('box5'));
  readonly necTotalBox7 = computed(() => this.sumAmountRows('box7'));

  readonly stateCopies = computed(() => {
    const states = [...new Set(
      this.amountRowsToUse().map(row => row.state).filter(s => !!s)
    )];
    return states.length ? `${states.join(', ')} included` : 'None';
  });

  readonly bulkLiveRows = computed(() => this._bulkRows().filter(r => !r.skip));
  readonly bulkToProcess = computed(() => this.bulkLiveRows().length);
  readonly bulkErrors = computed(() => this.bulkLiveRows().filter(r => r.error).length);
  readonly bulkNotes = computed(() => this.bulkLiveRows().filter(r => !r.error && r.note).length);
  readonly bulkSkipped = computed(() => this._bulkRows().length - this.bulkLiveRows().length);
  readonly bulkNew = computed(() => this.bulkLiveRows().filter(r => r.isNew).length);
  readonly bulkMatched = computed(() => this.bulkToProcess() - this.bulkNew());
  readonly bulkBox1 = computed(() => this.sumBulkColumn('box1'));
  readonly bulkBox4 = computed(() => this.sumBulkColumn('box4'));

  readonly filteredBulkRows = computed(() =>
    this._bulkRows().filter(row => {
      if (this._bulkFilter() === 'all') return !row.skip;
      if (this._bulkFilter() === 'err') return !row.skip && !!row.error;
      if (this._bulkFilter() === 'note') return !row.skip && !row.error && !!row.note;
      if (this._bulkFilter() === 'new') return !row.skip && row.isNew;
      return row.skip;
    })
  );

  readonly bulkDeliveryNote = computed(() => {
    if (this._bulkDelivery() !== 'auto') return '';
    const email = this.bulkLiveRows().filter(row => this.bulkCopyFor(row) === 'Email').length;
    return `${email} by email, ${this.bulkToProcess() - email} by mail`;
  });

  readonly mappedColumns = computed(() => {
    const optional = ['Email', 'E-delivery Consent (Y/N)', 'Box 4 Federal Tax Withheld', 'Business Name'];
    return this.templateColumns.filter(column => column[1] || optional.includes(column[0]));
  });

  readonly necFlow = computed(() => this._selectedForm() === '1099-NEC');

  readonly recentFilers = computed(() =>
    this.filteredFilers().filter(f => f.recent).sort((a, b) => (a.recent ?? 0) - (b.recent ?? 0))
  );

  readonly otherFilers = computed(() =>
    this.filteredFilers().filter(f => !f.recent)
  );

  readonly filerGroups = computed(() => {
    const groups: { label: string; filers: Filer[] }[] = [];
    if (this.recentFilers().length) groups.push({ label: 'Recently worked on', filers: this.recentFilers() });
    if (this.otherFilers().length) groups.push({ label: 'All filers', filers: this.otherFilers() });
    return groups;
  });

  readonly visibleRecipients = computed(() => {
    const query = this._recipientSearch().toLowerCase().trim();
    return this._recipients().filter(recipient => {
      if (recipient.filerId !== this._selectedFilerId()) return false;
      if (query && !`${recipient.name} ${recipient.tin.slice(-4)}`.toLowerCase().includes(query)) return false;
      const issues = this.recipientIssues(recipient).length;
      if (this._recipientFilter() === 'ready') return issues === 0;
      if (this._recipientFilter() === 'fix') return issues > 0;
      if (this._recipientFilter() === 'now9') return recipient.w9 !== 'Submitted';
      return true;
    });
  });

  readonly allVisibleSelected = computed(() => {
    const shown = this.visibleRecipients();
    return shown.length > 0 && shown.every(r => r.selected);
  });

  readonly filerHasRecipients = computed(() =>
    this._recipients().some(r => r.filerId === this._selectedFilerId())
  );

  readonly isBusinessRecipient = computed(() => this._recipientForm().type === 'EIN');
  readonly isUnknownTin = computed(() => this._recipientForm().type === 'Unknown');

  readonly panelTinLabel = computed(() =>
    this._panelKind() === 'filer' ? 'EIN' : this._recipientForm().type
  );

  readonly panelTinPlaceholder = computed(() =>
    this._recipientForm().type === 'EIN' ? '12-3456789' : '123-45-6789'
  );

  readonly panelRecipientIssues = computed(() => {
    if (this._panelEditing() && this._panelKind() === 'recipient') {
      return this.recipientIssues(this._recipientForm());
    }
    return [];
  });

  readonly chooserFiler = computed(() =>
    this._filers().find(f => f.id === this._chooserFilerId())
  );

  readonly chooserTitle = computed(() => {
    const filer = this.chooserFiler();
    return filer ? `New filing for ${filer.name}` : 'New filing';
  });

  readonly chooserSub = computed(() => {
    const filer = this.chooserFiler();
    return filer ? `EIN ${this.formatEin(filer.ein)} · ${filer.city}, ${filer.state}` : '';
  });

  // Completed filings for AddToCart
  readonly completedFilings = computed(() =>
    this.amountRowsToUse()
      .filter(row => this.amountRowErrors(row).length === 0)
      .map(row => ({
        id: row.id.replace('recipient-', ''),
        filerId: this._selectedFilerId() ?? 0,
        taxYear: this._taxYear(),
        form: this._selectedForm(),
        recipient: row.name,
        tin: row.tin,
        amount: row.box1 != null ? Number(row.box1) : null,
        status: 'Completed' as const,
        edited: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }))
  );

  // Deadline computeds
  private readonly today = new Date('2026-01-14T12:00:00');

  daysUntil(date: string): number {
    return Math.ceil(
      (new Date(`${date}T12:00:00`).getTime() - this.today.getTime()) / 86400000
    );
  }

  readonly daysToFeb2 = computed(() => this.daysUntil('2026-02-02'));
  readonly daysToMar31 = computed(() => this.daysUntil('2026-03-31'));

  // ── Matcher (for ErrorStateMatcher) ──────────────────────────────────────

  private readonly matchers = new Map<string, ErrorStateMatcher>();

  matcher(key: string): ErrorStateMatcher {
    let m = this.matchers.get(key);
    if (!m) {
      m = { isErrorState: () => !!this._panelErrors()[key] };
      this.matchers.set(key, m);
    }
    return m;
  }

  // ── Public API methods (called from templates) ────────────────────────────

  loadFilers(): void {
    const q = this._filerSearch().trim();
    const request$ = q ? this.filerService.search(q) : this.filerService.getAll();
    request$.subscribe({
      next: (data) => { this._filers.set(this.mapFilersFromApi(data)); },
      error: (error) => {
        console.error('Failed to load filers:', error);
        this.notify('Unable to load filers from the server.');
      }
    });
  }

  getCachedFilers(): any[] {
    return this.filerService.cachedFilers();
  }

  mapFilersFromApi(data: any[]): Filer[] {
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

  mapRecipientsFromApi(data: any[]): Recipient[] {
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

  private loadRecipients(filerId: number): void {
    this.recipientService.getByFiler(filerId).subscribe({
      next: (data) => { this._recipients.set(this.mapRecipientsFromApi(data)); },
      error: (error) => {
        console.error('Failed to load recipients:', error);
        this.notify('Unable to load recipients from the server.');
      }
    });
  }

  onFilerSearchChange(): void {
    this.loadFilers();
  }

  recipientIssues(recipient: Recipient): string[] {
    const issues: string[] = [];
    const digits = recipient.tin.replace(/\D/g, '');
    if (recipient.type !== 'Unknown' && digits.length !== 9) issues.push(`TIN has ${digits.length} digits`);
    if (recipient.type === 'Unknown') issues.push('No TIN on file');
    if (!this.stateOptions.some(s => s[0] === recipient.state)) issues.push(`"${recipient.state || 'blank'}" isn't a US state`);
    if (!recipient.city) issues.push('City missing');
    if (recipient.zip && !/^\d{5}(-?\d{4})?$/.test(recipient.zip)) issues.push('ZIP format');
    if (!recipient.zip) issues.push('ZIP missing');
    return issues;
  }

  stepSummary(index: number): string {
    if (index === 1) return this.currentFiler()?.name ?? 'Choose who is filing';
    if (index === 2) {
      return this._selectedForm()
        ? `${this._selectedForm()} · ${this._taxYear()}`
        : 'Choose tax year and form';
    }
    if (this._mode() === 'bulk') {
      if (index === 3) return this._selectedFileName() || 'Template or your own file';
      if (index === 4) {
        return this._bulkRows().length
          ? `${this.bulkToProcess()} rows to file`
          : 'Fix problems in the file';
      }
      return 'Check and add to cart';
    }
    if (index === 3) {
      const count = this.selectedRecipients().length;
      return count ? `${count} recipient${count > 1 ? 's' : ''}` : 'Choose who gets a form';
    }
    if (index === 4) return this._step() > 4 ? 'Amounts entered' : 'Enter box amounts';
    return 'Check and add to cart';
  }

  canReach(index: number): boolean {
    if (index === 1) return true;
    if (index === 2) return this._selectedFilerId() !== null;
    if (index === 3) return this._selectedFilerId() !== null && !!this._selectedForm();
    if (this._mode() === 'bulk') {
      if (index === 4) return this.canReach(3) && !!this._selectedFileName();
      return this.canReach(4) && this.bulkErrors() === 0 && this.bulkToProcess() > 0;
    }
    if (index === 4) return this.canReach(3) && this.selectedRecipients().length > 0;
    return this.canReach(4) && this.amountsValid();
  }

  amountId(recipient: Recipient): string {
    return `recipient-${recipient.id}`;
  }

  rowRecipient(row: NecAmountRow): Recipient | undefined {
    return this._recipients().find(item => this.amountId(item) === row.id);
  }

  canEmailRow(row: NecAmountRow): boolean {
    const recipient = this.rowRecipient(row);
    return !!(recipient?.email && recipient?.econsent);
  }

  editAmountRow(row: NecAmountRow): void {
    this._amountRows.update(rows => rows.map(item => ({ ...item, expanded: item.id === row.id })));
    this.goStep(4);
  }

  amountRowErrors(row: NecAmountRow): string[] { return necRowErrors(row); }
  amountRowWarnings(row: NecAmountRow): string[] { return necRowWarnings(row); }

  necRowStatus(row: NecAmountRow): string {
    if (necRowErrors(row).length > 0) return 'Fix';
    return necRowWarnings(row).length ? 'Check' : 'Ready';
  }

  necRowStatusClass(row: NecAmountRow): string {
    if (necRowErrors(row).length > 0) return 'p-err';
    return necRowWarnings(row).length ? 'p-warn' : 'p-ok';
  }

  necBoxLabel(row: NecAmountRow, box: string): string {
    return `${box.replace('box', 'Box ')} for ${row.name}`;
  }

  necToggleRow(row: NecAmountRow): void {
    this._amountRows.update(rows => rows.map(r => r.id === row.id ? { ...r, expanded: !r.expanded } : { ...r }));
  }

  necOnAmountChange(row: NecAmountRow, field: 'box1' | 'box3' | 'box4' | 'box5' | 'box7', value: number | null): void {
    this._amountRows.update(rows => rows.map(r => r.id === row.id ? { ...r, [field]: value } : { ...r }));
  }

  necOnStateChange(row: NecAmountRow, code: string): void {
    const payerState = this.currentFiler()?.state ?? 'MD';
    const payerStateNo = this.currentFiler()?.stateNo ?? '';
    this._amountRows.update(rows => rows.map(r => {
      if (r.id !== row.id) return { ...r };
      const updated = { ...r, state: code };
      if (code === payerState && !r.payerStateNumber) updated.payerStateNumber = payerStateNo;
      return updated;
    }));
  }

  necOnPayerStateNoChange(row: NecAmountRow, value: string): void {
    this._amountRows.update(rows => rows.map(r => r.id === row.id ? { ...r, payerStateNumber: value } : { ...r }));
  }

  necOnBox2Change(row: NecAmountRow, value: boolean): void {
    this._amountRows.update(rows => rows.map(r => r.id === row.id ? { ...r, box2: value } : { ...r }));
  }

  necOnSecondTinChange(row: NecAmountRow, value: boolean): void {
    this._amountRows.update(rows => rows.map(r => r.id === row.id ? { ...r, secondTin: value } : { ...r }));
  }

  necOnAccountChange(row: NecAmountRow, value: string): void {
    this._amountRows.update(rows => rows.map(r => r.id === row.id ? { ...r, accountNumber: value } : { ...r }));
  }

  necUsePayerStateForAll(): void {
    const payerState = this.currentFiler()?.state ?? 'MD';
    const payerStateNo = this.currentFiler()?.stateNo ?? '';
    this._amountRows.update(rows => rows.map(r => ({ ...r, state: payerState, payerStateNumber: payerStateNo })));
  }

  fixRecipientRow(rowId: string): void {
    const recipient = this._recipients().find(item => this.amountId(item) === rowId);
    if (recipient) this.openEditRecipient(recipient.id);
  }

  box1Total(): number { return this.sumAmountRows('box1'); }
  box4Total(): number { return this.sumAmountRows('box4'); }

  private sumAmountRows(key: 'box1' | 'box4' | 'box5' | 'box7'): number {
    return this.amountRowsToUse().reduce((total, row) => total + (Number(row[key]) || 0), 0);
  }

  copyFor(row: NecAmountRow): string {
    if (this._delivery()[row.id]) return this._delivery()[row.id];
    return this.canEmailRow(row) ? 'email' : 'mail';
  }

  setCopy(rowId: string, value: string): void {
    this._delivery.update(d => ({ ...d, [rowId]: value }));
  }

  amountRowNotes(row: NecAmountRow): string[] { return this.amountRowWarnings(row); }

  previewAmounts(): void {
    this.notify(`Previewing Copy B for ${this.amountRowsToUse().length} recipient(s).`);
  }

  formCount(): number {
    return this._mode() === 'bulk' ? this.bulkToProcess() : this.amountRowsToUse().length;
  }

  bulkCopyFor(row: BulkRow): string {
    if (this._bulkDelivery() === 'mail') return 'Print and mail';
    if (this._bulkDelivery() === 'self') return 'You deliver';
    return row.email && row.consent ? 'Email' : 'Print and mail';
  }

  reviewBulkRows(): BulkRow[] { return this.bulkLiveRows().slice(0, 8); }

  useBulkFilter(filter: BulkFilter): void { this._bulkFilter.set(filter); }

  toggleBulkSkip(row: BulkRow): void {
    this._bulkRows.update(rows => rows.map(r => {
      if (r.line !== row.line) return r;
      const updated = { ...r, skip: !r.skip };
      return updated;
    }));
    if (this._bulkFilter() === 'skip' && !row.skip) this._bulkFilter.set('all');
    this.recheckBulkRows();
  }

  skipBulkErrors(): void {
    this._bulkRows.update(rows => rows.map(r => r.error ? { ...r, skip: true } : r));
    this.recheckBulkRows();
    this._bulkFilter.set('all');
    this.notify('Rows with errors are skipped. Download the error report to fix them later.');
  }

  updateBulkValue(row: BulkRow, field: 'tin' | 'state' | 'box1' | 'box4', value: string): void {
    this._bulkRows.update(rows => rows.map(r => {
      if (r.line !== row.line) return r;
      const updated = { ...r };
      if (field === 'tin') {
        updated.tin = value.replace(/\D/g, '').slice(0, 9);
      } else if (field === 'state') {
        updated.state = value.trim().toUpperCase();
      } else {
        (updated as any)[field] = value.trim();
        const amount = this.parseAmount((updated as any)[field]);
        if (amount !== null && !Number.isNaN(amount)) (updated as any)[field] = this.money(amount);
      }
      return updated;
    }));
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
      const first = this._bulkRows().find(other => !other.skip && other.tin.replace(/\D/g, '') === digits);
      if (first && first !== row) {
        errors.push(`Same TIN as row ${first.line}. Remove one or combine the amounts.`);
        fields.add('tin');
      }
    }

    if (!this.stateOptions.some(s => s[0] === row.state)) {
      errors.push(`"${row.state || 'blank'}" isn't a US state`);
      fields.add('state');
    }

    const box1 = this.parseAmount(row.box1);
    if (box1 === null || Number.isNaN(box1)) {
      errors.push(`Box 1 "${row.box1}" isn't an amount`);
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
    // Mutate in place then trigger signal update
    const rows = this._bulkRows();
    rows.forEach(row => this.checkBulkRow(row));
    this._bulkRows.update(r => [...r]);
  }

  parseAmount(value: string): number | null {
    if (value === '' || value == null) return null;
    return Number(String(value).replace(/[$,\s]/g, ''));
  }

  private sumBulkColumn(key: 'box1' | 'box4'): number {
    return this.bulkLiveRows().reduce((total, row) => {
      const value = this.parseAmount(row[key]);
      return total + (value && !Number.isNaN(value) ? value : 0);
    }, 0);
  }

  startFiling(mode: FilingMode, filerId?: number): void {
    this._mode.set(mode);
    this._selectedFilerId.set(filerId ?? null);
    this._step.set(filerId ? 2 : 1);
    this._activeView.set('wizard');
    this._selectedForm.set('');
    this._formSearch.set('');
    this._recipientSearch.set('');
    this._recipientFilter.set('all');
    this._selectedFileName.set('');
    this._uploadedRows.set(0);
    this._bulkRows.set([]);
    this._bulkFilter.set('all');
    this._bulkDelivery.set('auto');
    this._amountRows.set([]);
    this._delivery.set({});
    this._showToast.set(false);

    this._recipients.update(rs => rs.map(r => ({ ...r, selected: false })));

    if (filerId != null) this.loadRecipients(filerId);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goDashboard(): void {
    this._activeView.set('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  chooseFiler(id: number): void {
    if (this._selectedFilerId() === id) return;
    this._selectedFilerId.set(id);
    this._selectedForm.set('');
    this._amountRows.set([]);
    this._delivery.set({});
    this._recipients.update(rs => rs.map(r => ({ ...r, selected: false })));
    this.loadRecipients(id);
  }

  takeTopFilerMatch(): void {
    const top = this.filteredFilers()[0];
    if (!top) return;
    this.chooseFiler(top.id);
    this.goStep(2);
  }

  chooseForm(code: string): void {
    if (this._selectedForm() === code) return;
    if (this._step() > 3) this._step.set(3);
    this._selectedForm.set(code);
    this._recipients.update(rs => rs.map(r => ({ ...r, selected: false })));
    this._amountRows.set([]);
    this._delivery.set({});
  }

  chooseYear(year: number): void { this._taxYear.set(year); }

  changeFiler(): void { this.goStep(1); }

  toggleRecipient(recipient: Recipient): void {
    this._recipients.update(rs =>
      rs.map(r => r.id === recipient.id ? { ...r, selected: !r.selected } : r)
    );
  }

  goStep(index: number): void {
    if (index === this._step() || !this.canReach(index)) return;
    this.enterStep(index);
  }

  private enterStep(index: number): void {
    this._step.set(index);
    if (index === 4 && this._mode() === 'manual') {
      this._amountRows.set(this.buildAmountRows());
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    if (!this.nextEnabled()) {
      this.notify(this.footerMessage());
      return;
    }
    if (this._step() === 5) {
      this.addToCart();
      return;
    }
    this.enterStep(this._step() + 1);
  }

  previousStep(): void {
    if (this._step() > 1) this.enterStep(this._step() - 1);
  }

  addToCart(): void {
    const count = this.formCount();
    this._cartCount.update(n => n + count);
    this._doneCount.set(count);
    this._activeView.set('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onCartUpdated(): void {
    this._cartCount.update(n => n + this.completedFilings().length);
    this._doneCount.set(this.formCount());
    this._activeView.set('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  checkout(): void { this.notify('Checkout opened'); }

  fileAgainSameFiler(): void {
    this.startFiling(this._mode(), this._selectedFilerId() ?? undefined);
  }

  fileAgainOtherFiler(): void { this.startFiling(this._mode()); }

  keepPending(): void {
    this.notify('Kept as pending. Find it on the dashboard.');
    this.goDashboard();
  }

  saveAndExit(): void {
    this.notify('Draft saved as pending.');
    this.goDashboard();
  }

  toManualEntry(): void {
    this._mode.set('manual');
    this._bulkRows.set([]);
    this._amountRows.set(this.buildAmountRows());
    this._step.set(3);
  }

  toBulkEntry(): void {
    this._mode.set('bulk');
    this._amountRows.set([]);
    this._recipients.update(rs => rs.map(r => ({ ...r, selected: false })));
    this._step.set(3);
  }

  sendW9Requests(): void {
    const missing = this.selectedRecipients().filter(r => r.w9 !== 'Submitted');
    this._recipients.update(rs =>
      rs.map(r => missing.some(m => m.id === r.id) ? { ...r, w9: 'Requested' } : r)
    );
    this.notify(
      missing.length
        ? `W-9 requests sent to ${missing.length} recipient(s).`
        : 'Every selected recipient already has a W-9 on file.'
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadRows(file.name);
  }

  loadDemoFile(): void {
    const filerName = this.currentFiler()?.name.split(' ')[0] ?? 'taxseer';
    this.loadRows(`${filerName}-1099-NEC-${this._taxYear()}.xlsx`);
  }

  private loadRows(fileName: string): void {
    this._selectedFileName.set(fileName);
    const rows = this.demoBulkRows();
    this._bulkRows.set(rows);
    this.recheckBulkRows();
    this._uploadedRows.set(this._bulkRows().length);
    this._bulkFilter.set(this.bulkErrors() ? 'err' : 'all');
  }

  private demoBulkRows(): BulkRow[] {
    const firstNames = ['Aaron', 'Bianca', 'Carlos', 'Dana', 'Elif', 'Farah', 'Grant', 'Hana',
      'Isaac', 'Jada', 'Kofi', 'Lena', 'Marco', 'Nia', 'Owen', 'Pooja',
      'Quinn', 'Rosa', 'Sam', 'Tara', 'Uma', 'Victor', 'Wes', 'Ximena', 'Yusuf', 'Zoe'];
    const lastNames = ['Adams', 'Brooks', 'Chen', 'Diaz', 'Evans', 'Foster', 'Garcia',
      'Hughes', 'Iqbal', 'Jensen', 'Kim', 'Lopez', 'Moore', 'Nguyen',
      'Ortiz', 'Patel', 'Reyes', 'Shah', 'Turner', 'Vance'];
    const cities: [string, string, string][] = [
      ['Rockville', 'MD', '20850'], ['Bethesda', 'MD', '20814'],
      ['Silver Spring', 'MD', '20910'], ['Columbia', 'MD', '21044'],
      ['Arlington', 'VA', '22201'], ['Washington', 'DC', '20001'],
    ];
    const streets = ['Oak', 'Maple', 'Cedar', 'Pine'];
    const kinds = ['Design', 'Supply', 'Services', 'Consulting'];
    const saved = this._recipients().filter(
      r => r.filerId === this._selectedFilerId() && this.recipientIssues(r).length === 0
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
            line: index + 2, name: known.name, tin: known.tin,
            type: known.type === 'EIN' ? 'EIN' : 'SSN',
            address: known.address, city: known.city, state: known.state, zip: known.zip,
            email: known.email, consent: known.econsent,
            box1: this.money(amount),
            box4: index % 9 === 0 ? this.money(amount * 0.24) : '',
            isNew: false, error: '', errorFields: [], note: '', skip: false,
          }
        : {
            line: index + 2,
            name: isEin ? `${last} ${kinds[index % 4]} LLC` : `${first} ${last}`,
            tin: String(300000000 + index * 1047291).slice(0, 9),
            type: isEin ? 'EIN' : 'SSN',
            address: `${100 + index * 3} ${streets[index % 4]} St`,
            city: city[0], state: city[1], zip: city[2],
            email: index % 3 ? `${first.toLowerCase()}.${last.toLowerCase()}@example.com` : '',
            consent: index % 3 === 1,
            box1: this.money(amount),
            box4: index % 9 === 0 ? this.money(amount * 0.24) : '',
            isNew: true, error: '', errorFields: [], note: '', skip: false,
          };
      rows.push(row);
    }

    rows[6].tin = rows[6].tin.slice(0, 8);
    rows[13].state = 'MENDOZA';
    rows[21].box1 = '12,00O.00';
    rows[29].box1 = '450.00';
    rows[38].tin = rows[10].tin;

    rows.forEach(row => {
      row.isNew = !this._recipients().some(
        r => r.tin.replace(/\D/g, '') === row.tin.replace(/\D/g, '')
      );
    });

    return rows;
  }

  maskBulkTin(row: BulkRow): string {
    return row.type === 'SSN' ? `•••-••-${row.tin.slice(-4)}` : this.formatEin(row.tin);
  }

  money(value: number | null): string {
    return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  notify(message: string): void {
    this._toastMessage.set(message);
    this._showToast.set(true);
    clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => { this._showToast.set(false); }, 3200);
  }

  formatEin(ein: string): string {
    return ein.length === 9 ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ein;
  }

  maskTin(recipient: Recipient): string {
    const tin = recipient.tin;
    if (tin.length !== 9) return tin;
    return recipient.type === 'EIN' ? this.formatEin(tin) : `•••-••-${tin.slice(5)}`;
  }

  resume(index: number): void {
    if (index !== 0) {
      this.notify('Opens that filing at the step where it was left');
      return;
    }
    this.startFiling('manual', 1);
    this._selectedForm.set('1099-NEC');
    this._taxYear.set(2025);
    this._recipients.update(rs => rs.map(r => ({ ...r, selected: r.id === 1 })));
    this._amountRows.set(this.buildAmountRows());
    this._step.set(4);
  }

  newFilingFor(id: number): void {
    this._chooserFilerId.set(id);
    this._chooserOpen.set(true);
  }

  closeChooser(): void {
    this._chooserOpen.set(false);
    this._chooserFilerId.set(null);
  }

  startFromChooser(mode: FilingMode): void {
    const filerId = this._chooserFilerId();
    this._chooserOpen.set(false);
    this.startFiling(mode, filerId ?? undefined);
  }

  goFiler(id: number): void { this.router.navigate(['/taxseer', 'filers', id]); }

  goFilerRecipients(id: number): void {
    this.router.navigate(['/taxseer', 'filers', id], { queryParams: { tab: 'recipients' } });
  }

  downloadTemplate(code: string): void {
    this.notify(
      code === '1099-NEC'
        ? `Downloaded ${code} template for tax year ${this._taxYear()}.`
        : `Downloading TaxSeer's ${code} Excel template.`
    );
  }

  filerAddressLine(): string {
    const filer = this.currentFiler();
    return filer ? `${filer.address}, ${filer.city}, ${filer.state} ${filer.zip}` : '';
  }

  w9Class(recipient: Recipient): string {
    if (recipient.w9 === 'Submitted') return 'p-ok';
    return recipient.w9 === 'Requested' ? 'p-warn' : 'p-neutral';
  }

  toggleAllRecipients(): void {
    const select = !this.allVisibleSelected();
    const visibleIds = new Set(this.visibleRecipients().map(r => r.id));
    this._recipients.update(rs =>
      rs.map(r => visibleIds.has(r.id) ? { ...r, selected: select } : r)
    );
  }

  // ── Panel open/close ──────────────────────────────────────────────────────

  openAddFiler(): void {
    this._panelKind.set('filer');
    this._panelEditing.set(false);
    this.panelFilerId = null;
    this._panelTitle.set('Add filer');
    this._panelErrors.set({});
    this._filerForm.set(this.blankFiler());
    this._panelOpen.set(true);
  }

  openEditFiler(id: number): void {
    const filer = this._filers().find(item => item.id === id);
    if (!filer) return;
    this._panelKind.set('filer');
    this._panelEditing.set(true);
    this.panelFilerId = id;
    this._panelTitle.set('Edit filer');
    this._panelErrors.set({});
    this._filerForm.set({ ...filer, ein: this.formatEin(filer.ein), forms: [...filer.forms] });
    this._panelOpen.set(true);
  }

  openAddRecipient(): void {
    this._panelKind.set('recipient');
    this._panelEditing.set(false);
    this.panelRecipientId = null;
    this._panelTitle.set('Add recipient');
    this._panelErrors.set({});
    this._recipientForm.set(this.blankRecipient(this._selectedFilerId() ?? 1));
    this._panelOpen.set(true);
  }

  openEditRecipient(id: number): void {
    const recipient = this._recipients().find(item => item.id === id);
    if (!recipient) return;
    this._panelKind.set('recipient');
    this._panelEditing.set(true);
    this.panelRecipientId = id;
    this._panelTitle.set('Edit recipient');
    this._panelErrors.set({});
    this._recipientForm.set({
      ...recipient,
      first: recipient.first ?? splitName(recipient.name)[0],
      middle: recipient.middle ?? splitName(recipient.name)[1],
      last: recipient.last ?? splitName(recipient.name)[2],
      tin: this.formatTin(recipient.tin.replace(/\D/g, ''), recipient.type),
      country: recipient.country ?? 'US',
    });
    this._panelOpen.set(true);
  }

  closePanel(): void {
    this._panelOpen.set(false);
    this._panelErrors.set({});
  }

  onPanelTin(value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (this._panelKind() === 'recipient') {
      this._recipientForm.update(r => ({ ...r, tin: this.formatTin(digits, r.type) }));
    } else {
      this._filerForm.update(f => ({ ...f, ein: this.formatEin(digits.slice(0, 9)) }));
    }
  }

  formatTin(digits: string, type: TinType): string {
    if (type === 'EIN') {
      return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
    }
    if (digits.length > 5) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return digits;
  }

  private validateFiler(): boolean {
    this._panelErrors.set({});
    let valid = true;
    const errs: Record<string, string> = {};

    if (!this._filerForm().name?.trim()) { errs['name'] = 'Legal name is required.'; valid = false; }

    const einDigits = (this._filerForm().ein ?? '').replace(/\D/g, '');
    if (!einDigits) { errs['ein'] = 'EIN is required.'; valid = false; }
    else if (einDigits.length !== 9) { errs['ein'] = 'EIN must be 9 digits (e.g. 12-3456789).'; valid = false; }

    if (!this._filerForm().address?.trim()) { errs['address'] = 'Street address is required.'; valid = false; }
    if (!this._filerForm().city?.trim()) { errs['city'] = 'City is required.'; valid = false; }
    if (!this._filerForm().state?.trim()) { errs['state'] = 'State is required.'; valid = false; }

    if (!this._filerForm().zip?.trim()) { errs['zip'] = 'ZIP code is required.'; valid = false; }
    else if (!/^\d{5}(-\d{4})?$/.test(this._filerForm().zip!.trim())) { errs['zip'] = 'ZIP must be 5 digits (e.g. 20850).'; valid = false; }

    this._panelErrors.set(errs);
    return valid;
  }

  saveFiler(): void {
    if (!this.validateFiler()) return;

    const einDigits = this._filerForm().ein.replace(/\D/g, '');
    const f = this._filerForm();
    const payload: any = {
      name: f.name.trim(), ein: einDigits,
      address: f.address.trim(), address2: f.address2?.trim() ?? '',
      city: f.city.trim(), state: f.state.trim(), zip: f.zip.trim(),
      email: f.email?.trim() ?? '', phone: f.phone?.trim() ?? '',
      stateId: f.stateNo?.trim() ?? '', name2: '', mask: false,
      formsUsed: f.forms.join(','),
      pendingCount: f.pending ?? 0, readyCount: 0, filedCount: f.filed ?? 0,
      w9Total: f.w9Total ?? 0,
      w9Required: (f.w9Waiting ?? 0) + (f.w9Received ?? 0),
      w9Received: f.w9Received ?? 0,
      warning: f.warn ?? null,
    };

    const panelEditing = this._panelEditing();
    const request$ = panelEditing && this.panelFilerId !== null
      ? this.filerService.update(this.panelFilerId, payload)
      : this.filerService.create(payload);

    request$.subscribe({
      next: () => {
        this.closePanel();
        this.loadFilers();
        this.notify(panelEditing ? 'Filer updated.' : 'Filer created.');
      },
      error: (err: any) => {
        const msg = err?.error?.friendlyMessage ?? err?.error?.message ?? 'Unable to save filer.';
        this._panelErrors.update(e => ({ ...e, _form: msg }));
      },
    });
  }

  private validateRecipient(): boolean {
    const errs: Record<string, string> = {};
    let valid = true;
    const rf = this._recipientForm();

    if (rf.type !== 'Unknown') {
      const tinDigits = normalizeTin(rf.tin ?? '');
      if (!tinDigits) { errs['tin'] = `${rf.type} is required.`; valid = false; }
      else if (!isCompleteTin(tinDigits)) { errs['tin'] = `${rf.type} must be 9 digits.`; valid = false; }
    }

    if (rf.type === 'EIN') {
      if (!rf.name?.trim()) { errs['name'] = 'Business name is required.'; valid = false; }
    } else {
      if (!rf.first?.trim()) { errs['first'] = 'First name is required.'; valid = false; }
      if (!rf.last?.trim()) { errs['last'] = 'Last name is required.'; valid = false; }
    }

    if (!rf.address?.trim()) { errs['address'] = 'Address is required.'; valid = false; }
    if (!rf.city?.trim()) { errs['city'] = 'City is required.'; valid = false; }
    if (!rf.state?.trim()) { errs['state'] = 'State is required.'; valid = false; }

    if (!rf.zip?.trim()) { errs['zip'] = 'ZIP is required.'; valid = false; }
    else if (!/^\d{5}(-\d{4})?$/.test(rf.zip.trim())) { errs['zip'] = 'ZIP must be 5 digits.'; valid = false; }

    this._panelErrors.set(errs);
    return valid;
  }

  saveRecipient(isSubmitted: boolean = false): void {
    if (!this.validateRecipient()) return;

    const rf = this._recipientForm();
    const recipientType = rf.type;

    const resolvedName = recipientType === 'EIN'
      ? rf.name.trim()
      : [rf.first?.trim(), rf.middle?.trim(), rf.last?.trim()].filter(Boolean).join(' ');

    const isCreate = !this._panelEditing() || this.panelRecipientId === null;

    const payload: any = {
      filerId: Number(rf.filerId) || (this._selectedFilerId() ?? 1),
      name: resolvedName,
      type: recipientType === 'Unknown' ? 'SSN' : recipientType,
      tin: (rf.tin ?? '').replace(/\D/g, '') || '000000000',
      address: rf.address.trim(), address2: rf.address2?.trim() ?? '',
      city: rf.city.trim(), state: rf.state.trim(), zip: rf.zip.trim(),
      email: rf.email?.trim() ?? '',
      econsent: rf.econsent ?? false,
      w9Status: isSubmitted ? 'Submitted' : 'Not requested',
    };

    const request$ = !isCreate
      ? this.recipientService.update(this.panelRecipientId!, payload)
      : this.recipientService.create(payload);

    request$.subscribe({
      next: () => {
        this.closePanel();
        this.loadRecipients(payload.filerId);
        this.notify(isCreate ? 'Recipient added.' : 'Recipient updated.');
      },
      error: (err: any) => {
        const msg = err?.error?.friendlyMessage ?? err?.error?.message ?? 'Unable to save recipient.';
        this._panelErrors.update(e => ({ ...e, _form: msg }));
      },
    });
  }

  private nextRecipientId(): number {
    return this._recipients().reduce((highest, r) => Math.max(highest, r.id), 0) + 1;
  }

  // ── Private form builders ─────────────────────────────────────────────────

  private blankFiler(): Filer {
    return {
      id: 0, name: '', ein: '', address: '', address2: '', city: '', state: '', zip: '',
      phone: '', email: '', stateNo: '', forms: [], pending: 0, filed: 0,
      w9Total: 0, w9Received: 0, w9Waiting: 0,
    };
  }

  private blankRecipient(filerId: number): Recipient {
    return {
      id: 0, filerId, name: '', first: '', middle: '', last: '', dba: '',
      tin: '', type: 'SSN', country: 'US',
      address: '', address2: '', city: '', state: '', zip: '',
      email: '', econsent: false, w9: 'Not requested', selected: false,
    };
  }

  // ── Amount rows builder ───────────────────────────────────────────────────

  buildAmountRows(): NecAmountRow[] {
    const recipientWarning = (recipient: Recipient): string =>
      recipient.w9 !== 'Submitted' && recipient.type !== 'Unknown'
        ? 'No W-9 on file. Check whether backup withholding (24%) applied.'
        : '';

    return this.selectedRecipients().map(recipient => {
      const existing = this._amountRows().find(row => row.id === this.amountId(recipient));
      if (existing) return { ...existing };
      return {
        id: this.amountId(recipient),
        name: recipient.name,
        tin: this.maskTin(recipient),
        address: `${recipient.address}, ${recipient.city} ${recipient.zip}`,
        box1: null, box4: null, box5: null,
        state: '', payerStateNumber: '', box7: null,
        box2: false, box3: null, accountNumber: '', secondTin: false,
        recipientIssues: this.recipientIssues(recipient),
        warning: recipientWarning(recipient),
        expanded: false,
      };
    });
  }

  private matchesFormQuery(form: FormOption): boolean {
    const query = this._formSearch().toLowerCase().trim();
    return !query || `${form.code} ${form.label}`.toLowerCase().includes(query);
  }
}
