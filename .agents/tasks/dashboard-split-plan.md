# Dashboard Split Implementation Plan

**Goal:** Refactor the monolithic `TaxseerDashboard` component (~1973 lines TS + ~2358 lines HTML)
into a `DashboardService` (shared signal store) + 10 focused sub-components.
UI must look identical after the refactor; only the code structure changes.

---

## Pre-flight checklist (read before starting any step)

| File | Why you need it |
|---|---|
| `dashboard.ts` | Original logic — every property, method, computed getter lives here |
| `dashboard.html` | Original template — copy HTML **verbatim**, never alter CSS/Tailwind classes |
| `nec-amounts.types.ts` | **Do not touch** — imported as-is by the service |
| `filer.service.ts` | `FilerService.cachedFilers` signal, `getAll/search/create/update` |
| `recipient.service.ts` | `RecipientService.getByFiler/create/update` |
| `add-to-cart.ts` | Keeps its own `@Input filings` / `@Output cartUpdated` — do not change |
| `filer-details.data.ts` | Defines `FilerFiling` and `FilerRecipient` types referenced in service |

---

## Signal / computed cheat-sheet

The service holds **writable signals** (prefixed `_`) and exposes **read-only** versions.
For every writable signal `_foo` the service exposes:

```ts
readonly foo = this._foo.asReadonly();
// setter convenience where needed:
setFoo(v: T) { this._foo.set(v); }
```

Templates read `ds.foo()` — never `ds._foo`.

---

## Item 1 — Create `dashboard.service.ts`

### What to do
Create the singleton service. Move **all** state, computed getters, and methods from `TaxseerDashboard` into it. Expose every writable signal as a read-only + a setter. Keep all types exported from this file.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/dashboard.service.ts`

### TypeScript imports needed
```ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorStateMatcher } from '@angular/material/core';
import { FilerService } from '../../../../core/api-service/filer.service';
import { RecipientService } from '../../../../core/api-service/recipient.service';
import { NecAmountRow, necRowErrors, necRowWarnings } from './nec-amounts.types';
import { US_STATES, US_STATE_NAMES } from '../../data/taxseer-filers.data';
import { isCompleteTin, normalizeTin } from '../../../../core/validation/tin';
import { FilerFiling } from '../filer-details/filer-details.data';
```

### Exported types (move FROM `dashboard.ts`, export FROM here)
```ts
export type FilingMode = 'manual' | 'bulk';
export type TinType   = 'SSN' | 'EIN' | 'Unknown';
export type BulkFilter = 'all' | 'err' | 'note' | 'new' | 'skip';

export type Filer = { id: number; name: string; ein: string; address: string;
  address2?: string; city: string; state: string; zip: string;
  phone?: string; email?: string; stateNo?: string; forms: string[];
  recent?: number; pending: number; filed: number;
  w9Total: number; w9Received: number; w9Waiting: number; warn?: string; };

export type Recipient = { id: number; filerId: number; name: string;
  first?: string; middle?: string; last?: string; dba?: string;
  tin: string; type: TinType; country?: string;
  address: string; address2?: string; city: string; state: string;
  zip: string; email: string; econsent: boolean;
  w9: string; pendingForm?: boolean; selected?: boolean; };

export type BulkRow = { line: number; name: string; tin: string;
  type: 'SSN' | 'EIN'; address: string; city: string; state: string;
  zip: string; email: string; consent: boolean; box1: string; box4: string;
  isNew: boolean; error: string; errorFields: string[];
  note: string; skip: boolean; };

export type FormOption = { code: string; label: string; due: string; };
export type FormGroup  = { group: string; forms: FormOption[]; };
export type ResumeItem = { id: number; name: string; form: string;
  done: number; total: number; detail: string; when: string; };
```

Also keep the private helper `function splitName(name: string): [string, string, string]` in the service file (not exported).

### Writable signals and their types

```ts
// ---- view state ----
private readonly _activeView  = signal<'dashboard' | 'wizard' | 'done'>('dashboard');
private readonly _step        = signal(1);
private readonly _mode        = signal<FilingMode>('manual');
private readonly _taxYear     = signal(2025);
private readonly _selectedFilerId = signal<number | null>(null);
private readonly _selectedForm    = signal('');
private readonly _formSearch  = signal('');
private readonly _filerSearch = signal('');
private readonly _recipientSearch = signal('');

// ---- data ----
private readonly _filers      = signal<Filer[]>([]);
private readonly _recipients  = signal<Recipient[]>([]);
private readonly _amountRows  = signal<NecAmountRow[]>([]);
private readonly _bulkRows    = signal<BulkRow[]>([]);

// ---- bulk import ----
private readonly _selectedFileName = signal('');
private readonly _uploadedRows     = signal(0);
private readonly _bulkFilter       = signal<BulkFilter>('all');
private readonly _bulkDelivery     = signal<'auto' | 'mail' | 'self'>('auto');

// ---- recipient filter/delivery ----
private readonly _recipientFilter  = signal<'all' | 'ready' | 'fix' | 'now9'>('all');
private readonly _delivery         = signal<Record<string, string>>({});

// ---- cart / toast ----
private readonly _cartCount    = signal(52);
private readonly _walletBalance = signal(100);
private readonly _toastMessage = signal('');
private readonly _showToast    = signal(false);
private _toastTimer?: ReturnType<typeof setTimeout>;

// ---- new filing chooser modal ----
private readonly _chooserOpen    = signal(false);
private readonly _chooserFilerId = signal<number | null>(null);

// ---- slide-over panel ----
private readonly _panelOpen    = signal(false);
private readonly _panelKind    = signal<'filer' | 'recipient'>('filer');
private readonly _panelEditing = signal(false);
private readonly _panelTitle   = signal('');
private readonly _panelErrors  = signal<Record<string, string>>({});

// ---- panel forms ----
private readonly _filerForm     = signal<Filer>(/* blankFiler() */);
private readonly _recipientForm = signal<Recipient>(/* blankRecipient(1) */);

