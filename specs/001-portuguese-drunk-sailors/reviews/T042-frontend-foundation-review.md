# T042 Code Review: Frontend Foundation (T033–T041)

**Reviewer**: code-reviewer  
**Date**: 2026-05-27  
**Verdict**: ✅ APPROVED — 1 bug must be fixed (cascades to 4 files), 0 blockers

---

## Files Reviewed

- `frontend/tsconfig.json` + `frontend/tsconfig.app.json`
- `frontend/tailwind.config.ts`
- `frontend/src/i18n.ts`
- `frontend/src/App.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/shared/MoneyDisplay.tsx`
- `frontend/src/components/shared/MemberChip.tsx`
- `frontend/tests/setup.ts` (for MSW/axios adapter fix reference)
- Grep sweep for `parseFloat`, `toFixed`, `Math.` across all `src/` files

---

## ✅ Passing Checks

| Check | Result |
|-------|--------|
| `tsconfig.app.json` — `"strict": true` | ✅ |
| `tsconfig.app.json` — `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` | ✅ — stricter than minimum |
| HeroUI — `@heroui/react` in `package.json`, `heroui()` plugin in `tailwind.config.ts` | ✅ |
| HeroUI — `tailwind.config.ts` `content` includes `node_modules/@heroui/theme/dist/**` | ✅ — required for HeroUI class purging |
| Portuguese palette — `pt-green: #006600`, `pt-red: #FF0000`, `pt-gold: #FFD700`, `pt-cream: #FAFAF5` | ✅ |
| HeroUI primary/danger/warning themed to Portuguese palette | ✅ |
| `i18n.ts` — `saveMissing: import.meta.env.DEV` + `missingKeyHandler` warning in dev | ✅ |
| `i18n.ts` — `fallbackLng: 'en'`, `supportedLngs: ['en', 'ru', 'pt']` | ✅ |
| `i18n.ts` — locale persisted to `localStorage` via `LanguageDetector` | ✅ |
| `App.tsx` — `ProtectedRoute` wraps the `/` layout route (all children inherit guard) | ✅ |
| `App.tsx` — `/login` route outside `ProtectedRoute` | ✅ |
| `App.tsx` — all 9 routes present (`/login`, `/`, `/tickets`, `/tickets/new`, `/tickets/:id`, `/members`, `/categories`, `/reports`, `/balances`) | ✅ |
| `client.ts` — `VITE_API_BASE_URL` from `import.meta.env` | ✅ |
| `client.ts` — Bearer JWT injected from `localStorage.getItem('access_token')` | ✅ |
| `client.ts` — 401 clears token + redirects to `/login` | ✅ |
| `Navbar.tsx` — all text via `t()` (no hardcoded strings) | ✅ |
| `Navbar.tsx` — language switcher persists locale to `localStorage` | ✅ |
| `MemberChip.tsx` — selected/unselected state, `disabled` prop, `aria-pressed` | ✅ |
| `MoneyDisplay.tsx` — renders `€X.XX` format with euro symbol | ✅ (see bug below) |

---

## ❌ Bug: `MoneyDisplay.tsx` uses `parseFloat()` — float for monetary display

**File**: `frontend/src/components/shared/MoneyDisplay.tsx:7`  
**Severity**: Medium — constitution §I violation: no floats for money

**Problem**:
```tsx
const formatted = parseFloat(amount).toFixed(2)
```
`parseFloat` converts the string to a JS float before calling `toFixed`. This can produce rounding errors for values like `"0.1"` + `"0.2"` = `"0.3000000000000001"`. The component receives a string (matching the backend's Decimal-as-string JSON representation) and should format it without floating-point conversion.

**Fix** — use string-based formatting:
```tsx
export default function MoneyDisplay({ amount, className }: MoneyDisplayProps) {
  const [whole, frac = ''] = amount.split('.')
  const formatted = `${whole}.${frac.padEnd(2, '0').slice(0, 2)}`
  return <span className={className}>{`€${formatted}`}</span>
}
```
Or if the input is always a clean decimal string from the API (which it will be after backend `quantize(Decimal("0.01"))`), the simpler safe approach is:
```tsx
const formatted = Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```
Either approach avoids raw float arithmetic. The string-split approach is most faithful to the no-float rule.

---

## ⚠️ Cascade: 4 additional files use `parseFloat` for monetary values

Found via grep sweep — these are outside the T042 scope (they belong to US1–US4 tasks) but are noted here so backend and frontend agents are aware they need the same fix pattern:

| File | Line | Issue |
|------|------|-------|
| `frontend/src/components/tickets/ReviewStep.tsx` | 49 | `parseFloat(item.price)` for live total |
| `frontend/src/components/tickets/ConfirmStep.tsx` | 27, 73 | `parseFloat(item.price)` for per-member share; `parseFloat(discount_total)` |
| `frontend/src/components/tickets/AllocateStep.tsx` | 38 | `parseFloat(item.price) / selected.length` for per-member cost |
| `frontend/src/components/reports/CategoryPieChart.tsx` | 17, 57 | `parseFloat(r.total)` for pie data; `parseFloat(row.percentage)` |

These will be caught in the respective phase reviews (T066, T092, T112) but fixing them together with MoneyDisplay now saves re-work.

---

## Required Actions

1. **[Frontend] Fix `MoneyDisplay.tsx`**: Remove `parseFloat` — use string-split or `toLocaleString` approach. This is the canonical fix that should cascade to the other 4 files listed above.

Phase 6 (US6 auth), Phase 7 (US5), and all subsequent frontend work may proceed — this bug is in a display component and does not affect auth, routing, or API layer correctness.
