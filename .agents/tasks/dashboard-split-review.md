# Angular Dashboard Feature Split

The monolithic dashboard component has been decomposed into a service-owned state layer and a tree of
eleven standalone feature components. `DashboardService` now owns all reactive state as signals;
`TaxseerDashboard` (the host) drops to a 41-line shell that bootstraps the service and routes
keyboard escape events. The split follows the criteria defined by the task: no `@Input`/`@Output` on
any dashboard-owned component, all templates drive exclusively through `ds.xxx()` signal calls, and
the two-way `[(ngModel)]` pattern is absent throughout.

Watch for: (1) `NgClass` is named in `dashboard-home.ts`'s TypeScript `import` statement but is
absent from the component's `imports` array — **likely** a dead import left over from refactoring;
the template does not use `ngClass` so it has no runtime effect but will produce a TSC
`no-unused-imports` lint warning. (2) `AddToCartComponent` retains `@Input`/`@Output` decorators —
this is the explicit exemption stated in criterion 2 and is correct. (3) Three plain (non-signal)
private fields exist in `DashboardService`; all three are intentionally non-reactive and are
documented as such in the source.

**Verdict**: APPROVED

## High-level view

`DashboardService` holds every writable signal behind private `_xxx` fields exposed only through
`.asReadonly()` surfaces, with typed setter methods and field-level updater helpers covering every
property that templates need to mutate. The three non-signal fields (`_toastTimer`,
`panelFilerId`, `panelRecipientId`) are intentionally non-reactive: the first is a browser timer
handle, the second and third are edit-cursor trackers that only feed a create-vs-update branch at
save time and never drive any template expression. The source comment calls this out explicitly.

The host `TaxseerDashboard` (41 lines) is well under the 60-line cap. Its only responsibilities are
injecting `DashboardService`, bootstrapping `loadFilers()` on init, reading query-param deep-links in
the constructor, and routing escape-key events — none of which belong in a child component.

`FilingWizardComponent` owns both the wizard steps (step 1–5) and the done screen
(`activeView() === 'done'`), rendered in separate `@if` blocks in `filing-wizard.html`. The done
screen is not a separate component.  `DashboardHomeComponent` owns the chooser modal, rendered inline
at the bottom of `dashboard-home.html` behind `@if (ds.chooserOpen())`. `FilerRecipientPanelComponent`
owns the full slide-over drawer HTML. These three structural placements satisfy criteria 8, 9, and 10.

Every `ngModel` binding on a signal-backed property uses the split `[ngModel]="ds.xxx()"
(ngModelChange)="ds.xxx($event)"` pattern. No two-way `[(ngModel)]` syntax appears anywhere in the
dashboard HTML tree.

The one anomaly is a dead `NgClass` import in `dashboard-home.ts`. It is named in the TypeScript
`import` statement (`import { CommonModule, NgClass } from '@angular/common'`) but omitted from the
`@Component imports` array and unused in the template. This produces no runtime error and no
behavioral regression — Angular will not include it in the component's injector — but it will surface
as a linter warning.

<details>
<summary>Issues (1)</summary>

1. **Dead NgClass import in DashboardHomeComponent** — `NgClass` is named in the TypeScript
   `import { CommonModule, NgClass }` statement on line 2 of `dashboard-home.ts` but is missing from
   the `@Component({ imports: [...] })` array and unused in `dashboard-home.html`. Remove it from
   the `import` statement to eliminate the lint warning. Confidence: **confirmed**.

</details>

<details>
<summary>Details</summary>

### Signal completeness in DashboardService

All mutable UI state — active view, wizard step, filer/recipient lists, form search, panel state,
toast, bulk rows, amount rows, delivery map, chooser open/close — is declared as a private
`signal<T>()` and surfaced via `.asReadonly()`. Computed signals derive every derived view (filtered
lists, step labels, footer messages, done-screen text) without duplicating logic in templates.