// ---- done ----
private readonly _doneCount = signal(0);
```

Each private signal must be exposed as a readonly:
```ts
readonly activeView   = this._activeView.asReadonly();
readonly step         = this._step.asReadonly();
// ... (all others follow same pattern)
```

### Public setter methods to expose

The service must have a **setter method for every signal** that sub-components need to mutate.
Use this naming convention `setFoo(v)` or `updateFoo(fn)` for object/array signals.

Critical setters:
```ts
setPanelErrors(errors: Record<string, string>): void { this._panelErrors.set(errors); }
updateFilerForm(updater: (f: Filer) => Filer): void { this._filerForm.update(updater); }
updateRecipientForm(updater: (r: Recipient) => Recipient): void { this._recipientForm.update(updater); }
setDelivery(rowId: string, value: string): void {
  this._delivery.update(d => ({ ...d, [rowId]: value }));
}
```

All other direct-assignment setters:
```ts
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
setDoneCount(n: number): void { this._doneCount.set(n); }
```

### Computed signals (replace all `get` getters)

```ts
readonly filteredFilers = computed(() => { /* copy body from dashboard.ts */ });
readonly currentFiler   = computed(() => this._filers().find(f => f.id === this._selectedFilerId()));
readonly allFormOptions = computed(() => this.formGroups.flatMap(g => g.forms));
readonly selectedFormInfo = computed(() => this.allFormOptions().find(f => f.code === this._selectedForm()));
readonly usedFormOptions = computed(() => { /* copy body */ });
readonly visibleFormGroups = computed(() => { /* copy body */ });
readonly yearNote         = computed(() => { /* copy body */ });
readonly eFileDue         = computed(() => { /* copy body */ });
readonly selectedRecipients = computed(() => { /* copy body */ });
readonly recipientIssuesCount = computed(() => { /* copy body */ });
readonly totalWaitingW9  = computed(() => this._filers().reduce((t, f) => t + f.w9Waiting, 0));
readonly stepNames       = computed(() => { /* copy body, reads this._mode() */ });
readonly lastStep        = 5; // constant, plain readonly
readonly nextLabel       = computed(() => { /* copy body */ });
readonly nextEnabled     = computed(() => { /* copy body */ });
readonly footerMessage   = computed(() => { /* copy body */ });
readonly doneFiler       = computed(() => this._filers().find(f => f.id === this._selectedFilerId()));
readonly doneHeading     = computed(() => { /* copy body */ });
readonly doneDetail      = computed(() => { /* copy body */ });
readonly sameFilerLabel  = computed(() => { /* copy body */ });
readonly amountRowsToUse = computed(() => { /* copy body */ });
readonly amountErrorCount = computed(() => { /* copy body */ });
readonly amountNoteCount  = computed(() => { /* copy body */ });
readonly amountsValid     = computed(() => { /* copy body */ });
readonly necTotalBox1     = computed(() => this.sumAmountRows('box1'));
readonly necTotalBox4     = computed(() => this.sumAmountRows('box4'));
readonly necTotalBox5     = computed(() => this.sumAmountRows('box5'));
readonly necTotalBox7     = computed(() => this.sumAmountRows('box7'));
readonly stateCopies      = computed(() => { /* copy body */ });
readonly bulkLiveRows     = computed(() => this._bulkRows().filter(r => !r.skip));
readonly bulkToProcess    = computed(() => this.bulkLiveRows().length);
readonly bulkErrors       = computed(() => this.bulkLiveRows().filter(r => r.error).length);
readonly bulkNotes        = computed(() => this.bulkLiveRows().filter(r => !r.error && r.note).length);
readonly bulkSkipped      = computed(() => this._bulkRows().length - this.bulkLiveRows().length);
readonly bulkNew          = computed(() => this.bulkLiveRows().filter(r => r.isNew).length);
readonly bulkMatched      = computed(() => this.bulkToProcess() - this.bulkNew());
readonly bulkBox1         = computed(() => this.sumBulkColumn('box1'));
readonly bulkBox4         = computed(() => this.sumBulkColumn('box4'));
readonly filteredBulkRows = computed(() => { /* copy body */ });
readonly bulkDeliveryNote = computed(() => { /* copy body */ });
readonly mappedColumns    = computed(() => { /* copy body */ });
readonly necFlow          = computed(() => this._selectedForm() === '1099-NEC');
readonly recentFilers     = computed(() => { /* copy body */ });
readonly otherFilers      = computed(() => { /* copy body */ });
readonly filerGroups      = computed(() => { /* copy body */ });
readonly visibleRecipients = computed(() => { /* copy body */ });
readonly allVisibleSelected = computed(() => { /* copy body */ });
readonly filerHasRecipients = computed(() => this._recipients().some(r => r.filerId === this._selectedFilerId()));
readonly isBusinessRecipient = computed(() => this._recipientForm().type === 'EIN');
readonly isUnknownTin     = computed(() => this._recipientForm().type === 'Unknown');
readonly panelTinLabel    = computed(() => this._panelKind() === 'filer' ? 'EIN' : this._recipientForm().type);
readonly panelTinPlaceholder = computed(() => this._recipientForm().type === 'EIN' ? '12-3456789' : '123-45-6789');
readonly panelRecipientIssues = computed(() => {
  if (this._panelEditing() && this._panelKind() === 'recipient') {
    return this.recipientIssues(this._recipientForm());
  }
  return [];
});
readonly chooserFiler  = computed(() => this._filers().find(f => f.id === this._chooserFilerId()));
readonly chooserTitle  = computed(() => { /* copy body */ });
readonly chooserSub    = computed(() => { /* copy body */ });
```

### Static readonly data (stays as plain properties, NOT signals)
```ts
readonly taxYears    = [2025, 2024, 2023];
readonly resumeItems: ResumeItem[] = [ /* copy from dashboard.ts */ ];
readonly formGroups:  FormGroup[]  = [ /* copy full list from dashboard.ts */ ];
readonly templateColumns: [string, boolean][] = [ /* copy from dashboard.ts */ ];
readonly stateOptions: [string, string][] = US_STATES.map(code => [code, US_STATE_NAMES[code]]);
readonly tinTypes: [TinType, string][] = [['SSN','SSN (individual)'],['EIN','EIN (business)'],['Unknown',"Don't have it yet"]];
readonly recipientFilters: ['all'|'ready'|'fix'|'now9', string][] = [
  ['all','All'],['ready','Ready'],['fix','Needs a fix'],['now9','No W-9']
];
readonly necStates = US_STATES;
```

### All methods moved into the service (copy bodies verbatim, fix `this.prop` → `this._prop()` reads)

Key transformation rule: every read of a previously plain property is now a signal call.
Every write is via a setter. Example:

```ts
// BEFORE (in dashboard.ts)
chooseFiler(id: number): void {
  if (this.selectedFilerId === id) return;
  this.selectedFilerId = id;
  ...
}

