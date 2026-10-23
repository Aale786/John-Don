# Taxseer styling — two layers

The UI is styled from two places, and each one owns a different decision.

| Layer | Lives in | Decides |
| --- | --- | --- |
| Root custom CSS | `src/styles/styles.scss` | How a control *looks*: typeface, type scale, colour, radius, elevation, control height |
| Component-level Tailwind | `src/app/views/taxseer/pages/**/*.html` | How a page is *laid out*: grid, spans, one-off widths and margins |

No Angular Material tag, directive or binding changes. Styling only reaches Material
through CSS and custom properties.

## Root custom CSS

`:root` holds the whole design system as tokens. Nothing below it should repeat a
literal value.

```
--navy --navy-2 --navy-3 --navy-tint --cart --cart-ink
--canvas --paper --soft --hover --line --line-2
--ink --ink-2 --ink-3
--green --amber --red --blue --support   (+ each *-tint, and --st-* aliases)
--font --font-mono
--fs-display --fs-title --fs-h2 --fs-h3 --fs-body --fs-small --fs-caption --fs-micro --fs-key --fs-stat
--sp-0 … --sp-14        2 4 6 8 10 12 14 16 18 20 24 32 40 px
--r-xs --r --r-md --r-lg --r-xl --r-2xl --r-pill
--sh-1 … --sh-4 --sh-foot
--h-topbar --h-control --h-control-sm --h-select --h-cta --w-content --w-panel --w-dialog
--dur-fast --dur --dur-slow --ease
--z-footer --z-topbar --z-popover --z-scrim --z-panel --z-toast
```

Shared primitives, all token-driven: `.page .head .card .card-h .tbl .toolbar
.search .sel .btn .pill .badge .tile .tiles .prog .note .callout .avatar .kv
.seg .row2 .row3 .switch .modal .scrim .toast .hint .small .muted`.

**`var()` fallbacks are deliberately absent.** A misspelled token now renders as an
invalid declaration and shows up in the audit, instead of silently drifting to a
plausible-looking colour.

## Angular Material bridge

`styles.scss` ends with a `ANGULAR MATERIAL BRIDGE` block. Material renders its own
internal DOM (`.mat-mdc-*`, `.mdc-*`), so the primitives above never reach it. This
block is the only place allowed to restate them, and it reads from the same tokens.

Two rules govern it:

1. **`color-scheme: light` on `.taxseer-layout`.** Fuse ships `html.scheme-dark`, so
   every Material `--mat-sys-*` token written as `light-dark()` resolved to its dark
   branch and painted near-black surfaces into light controls.
2. **Declare on the shell, not `:root`.** Material restates its own custom properties
   on `:root` *after* this file, so a `:root` remap loses on source order. A
   declaration on `.taxseer-layout` / `.cdk-overlay-container` inherits down to every
   control, and for inherited custom properties element proximity outranks source
   order. This is why `--mat-sys-*`, `--mat-button-*` and `--mat-tab-divider-color`
   are set there.

Anything Fuse styles at `#fuse` specificity has to be answered at the same
specificity — hence `#fuse .mat-mdc-form-field { --form-field-*: … }` and
`#fuse kbd`.

## Component-level Tailwind

Tailwind is imported `important`, so a utility beats root CSS at equal specificity.
That makes utilities a one-way door: once a page puts `px-10` on `.page`, no root
change can move it back.

So the rule is:

- **Reach for a root primitive first.** `<main class="page">`, not
  `class="page max-w-full mx-auto px-10 pt-6.5 pb-12"`.
- **Use Tailwind only where the page genuinely differs from the primitive** — a grid
  column count, a 240px select, a 20px header gap:
  `class="head [margin-bottom:var(--sp-9)]"`, `class="sel [width:240px]"`.
- **Never use Tailwind's default palette.** `bg-amber-50`, `border-slate-200`,
  `text-blue-200` are oklch values outside the Taxseer palette. Use the token:
  `bg-[var(--amber-tint)]`, or a named utility such as `text-taxseer-blue-muted`.
- **Never hardcode a hex in a class.** Use `var(--ink)`, not `text-[#17212e]`.
- Arbitrary values take the token, not a number: `[margin-bottom:var(--sp-9)]`.

## Verifying

The check is a computed-style sweep of `.taxseer-main` for any `color`,
`background-color`, `border-*-color` or `outline-color` that resolves to `oklch(...)`
while the border/outline is actually painted. A clean page reports zero.

```js
const root = document.querySelector('.taxseer-main');
const bad = {};
for (const el of root.querySelectorAll('*')) {
  const cs = getComputedStyle(el);
  for (const p of ['color','background-color','border-top-color','border-bottom-color','outline-color']) {
    const v = cs[p];
    if (!v || !v.startsWith('oklch')) continue;
    if (p.startsWith('border') && !(parseFloat(cs[p.replace('-color','-width')]) > 0 && cs[p.replace('-color','-style')] !== 'none')) continue;
    if (p === 'outline-color' && !(parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none')) continue;
    (bad[p + ' ' + v] = bad[p + ' ' + v] || []).push(el.tagName.toLowerCase() + '.' + el.className);
  }
}
console.log(bad);
```

Run it on `/taxseer/dashboard`, `/filers/1`, `/orders`, `/recipients`, `/settings`.
Also sweep the templates for references to undefined tokens — with fallbacks stripped,
one typo is enough to blank a colour:

```bash
node -e "/* see the pattern in the dangling-token check: collect --*: declarations from
styles.scss + tailwind/theme.css, then flag any var(--x) in pages/**/*.html that is absent */"
```

Note the in-app browser viewport is narrow, so `.page` and other elements report their
`@media (max-width: 700px)` values. Confirm desktop numbers from the CSSOM, not
`getComputedStyle`, when a media query is in play.

### Scale exceptions

Two sizes sit outside `--fs-*` because the reference itself puts them there or defines
no counterpart at all:

- `13.5px` — `.filerlist label`, verbatim from the reference.
- `20px` — `.profile-name` on Settings. The reference styles `.profile` but never the
  name, so this is a deliberate component-level choice, not drift.

Everything else must land on `11 / 12 / 12.5 / 13 / 14 / 15 / 16 / 18 / 22 / 24`.