The three non-signal private fields are `_toastTimer?: number` (a `window.setTimeout` return value
used only for cancellation, carries no template state), and `panelFilerId` / `panelRecipientId`
(edit-cursor numbers that determine the create-vs-update branch inside `saveFiler` / `saveRecipient`
but are never read in a template expression). The service source includes an inline comment documenting
the intent. No reactive state belongs in a plain property.

### Standalone component topology

All eleven components — `DashboardHomeComponent`, `FilingWizardComponent`,
`FilerRecipientPanelComponent`, and the eight `wizard-step-*` components — are declared
`standalone: true` and carry no `@Input` or `@Output` decorators. Each injects `DashboardService`
and exposes it as `readonly ds`. The exempted `AddToCartComponent` (an external reusable widget) does
use `@Input() filings` and `@Output() cartUpdated`, which is consistent with criterion 2.

### ngModel binding pattern

Searched all dashboard HTML for `[(ngModel)]` — zero matches. Every form field uses the split
pattern: `[ngModel]="ds.xxx()" (ngModelChange)="ds.updateXxx($event)"` or equivalent field-updater
calls (`ds.updateFilerField(...)`, `ds.updateRecipientForm(r => ({...r, key: $event}))`). The
`mat-radio-group` value binding also follows the split pattern with `[value]` and `(change)`.

### Dead NgClass import

`dashboard-home.ts` line 2: `import { CommonModule, NgClass } from '@angular/common'`. The component
`imports` array contains `[CommonModule, FormsModule, MatButtonModule, MatChipsModule,
MatInputModule]` — `NgClass` is absent. The template has no `[ngClass]` bindings. The import is
inert at runtime but produces a lint warning and adds noise to the import line. Remove `NgClass` from
the import statement. Confidence: **confirmed** (read source file and template).

### HTML structural placement (criteria 8–10)

- `filing-wizard.html` contains both the `@if (ds.activeView() === 'wizard')` block (steps) and
  `@if (ds.activeView() === 'done')` block (done screen). Criterion 8 satisfied.
- `dashboard-home.html` contains the `@if (ds.chooserOpen())` block with the full modal HTML at the
  bottom of the template. Criterion 10 satisfied.
- `filer-recipient-panel.html` is the entire slide-over drawer (scrim + `<aside role="dialog">`).
  Criterion 9 satisfied.

</details>

---

<details>
<summary>File map</summary>

| File | What changed |
|---|---|
| `dashboard.ts` | Host reduced to 41-line shell; all state moved to service |
| `dashboard.html` | Delegates to three child selectors + toast div |
| `dashboard.service.ts` | All state as signals; all methods; computed signals |
| `components/dashboard-home/dashboard-home.ts` | New standalone component; dead `NgClass` import |
| `components/dashboard-home/dashboard-home.html` | Dashboard main view + chooser modal |
| `components/filing-wizard/filing-wizard.ts` | New standalone component |
| `components/filing-wizard/filing-wizard.html` | Wizard steps + done screen |
| `components/filer-recipient-panel/filer-recipient-panel.ts` | New standalone component |
| `components/filer-recipient-panel/filer-recipient-panel.html` | Slide-over drawer HTML |
| `components/wizard-step-filer/wizard-step-filer.ts` | New standalone step component |
| `components/wizard-step-form/wizard-step-form.ts` | New standalone step component |
| `components/wizard-step-recipients/wizard-step-recipients.ts` | New standalone step component |
| `components/wizard-step-amounts/wizard-step-amounts.ts` | New standalone step component |
| `components/wizard-step-bulk-upload/wizard-step-bulk-upload.ts` | New standalone step component |
| `components/wizard-step-bulk-check/wizard-step-bulk-check.ts` | New standalone step component |
| `components/wizard-step-review/wizard-step-review.ts` | New standalone step component; imports `AddToCartComponent` |

</details>