// AFTER (in service)
chooseFiler(id: number): void {
  if (this._selectedFilerId() === id) return;
  this._selectedFilerId.set(id);
  ...
}
```

Full list of methods to move:
- `loadFilers()` (keep private)
- `loadRecipients(filerId)` (keep private)
- `mapFilersFromApi(data)` (keep private)
- `mapRecipientsFromApi(data)` (keep private)
- `onFilerSearchChange()`
- `filteredFilers` — becomes computed (see above)
- `currentFiler` — becomes computed
- `matchesFormQuery(form)` (keep private)
- `recipientIssues(recipient)`
- `stepSummary(index)`
- `canReach(index)`
- `amountId(recipient)`
- `rowRecipient(row)`
- `canEmailRow(row)`
- `buildAmountRows()`
- `editAmountRow(row)`
- `amountRowErrors(row)` → just calls `necRowErrors(row)` from nec-amounts.types
- `amountRowWarnings(row)` → just calls `necRowWarnings(row)` from nec-amounts.types
- `necRowStatus(row)`, `necRowStatusClass(row)`, `necBoxLabel(row, box)`
- `necToggleRow(row)`
- `necOnAmountChange(row, field, value)`, `necOnStateChange(row, code)`, `necOnPayerStateNoChange(row, value)`
- `necOnBox2Change(row, value)`, `necOnSecondTinChange(row, value)`, `necOnAccountChange(row, value)`
- `necUsePayerStateForAll()`
- `fixRecipientRow(rowId)`
- `sumAmountRows(key)` (keep private)
- `box1Total()`, `box4Total()`
- `copyFor(row)`, `setCopy(rowId, value)`
- `amountRowNotes(row)`
- `previewAmounts()`
- `formCount()`
- `bulkCopyFor(row)`, `useBulkFilter(filter)`, `toggleBulkSkip(row)`, `skipBulkErrors()`
- `updateBulkValue(row, field, value)`, `checkBulkRow(row)` (keep private), `recheckBulkRows()` (keep private), `bulkBad(row, field)`
- `parseAmount(value)`
- `sumBulkColumn(key)` (keep private)
- `reviewBulkRows()`
- `filerAddressLine()`
- `startFiling(mode, filerId?)`
- `goDashboard()`
- `chooseFiler(id)`, `takeTopFilerMatch()`
- `chooseForm(code)`, `chooseYear(year)`, `changeFiler()`
- `toggleRecipient(recipient)`, `toggleAllRecipients()`
- `goStep(index)`, `enterStep(index)` (keep private)
- `nextStep()`, `previousStep()`
- `addToCart()`
- `checkout()`, `fileAgainSameFiler()`, `fileAgainOtherFiler()`, `keepPending()`, `saveAndExit()`
- `toManualEntry()`, `toBulkEntry()`
- `sendW9Requests()`
- `onFileSelected(event)`, `loadDemoFile()`, `loadRows(fileName)` (keep private)
- `demoBulkRows()` (keep private)
- `maskBulkTin(row)`, `money(value)`, `notify(message)`, `formatEin(ein)`, `maskTin(recipient)`
- `daysUntil(date)`, `daysToFeb2`, `daysToMar31` — convert to computed
- `resume(index)`, `newFilingFor(id)`, `closeChooser()`, `startFromChooser(mode)`
- `goFiler(id)`, `goFilerRecipients(id)`, `downloadTemplate(code)`
- `openAddFiler()`, `openEditFiler(id)`, `openAddRecipient()`, `openEditRecipient(id)`, `closePanel()`
- `onPanelTin(value)`, `formatTin(digits, type)`
- `validateFiler()` (keep private), `saveFiler()`
- `validateRecipient()` (keep private), `saveRecipient(isSubmitted?)`
- `blankFiler()` (keep private), `blankRecipient(filerId)` (keep private)
- `nextRecipientId()` (keep private)
- `w9Class(recipient)`
- `matcher(key)` — moves to service; `matchers` Map stays as a service property

**`completedFilings` computed:**
```ts
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
```

**`onCartUpdated()` method:**
```ts
onCartUpdated(): void {
  this._cartCount.update(n => n + this.completedFilings().length);
  this._doneCount.set(this.formCount());
  this._activeView.set('done');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

### `@HostListener` escape-key handler
This listener was on the dashboard component; it now lives on `FilerRecipientPanelComponent` (the panel that it controls). **Do not** put `@HostListener` in the service.

### `panelFilerId` / `panelRecipientId`
These were private properties on the class. Keep them as private non-signal fields in the service:
```ts
private panelFilerId:     number | null = null;
private panelRecipientId: number | null = null;
```

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```
There must be zero TypeScript compilation errors. The service does not need a test yet — that comes in a later step if desired.

---

## Item 2 — Slim down `dashboard.ts` (the orchestrator)

### What to do
Replace the entire body of `TaxseerDashboard` with the slim orchestrator. The class should be
~60 lines. It injects `DashboardService` and `ActivatedRoute`, reads query params in the
constructor, seeds from cache in `ngOnInit`, and declares the minimal template imports.

### Files
- **MODIFY** `src/app/views/taxseer/pages/dashboard/dashboard.ts`

### New content
```ts
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DashboardService } from './dashboard.service';
import { DashboardHomeComponent } from './components/dashboard-home/dashboard-home';
import { FilingWizardComponent }  from './components/filing-wizard/filing-wizard';
import { FilerRecipientPanelComponent } from './components/filer-recipient-panel/filer-recipient-panel';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DashboardHomeComponent, FilingWizardComponent, FilerRecipientPanelComponent],
  templateUrl: './dashboard.html',
})
export class TaxseerDashboard implements OnInit {
  readonly ds = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const filing = params.get('filing');
    if (filing === 'manual' || filing === 'bulk') {
      const year = Number(params.get('year'));
      const filerId = Number(params.get('filerId'));
      if (year >= 2020 && year <= 2100) this.ds.setTaxYear(year);
      this.ds.startFiling(filing, Number.isInteger(filerId) && filerId > 0 ? filerId : undefined);
    }
  }

  ngOnInit(): void {
    const cached = inject(FilerService).cachedFilers();
    // seed from cache so table is never blank on re-visit
    // (actual loadFilers() is called by DashboardService.loadFilers())
    this.ds.loadFilers();
  }

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    if (this.ds.panelOpen()) {
      this.ds.closePanel();
    } else if (this.ds.chooserOpen()) {
      this.ds.closeChooser();
    }
  }
}
```

**Important:** `FilerService` must also be imported in the orchestrator for the cache-seed line.
Actually, the ngOnInit cache-seed should just call `this.ds.loadFilers()` which internally handles
the cache check. So `ngOnInit` simply does `this.ds.loadFilers()` — the service method already
reads `filerService.cachedFilers()` and falls back to API. Remove the `inject(FilerService)` call
from the orchestrator; it is not needed.

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 3 — Update `dashboard.html` (the slim orchestrator template)

### What to do
Replace the entire 2358-line template with 3 `@if` blocks that delegate to sub-components,
plus the toast (which stays inline in the root template).

### Files
- **MODIFY** `src/app/views/taxseer/pages/dashboard/dashboard.html`

### New content
```html
@if (ds.activeView() === 'dashboard') {
  <app-dashboard-home />
}

@if (ds.activeView() === 'wizard' || ds.activeView() === 'done') {
  <app-filing-wizard />
}

@if (ds.panelOpen()) {
  <app-filer-recipient-panel />
}

<!-- Toast Message — stays here, visible from any view -->
<div
  class="toast fixed bottom-4 right-4 z-50 bg-(--ink) text-white text-xs px-4 py-2.5 rounded-lg shadow-lg transition-transform"
  [class.translate-y-24]="!ds.showToast()" role="status" aria-live="polite">
  {{ ds.toastMessage() }}
</div>
```

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 4 — Create `components/dashboard-home/`

### What to do
Extract the `<!-- DASHBOARD -->` block (HTML lines 9–212 of original template: `@if (activeView === 'dashboard') { <main class="page"> ... </main> }` including the filer table, summary cards, deadlines, resume section, and "File new forms" panel).
Also include the **New Filing Chooser Modal** HTML (original lines ~1573–1637: `<!-- New Filing Chooser Modal -->`).

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/dashboard-home/dashboard-home.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/dashboard-home/dashboard-home.html`

### TypeScript imports needed
```ts
import { Component, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, MatButtonModule, MatChipsModule, MatInputModule],
  templateUrl: './dashboard-home.html',
})
export class DashboardHomeComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove the outer `@if (activeView === 'dashboard') { ... }` wrapper — this component is only rendered when that condition is true
- Every property/method access prepends `ds.`:
  - `daysToFeb2` → `ds.daysToFeb2()`
  - `daysToMar31` → `ds.daysToMar31()`
  - `resumeItems` → `ds.resumeItems`
  - `taxYear` → `ds.taxYear()`
  - `resume($index)` → `ds.resume($index)`
  - `startFiling('manual')` → `ds.startFiling('manual')`
  - `startFiling('bulk')` → `ds.startFiling('bulk')`
  - `allFormOptions` → `ds.allFormOptions()`
  - `downloadTemplate(form.code)` → `ds.downloadTemplate(form.code)`
  - `totalWaitingW9` → `ds.totalWaitingW9()`
  - `notify(...)` → `ds.notify(...)`
  - `cartCount` → `ds.cartCount()`
  - `walletBalance` → `ds.walletBalance()`
  - `filteredFilers` → `ds.filteredFilers()`
  - `formatEin(f.ein)` → `ds.formatEin(f.ein)`
  - `goFiler(f.id)` → `ds.goFiler(f.id)`
  - `goFilerRecipients(f.id)` → `ds.goFilerRecipients(f.id)`
  - `openEditFiler(f.id)` → `ds.openEditFiler(f.id)`
  - `openAddFiler()` → `ds.openAddFiler()`
  - `newFilingFor(f.id)` → `ds.newFilingFor(f.id)`
  - `filerSearch` (two-way) → `[ngModel]="ds.filerSearch()" (ngModelChange)="ds.setFilerSearch($event)"`
- `daysToFeb2` and `daysToMar31` are computeds in the service, so call them as `ds.daysToFeb2()`
- Chooser modal: keep the `@if (chooserOpen)` block inside this component's template but change condition to `@if (ds.chooserOpen())`:
  - `chooserTitle` → `ds.chooserTitle()`
  - `chooserSub` → `ds.chooserSub()`
  - `closeChooser()` → `ds.closeChooser()`
  - `startFromChooser('manual')` → `ds.startFromChooser('manual')`
  - `startFromChooser('bulk')` → `ds.startFromChooser('bulk')`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 5 — Create `components/filing-wizard/`

### What to do
Create the `FilingWizardComponent` shell. Its template contains the wizard `<main class="wizard">` wrapper, the wizard header (back button, title, mode chip, "Save and exit"), the step navigation `<nav mat-tab-nav-bar>`, the `<mat-tab-nav-panel>` body (which uses `@if` blocks to render each wizard-step sub-component), the wizard footer, and the **Done** screen (`activeView === 'done'`).

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/filing-wizard/filing-wizard.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/filing-wizard/filing-wizard.html`

### TypeScript imports needed
```ts
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { DashboardService } from '../../dashboard.service';
import { WizardStepFilerComponent } from '../wizard-step-filer/wizard-step-filer';
import { WizardStepFormComponent } from '../wizard-step-form/wizard-step-form';
import { WizardStepRecipientsComponent } from '../wizard-step-recipients/wizard-step-recipients';
import { WizardStepBulkUploadComponent } from '../wizard-step-bulk-upload/wizard-step-bulk-upload';
import { WizardStepAmountsComponent } from '../wizard-step-amounts/wizard-step-amounts';
import { WizardStepBulkCheckComponent } from '../wizard-step-bulk-check/wizard-step-bulk-check';
import { WizardStepReviewComponent } from '../wizard-step-review/wizard-step-review';
```

### Component class
```ts
@Component({
  selector: 'app-filing-wizard',
  standalone: true,
  imports: [
    MatButtonModule, MatTabsModule, MatChipsModule,
    WizardStepFilerComponent, WizardStepFormComponent,
    WizardStepRecipientsComponent, WizardStepBulkUploadComponent,
    WizardStepAmountsComponent, WizardStepBulkCheckComponent,
    WizardStepReviewComponent,
  ],
  templateUrl: './filing-wizard.html',
})
export class FilingWizardComponent {
  readonly ds = inject(DashboardService);
}
```

### Template structure
The template covers two cases, both previously under `@else if (activeView === 'wizard')` and `@else` in the original:

```html
<!-- WIZARD VIEW — rendered when activeView() === 'wizard' -->
@if (ds.activeView() === 'wizard') {
<main class="wizard">
  <!-- Wizard Header: verbatim copy, all references prepended with ds. -->
  <!-- nav mat-tab-nav-bar: verbatim copy -->
  <mat-tab-nav-panel #stepPanel class="wizard-body">
    @if (ds.step() === 1) { <app-wizard-step-filer /> }
    @if (ds.step() === 2) { <app-wizard-step-form /> }
    @if (ds.step() === 3 && ds.mode() === 'manual') { <app-wizard-step-recipients /> }
    @if (ds.step() === 3 && ds.mode() === 'bulk') { <app-wizard-step-bulk-upload /> }
    @if (ds.step() === 4 && ds.mode() === 'manual') { <app-wizard-step-amounts /> }
    @if (ds.step() === 4 && ds.mode() === 'bulk') { <app-wizard-step-bulk-check /> }
    @if (ds.step() === 5) { <app-wizard-step-review /> }
  </mat-tab-nav-panel>
  <!-- Wizard Fixed Footer: verbatim copy -->
</main>
}

<!-- DONE VIEW — rendered when activeView() === 'done' -->
@if (ds.activeView() === 'done') {
<main class="page max-w-2xl mx-auto p-6 sm:p-12 text-center">
  <!-- verbatim copy of ADDED TO CART block -->
</main>
}
```

### Template transformation rules for wizard header
- `mode` → `ds.mode()`
- `step >= 4` → `ds.step() >= 4`
- `goDashboard()` → `ds.goDashboard()`
- `saveAndExit()` → `ds.saveAndExit()`
- `stepNames` → `ds.stepNames()`
- `step` → `ds.step()`
- `canReach(i + 1)` → `ds.canReach(i + 1)`
- `goStep(i + 1)` → `ds.goStep(i + 1)`
- `stepSummary(i + 1)` → `ds.stepSummary(i + 1)`

### Template transformation rules for wizard footer
- `step` → `ds.step()`
- `previousStep()` → `ds.previousStep()`
- `footerMessage` → `ds.footerMessage()`
- `step === 5` → `ds.step() === 5`
- `keepPending()` → `ds.keepPending()`
- `nextEnabled` → `ds.nextEnabled()`
- `nextStep()` → `ds.nextStep()`
- `nextLabel` → `ds.nextLabel()`

### Template transformation rules for done screen
- `doneHeading` → `ds.doneHeading()`
- `doneDetail` → `ds.doneDetail()`
- `checkout()` → `ds.checkout()`
- `cartCount` → `ds.cartCount()`
- `sameFilerLabel` → `ds.sameFilerLabel()`
- `fileAgainSameFiler()` → `ds.fileAgainSameFiler()`
- `fileAgainOtherFiler()` → `ds.fileAgainOtherFiler()`
- `goDashboard()` → `ds.goDashboard()`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 6 — Create `components/wizard-step-filer/`

### What to do
Extract **STEP 1** block (original HTML from `@if (step === 1) {` through the closing `}`, approximately lines 358–456 of original `dashboard.html`).

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-filer/wizard-step-filer.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-filer/wizard-step-filer.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-filer',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatRadioModule],
  templateUrl: './wizard-step-filer.html',
})
export class WizardStepFilerComponent {
  readonly ds = inject(DashboardService);
}
```

### Template — copy STEP 1 block verbatim, then apply these transformations
- Remove the outer `@if (step === 1) { ... }` wrapper
- `filerSearch` (two-way ngModel) → `[ngModel]="ds.filerSearch()" (ngModelChange)="ds.setFilerSearch($event)"`
- `takeTopFilerMatch()` → `ds.takeTopFilerMatch()`
- `openAddFiler()` → `ds.openAddFiler()`
- `filerGroups` → `ds.filerGroups()`
- `selectedFilerId` → `ds.selectedFilerId()`
- `chooseFiler(f.id); goStep(2)` → `ds.chooseFiler(f.id); ds.goStep(2)`
- `formatEin(f.ein)` → `ds.formatEin(f.ein)`
- `openEditFiler(f.id)` → `ds.openEditFiler(f.id)`
- `filteredFilers` → `ds.filteredFilers()`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 7 — Create `components/wizard-step-form/`

### What to do
Extract **STEP 2** block (original HTML `@if (step === 2) {` through its closing `}`, approximately lines 457–600 of original `dashboard.html`).

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-form/wizard-step-form.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-form/wizard-step-form.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-form',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatChipsModule],
  templateUrl: './wizard-step-form.html',
})
export class WizardStepFormComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove `@if (step === 2) { ... }` wrapper
- `taxYear` → `ds.taxYear()`
- `taxYears` → `ds.taxYears`
- `chooseYear($event.value)` → `ds.chooseYear($event.value)`
- `yearNote` → `ds.yearNote()`
- `formSearch` (two-way) → `[ngModel]="ds.formSearch()" (ngModelChange)="ds.setFormSearch($event)"`
- `usedFormOptions` → `ds.usedFormOptions()`
- `currentFiler?.name` → `ds.currentFiler()?.name`
- `selectedForm` → `ds.selectedForm()`
- `chooseForm(form.code)` → `ds.chooseForm(form.code)`
- `visibleFormGroups` → `ds.visibleFormGroups()`
- `formatEin(...)` → `ds.formatEin(...)`
- `selectedFormInfo` → `ds.selectedFormInfo()`
- `eFileDue` → `ds.eFileDue()`
- `changeFiler()` → `ds.changeFiler()`
- `notify(...)` → `ds.notify(...)`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 8 — Create `components/wizard-step-recipients/`

### What to do
Extract the **STEP 3 manual** block (original HTML `@if (step === 3 && mode === 'manual')` through its closing `}`, approximately lines 601–780 of original `dashboard.html`). This includes the `!necFlow` placeholder message as well as the full recipient table.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-recipients/wizard-step-recipients.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-recipients/wizard-step-recipients.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-recipients',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatChipsModule],
  templateUrl: './wizard-step-recipients.html',
})
export class WizardStepRecipientsComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove outer `@if (step === 3 && mode === 'manual') { ... }` wrapper
- `necFlow` → `ds.necFlow()`
- `step = 2` inline assignment → `ds.goStep(2)`
- `selectedForm` → `ds.selectedForm()`
- `currentFiler?.name` → `ds.currentFiler()?.name`
- `recipientSearch` (two-way) → `[ngModel]="ds.recipientSearch()" (ngModelChange)="ds.setRecipientSearch($event)"`
- `toBulkEntry()` → `ds.toBulkEntry()`
- `openAddRecipient()` → `ds.openAddRecipient()`
- `recipientFilter` (two-way via toggle) → `[value]="ds.recipientFilter()" (change)="ds.setRecipientFilter($event.value)"`
- `recipientFilters` → `ds.recipientFilters`
- `sendW9Requests()` → `ds.sendW9Requests()`
- `notify(...)` → `ds.notify(...)`
- `allVisibleSelected` → `ds.allVisibleSelected()`
- `toggleAllRecipients()` → `ds.toggleAllRecipients()`
- `visibleRecipients` → `ds.visibleRecipients()`
- `r.selected` → `r.selected`  *(recipient objects in the signal array, fine to read directly)*
- `toggleRecipient(r)` → `ds.toggleRecipient(r)`
- `maskTin(r)` → `ds.maskTin(r)`
- `recipientIssues(r).length` → `ds.recipientIssues(r).length`
- `w9Class(r)` → `ds.w9Class(r)`
- `openEditRecipient(r.id)` → `ds.openEditRecipient(r.id)`
- `filerHasRecipients` → `ds.filerHasRecipients()`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 9 — Create `components/wizard-step-bulk-upload/`

### What to do
Extract **STEP 3 bulk** block (original HTML `@if (step === 3 && mode === 'bulk')` through its closing `}`, approximately lines 785–895 of original `dashboard.html`). Includes the drop zone, file info card, column mapping table, and template download sidebar.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-bulk-upload/wizard-step-bulk-upload.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-bulk-upload/wizard-step-bulk-upload.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-bulk-upload',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './wizard-step-bulk-upload.html',
})
export class WizardStepBulkUploadComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove outer `@if` wrapper
- `toManualEntry()` → `ds.toManualEntry()`
- `onFileSelected($event)` → `ds.onFileSelected($event)`
- `loadDemoFile()` → `ds.loadDemoFile()`
- `selectedFileName` → `ds.selectedFileName()`
- `uploadedRows` → `ds.uploadedRows()`
- `selectedForm` → `ds.selectedForm()`
- `replaceFileInput.click()` — keep template reference variable `#replaceFileInput` on the `<input>`; this is a local template ref so it works unchanged
- `mappedColumns` → `ds.mappedColumns()`
- `currentFiler?.name` → `ds.currentFiler()?.name`
- `necFlow` → `ds.necFlow()`
- `templateColumns` → `ds.templateColumns`
- `taxYear` → `ds.taxYear()`
- `downloadTemplate(selectedForm)` → `ds.downloadTemplate(ds.selectedForm())`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 10 — Create `components/wizard-step-amounts/`

### What to do
Extract **STEP 4 manual** block (original HTML `@if (step === 4 && mode === 'manual')` through its closing `}`, approximately lines 900–1060 of original `dashboard.html`). This is the NEC amounts table with expand rows.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-amounts/wizard-step-amounts.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-amounts/wizard-step-amounts.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-amounts',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatChipsModule, MatCheckboxModule, MatInputModule, MatSelectModule],
  templateUrl: './wizard-step-amounts.html',
})
export class WizardStepAmountsComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove outer `@if` wrapper
- `currentFiler?.state ?? 'MD'` → `ds.currentFiler()?.state ?? 'MD'`
- `necUsePayerStateForAll()` → `ds.necUsePayerStateForAll()`
- `previewAmounts()` → `ds.previewAmounts()`
- `amountRowsToUse` → `ds.amountRowsToUse()`
- `necToggleRow(row)` → `ds.necToggleRow(row)`
- `necBoxLabel(row, 'box1')` → `ds.necBoxLabel(row, 'box1')`
- `row.box1` (ngModel read) → `[ngModel]="row.box1"` *(row is a plain object from the signal array, reads are direct)*
- `(ngModelChange)="necOnAmountChange(row, 'box1', $event)"` → `(ngModelChange)="ds.necOnAmountChange(row, 'box1', $event)"`
- Same pattern for box4, box5, box7, box3
- `necOnStateChange(row, $event)` → `ds.necOnStateChange(row, $event)`
- `necOnPayerStateNoChange(row, $event)` → `ds.necOnPayerStateNoChange(row, $event)`
- `necStates` → `ds.necStates`
- `necRowStatusClass(row)` → `ds.necRowStatusClass(row)`
- `necRowStatus(row)` → `ds.necRowStatus(row)`
- `row.expanded` → `row.expanded` *(plain object field, direct access fine)*
- `fixRecipientRow(row.id)` → `ds.fixRecipientRow(row.id)`
- `amountRowErrors(row)` → `ds.amountRowErrors(row)`
- `amountRowWarnings(row)` → `ds.amountRowWarnings(row)`
- `necOnBox2Change(row, $event)` → `ds.necOnBox2Change(row, $event)`
- `necOnAccountChange(row, $event)` → `ds.necOnAccountChange(row, $event)`
- `necOnSecondTinChange(row, $event)` → `ds.necOnSecondTinChange(row, $event)`
- `currentFiler?.name ?? ''` → `ds.currentFiler()?.name ?? ''`
- `formatEin(currentFiler?.ein ?? '')` → `ds.formatEin(ds.currentFiler()?.ein ?? '')`
- `filerAddressLine()` → `ds.filerAddressLine()`
- `necTotalBox1 | number:'1.2-2'` → `ds.necTotalBox1() | number:'1.2-2'`
- Same for `necTotalBox4`, `necTotalBox5`, `necTotalBox7`
- `amountRowsToUse.length` → `ds.amountRowsToUse().length`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 11 — Create `components/wizard-step-bulk-check/`

### What to do
Extract **STEP 4 bulk** block (original HTML `@if (step === 4 && mode === 'bulk')` through its closing `}`, approximately lines 1062–1245 of original `dashboard.html`). Includes the filter tiles, the check-data table, and inline cell-fix form fields.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-bulk-check/wizard-step-bulk-check.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-bulk-check/wizard-step-bulk-check.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-bulk-check',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './wizard-step-bulk-check.html',
})
export class WizardStepBulkCheckComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove outer `@if` wrapper
- `selectedFileName` → `ds.selectedFileName()`
- `notify(...)` → `ds.notify(...)`
- `step = 3` inline assignment → `ds.goStep(3)`
- `bulkErrors` → `ds.bulkErrors()`
- `skipBulkErrors()` → `ds.skipBulkErrors()`
- `bulkToProcess` → `ds.bulkToProcess()`
- `bulkSkipped` → `ds.bulkSkipped()`
- `bulkFilter` → `ds.bulkFilter()`
- `useBulkFilter('all')` → `ds.useBulkFilter('all')` (same for other filter values)
- `bulkNotes` → `ds.bulkNotes()`
- `bulkNew` → `ds.bulkNew()`
- `bulkMatched` → `ds.bulkMatched()`
- `filteredBulkRows` → `ds.filteredBulkRows()`
- `bulkBad(row, 'tin')` → `ds.bulkBad(row, 'tin')` (and other fields)
- `maskBulkTin(row)` → `ds.maskBulkTin(row)`
- `updateBulkValue(row, 'tin', $event)` → `ds.updateBulkValue(row, 'tin', $event)`
- `stateOptions` → `ds.stateOptions`
- `toggleBulkSkip(row)` → `ds.toggleBulkSkip(row)`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 12 — Create `components/wizard-step-review/`

### What to do
Extract **STEP 5** block (original HTML `@if (step === 5)` through its closing `}`, approximately lines 1248–1480 of original `dashboard.html`). Includes stat tiles, manual review table, bulk review table, delivery dropdowns, `<app-add-to-cart>`, and the footer notes.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-review/wizard-step-review.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/wizard-step-review/wizard-step-review.html`

### TypeScript imports
```ts
import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';
import { AddToCartComponent } from '../../../../components/add-to-cart/add-to-cart';
```

### Component class
```ts
@Component({
  selector: 'app-wizard-step-review',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatSelectModule, AddToCartComponent],
  templateUrl: './wizard-step-review.html',
})
export class WizardStepReviewComponent {
  readonly ds = inject(DashboardService);
}
```

### Template transformation rules
- Remove outer `@if (step === 5) { ... }` wrapper
- `currentFiler?.name` → `ds.currentFiler()?.name`
- `formatEin(currentFiler?.ein || '')` → `ds.formatEin(ds.currentFiler()?.ein || '')`
- `selectedForm` → `ds.selectedForm()`
- `taxYear` → `ds.taxYear()`
- `mode` → `ds.mode()`
- `selectedFileName` → `ds.selectedFileName()`
- `formCount()` → `ds.formCount()`
- `money(bulkBox1)` → `ds.money(ds.bulkBox1())`
- `money(box1Total())` → `ds.money(ds.box1Total())`
- `money(bulkBox4)` → `ds.money(ds.bulkBox4())`
- `money(box4Total())` → `ds.money(ds.box4Total())`
- `bulkNew` → `ds.bulkNew()`
- `bulkToProcess` → `ds.bulkToProcess()`
- `stateCopies` → `ds.stateCopies()`
- `amountRowsToUse` → `ds.amountRowsToUse()`
- `money(row.box1)` → `ds.money(row.box1)`
- `money(row.box4)` → `ds.money(row.box4)`
- `copyFor(row)` → `ds.copyFor(row)`
- `setCopy(row.id, $event)` → `ds.setCopy(row.id, $event)`
- `canEmailRow(row)` → `ds.canEmailRow(row)`
- `amountRowNotes(row)` → `ds.amountRowNotes(row)`
- `editAmountRow(row)` → `ds.editAmountRow(row)`
- `bulkDelivery` (two-way) → `[(ngModel)]="..."`
  - Decompose: `[ngModel]="ds.bulkDelivery()" (ngModelChange)="ds.setBulkDelivery($event)"`
- `bulkDeliveryNote` → `ds.bulkDeliveryNote()`
- `reviewBulkRows()` → `ds.reviewBulkRows()`
- `maskBulkTin(row)` → `ds.maskBulkTin(row)`
- `bulkCopyFor(row)` → `ds.bulkCopyFor(row)`
- `bulkSkipped` → `ds.bulkSkipped()`
- `notify(...)` → `ds.notify(...)`
- AddToCartComponent wiring — **keep @Input/@Output unchanged**:
  ```html
  <app-add-to-cart
    [filings]="ds.completedFilings()"
    (cartUpdated)="ds.onCartUpdated()">
  </app-add-to-cart>
  ```

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 13 — Create `components/filer-recipient-panel/`

### What to do
Extract the **Slide-Over Drawer** block (original HTML `@if (panelOpen)` through its closing `}`, approximately lines 1490–1570 of original `dashboard.html`). Includes the scrim, aside panel, filer fieldsets, recipient fieldsets, and the footer save/cancel buttons.

### Files
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/filer-recipient-panel/filer-recipient-panel.ts`
- **CREATE** `src/app/views/taxseer/pages/dashboard/components/filer-recipient-panel/filer-recipient-panel.html`

### TypeScript imports
```ts
import { Component, HostListener, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DashboardService } from '../../dashboard.service';
```

### Component class
```ts
@Component({
  selector: 'app-filer-recipient-panel',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule, MatCheckboxModule],
  templateUrl: './filer-recipient-panel.html',
})
export class FilerRecipientPanelComponent {
  readonly ds = inject(DashboardService);

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    if (this.ds.panelOpen()) {
      this.ds.closePanel();
    }
  }
}
```

**Note:** The `@HostListener` for Escape is moved here from the orchestrator (it was on the dashboard class). The orchestrator keeps a handler for the **chooser** close (chooserOpen), but the panel escape is best owned by the panel component itself. Alternatively, keep both in the orchestrator — see gotcha below.

**Gotcha:** If `FilerRecipientPanelComponent` is only rendered when `panelOpen()` is true (because the orchestrator template uses `@if (ds.panelOpen())`), then mounting/unmounting the component will subscribe/unsubscribe the `@HostListener` automatically, which is correct behaviour.

### Template transformation rules
- Remove the outer `@if (panelOpen) { ... }` wrapper — this component is only rendered when the condition is true
- `panelTitle` → `ds.panelTitle()`
- `closePanel()` → `ds.closePanel()`
- `panelKind` → `ds.panelKind()`
- `panelEditing` → `ds.panelEditing()`
- `filerForm` field reads — The `filerForm` is a signal holding a plain object. Read it as `ds.filerForm()`:
  - `filerForm.warn` → `ds.filerForm().warn`
  - `filerForm.filed` → `ds.filerForm().filed`
  - `filerForm.pending` → `ds.filerForm().pending`
  - `filerForm.name` → `ds.filerForm().name`
  - For `(ngModelChange)` writes to filerForm fields, use `updateFilerForm`:
    - `(ngModelChange)="filerForm.name = $event"` → `(ngModelChange)="ds.updateFilerForm(f => ({...f, name: $event}))"`
    - Same pattern for `ein`, `phone`, `address`, `address2`, `city`, `state`, `zip`, `email`, `stateNo`
- `onPanelTin($event)` → `ds.onPanelTin($event)` *(service method handles filerForm.ein and recipientForm.tin together)*
- `panelErrors['name']` → `ds.panelErrors()['name']` (and all other field keys)
- `stateOptions` → `ds.stateOptions`
- `panelRecipientIssues` → `ds.panelRecipientIssues()`
- `recipientForm` reads → `ds.recipientForm().type`, etc.
- `recipientForm.type = $event.value` → `ds.updateRecipientForm(r => ({...r, type: $event.value}))`
- `tinTypes` → `ds.tinTypes`
- `isUnknownTin` → `ds.isUnknownTin()`
- `panelTinLabel` → `ds.panelTinLabel()`
- `panelTinPlaceholder` → `ds.panelTinPlaceholder()`
- `isBusinessRecipient` → `ds.isBusinessRecipient()`
- `recipientForm.name = $event` → `ds.updateRecipientForm(r => ({...r, name: $event}))`
- `recipientForm.dba = $event` → `ds.updateRecipientForm(r => ({...r, dba: $event}))`
- `recipientForm.first = $event` → `ds.updateRecipientForm(r => ({...r, first: $event}))`
- `recipientForm.middle = $event` → `ds.updateRecipientForm(r => ({...r, middle: $event}))`
- `recipientForm.last = $event` → `ds.updateRecipientForm(r => ({...r, last: $event}))`
- `recipientForm.country = $event` → `ds.updateRecipientForm(r => ({...r, country: $event}))`
- `recipientForm.address = $event` → `ds.updateRecipientForm(r => ({...r, address: $event}))`
- `recipientForm.address2 = $event` → `ds.updateRecipientForm(r => ({...r, address2: $event}))`
- `recipientForm.city = $event` → `ds.updateRecipientForm(r => ({...r, city: $event}))`
- `recipientForm.state = $event` → `ds.updateRecipientForm(r => ({...r, state: $event}))`
- `recipientForm.zip = $event` → `ds.updateRecipientForm(r => ({...r, zip: $event}))`
- `recipientForm.email = $event` → `ds.updateRecipientForm(r => ({...r, email: $event}))`
- `recipientForm.econsent = $event` → `ds.updateRecipientForm(r => ({...r, econsent: $event}))`
- `saveFiler()` → `ds.saveFiler()`
- `saveRecipient(true)` → `ds.saveRecipient(true)`
- `saveRecipient()` → `ds.saveRecipient()`

### Verify
```
npx ng build --configuration development 2>&1 | Select-String "ERROR"
```

---

## Item 14 — Full end-to-end build and smoke test

### What to do
Run the full dev build, confirm zero compilation errors, confirm all new component files exist, and confirm the build output includes the dashboard bundle.

### Verify
```powershell
# Step 1 — clean build
npx ng build --configuration development 2>&1 | Select-String -Pattern "ERROR|error TS"

# Step 2 — confirm all component files were created
$base = "src/app/views/taxseer/pages/dashboard/components"
$expected = @(
  "$base/dashboard-home/dashboard-home.ts",
  "$base/filing-wizard/filing-wizard.ts",
  "$base/wizard-step-filer/wizard-step-filer.ts",
  "$base/wizard-step-form/wizard-step-form.ts",
  "$base/wizard-step-recipients/wizard-step-recipients.ts",
  "$base/wizard-step-bulk-upload/wizard-step-bulk-upload.ts",
  "$base/wizard-step-amounts/wizard-step-amounts.ts",
  "$base/wizard-step-bulk-check/wizard-step-bulk-check.ts",
  "$base/wizard-step-review/wizard-step-review.ts",
  "$base/filer-recipient-panel/filer-recipient-panel.ts"
)
$expected | ForEach-Object { Test-Path $_ }
# All should output True
```

---

## Cross-cutting gotchas and transformation notes

### 1. Signal reads in templates vs. TS
In templates, computed signals are called: `ds.step()`, `ds.filteredFilers()`.
In TS methods inside the service, signal reads are also calls: `this._step()`, `this._filers()`.
Never use a signal as if it were a plain value — always invoke it.

### 2. `[(ngModel)]` decomposition rule
Angular's `[(ngModel)]` desugars to `[ngModel]="x" (ngModelChange)="x = $event"`.
Since `x` is now a signal, decompose every two-way binding:
```html
<!-- OLD -->
[(ngModel)]="filerSearch"
<!-- NEW -->
[ngModel]="ds.filerSearch()" (ngModelChange)="ds.setFilerSearch($event)"
```

### 3. Object mutation vs. signal update
Signal-held plain objects (`filerForm`, `recipientForm`, `delivery`) must never be mutated in place.
Always call `.update(old => ({ ...old, field: value }))`.
The `necToggleRow`, `necOnAmountChange`, etc. methods already do this in the current codebase —
confirm they use `this._amountRows.update(...)` not `row.field = value; this.amountRows = [...]`.

### 4. `panelFilerId` / `panelRecipientId` are NOT signals
These are private tracking IDs used only during the save flow.
Keep them as plain `private` fields on the service class:
```ts
private panelFilerId:     number | null = null;
private panelRecipientId: number | null = null;
```

### 5. The `matcher()` method and `matchers` Map
```ts
private readonly matchers = new Map<string, ErrorStateMatcher>();

matcher(key: string): ErrorStateMatcher {
  let m = this.matchers.get(key);
  if (!m) {
    m = { isErrorState: () => !!this.panelErrors()[key] };
    this.matchers.set(key, m);
  }
  return m;
}
```
The closure references `this.panelErrors()` — because `panelErrors` is now a signal, calling it
in the `isErrorState` closure will re-read the signal at the time Angular calls `isErrorState`.
This is correct.

### 6. Readonly signal array elements
When a method like `toggleRecipient(r: Recipient)` mutates `r.selected`, it's mutating an element
of an array held in a signal. Angular's signal change detection is reference-based — mutating an
element does NOT trigger change detection. The correct pattern (already in the codebase for
`bulkRows`) is to do `this._recipients.update(arr => arr.map(x => x.id === r.id ? {...x, selected: !x.selected} : x))`.
Apply this pattern to `toggleRecipient`, `toggleAllRecipients`, and anywhere else an array element is mutated directly.

### 7. `daysToFeb2` / `daysToMar31`
These were plain `get` getters. Convert to `readonly` computeds in the service:
```ts
private readonly today = new Date('2026-01-14T12:00:00');
daysUntil(date: string): number { /* copy body */ }
readonly daysToFeb2  = computed(() => this.daysUntil('2026-02-02'));
readonly daysToMar31 = computed(() => this.daysUntil('2026-03-31'));
```

### 8. The `walletBalance` field
`walletBalance = 100` was a plain property. Make it a readonly signal:
```ts
private readonly _walletBalance = signal(100);
readonly walletBalance = this._walletBalance.asReadonly();
```
It is only displayed, never mutated, so no setter is needed.

### 9. Import path corrections
All sub-components live under `dashboard/components/<name>/`.
The import path back to `dashboard.service.ts` is:
```ts
import { DashboardService } from '../../dashboard.service';
```
The import back to `add-to-cart.ts` from `wizard-step-review` is:
```ts
import { AddToCartComponent } from '../../../../components/add-to-cart/add-to-cart';
```

### 10. `@if` vs `@else if` in `dashboard.html`
The original template used `@if / @else if / @else` for `activeView`.
The new `dashboard.html` uses three independent `@if` blocks.
The done screen (`@else` case) moves into `filing-wizard.html` where it is shown with `@if (ds.activeView() === 'done')`.

### 11. `step = 3` inline assignments in templates
Several templates had `(click)="step = 3"` or `(click)="step = 2"` (template-level property assignment).
These must be replaced with method calls: `(click)="ds.goStep(3)"`.
Search for all such inline assignments before finishing each component's template.

### 12. `NgClass` pipe dependency
`NgClass` is imported from `@angular/common`. Several components need it (recipients table uses `[class.sel]`,
wizard steps use `[ngClass]="..."` on chips). Add it to each component's `imports` array wherever the
template contains `[ngClass]` or `[class.something]` bindings.

### 13. `number` pipe
The amounts table uses `{{ necTotalBox1 | number:'1.2-2' }}`. The `number` pipe comes from `CommonModule` / `DecimalPipe`.
Add `DecimalPipe` (or `CommonModule`) to `WizardStepAmountsComponent`'s imports.
```ts
import { DecimalPipe } from '@angular/common';
// add DecimalPipe to imports array
```

---

## File tree summary

```
src/app/views/taxseer/pages/dashboard/
├── dashboard.ts                          ← MODIFY (slim orchestrator)
├── dashboard.html                        ← MODIFY (3 @if + toast)
├── dashboard.service.ts                  ← CREATE (all state + logic)
├── nec-amounts.types.ts                  ← DO NOT TOUCH
└── components/
    ├── dashboard-home/
    │   ├── dashboard-home.ts             ← CREATE
    │   └── dashboard-home.html           ← CREATE
    ├── filing-wizard/
    │   ├── filing-wizard.ts              ← CREATE
    │   └── filing-wizard.html            ← CREATE
    ├── wizard-step-filer/
    │   ├── wizard-step-filer.ts          ← CREATE
    │   └── wizard-step-filer.html        ← CREATE
    ├── wizard-step-form/
    │   ├── wizard-step-form.ts           ← CREATE
    │   └── wizard-step-form.html         ← CREATE
    ├── wizard-step-recipients/
    │   ├── wizard-step-recipients.ts     ← CREATE
    │   └── wizard-step-recipients.html   ← CREATE
    ├── wizard-step-bulk-upload/
    │   ├── wizard-step-bulk-upload.ts    ← CREATE
    │   └── wizard-step-bulk-upload.html  ← CREATE
    ├── wizard-step-amounts/
    │   ├── wizard-step-amounts.ts        ← CREATE
    │   └── wizard-step-amounts.html      ← CREATE
    ├── wizard-step-bulk-check/
    │   ├── wizard-step-bulk-check.ts     ← CREATE
    │   └── wizard-step-bulk-check.html   ← CREATE
    ├── wizard-step-review/
    │   ├── wizard-step-review.ts         ← CREATE
    │   └── wizard-step-review.html       ← CREATE
    └── filer-recipient-panel/
        ├── filer-recipient-panel.ts      ← CREATE
        └── filer-recipient-panel.html    ← CREATE
```

**Total files:** 1 service + 10 component pairs + 2 modified files = **23 files touched**.
