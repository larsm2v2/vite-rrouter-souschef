# Design system

The visual and interaction rules of the SousChef client, **as built**, plus the rules to follow when adding to it. Everything in the "as built" tables was read from `client/src` (file references in brackets). Where the code is inconsistent, section 9 says so rather than hiding it.

Related: [architecture.md](architecture.md), [build-and-release.md](build-and-release.md). The research behind the interaction rules is in [mobile-recipe-ux-roadmap.md](mobile-recipe-ux-roadmap.md).

---

## 1. Principles

These came out of reviewing the best mobile recipe apps and are the reason for most behaviours below. Each has a concrete rule.

| #   | Principle                                       | Rule that follows                                                                                                                                                                                      |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | Design for busy, messy hands                    | Cooking has its own full-screen mode. Primary controls are at least 56 px tall and sit in the thumb zone. Nothing destructive in cook mode.                                                            |
| P2  | The recipe is a working document                | Anything the user changes while cooking (step, checks, scale, timers) is saved per user and per recipe and survives a reload. No state only in memory.                                                 |
| P3  | Do the busywork                                 | Merge duplicate ingredients, group by aisle, convert compatible units. One merge implementation per runtime, driven by one shared fixture. Never merge by fuzzy matching; never silently drop an item. |
| P3b | Design for interruption                         | Drafts and timers are saved as you go. Reopening resumes.                                                                                                                                              |
| P4  | Be self-sufficient in one window                | No copy-and-paste between apps where the app can do it (import, share, copy list for Keep).                                                                                                            |
| P5  | Respect touch; make destructive taps reversible | Targets are at least 44 px. A destructive action is **undoable for 8 seconds**. Do not add `confirm()` dialogs.                                                                                        |
| P6  | Personalize once, reuse everywhere              | Per-user choices are stored once and reused.                                                                                                                                                           |
| P7  | Keep users' data portable                       | Export paths (copy list, share link) are first-class.                                                                                                                                                  |

---

## 2. Foundations

### 2.1 Color

Canonical color tokens live on `:root` in `index.css`. Older semantic names remain as aliases while component styles migrate. New CSS should use the canonical name.

| Role                              | Token                                                            | Value                           |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| Primary / navy-teal               | `--color-primary`                                                | `#154153`                       |
| Primary hover                     | `--color-primary-hover`                                          | `#317a97`                       |
| Accent / gold                     | `--color-accent`                                                 | `#fabf2c`                       |
| Accent soft / cream               | `--color-accent-soft`                                            | `#f8e1a7`                       |
| Link                              | `--color-link`                                                   | `#2266ff`                       |
| Text / muted text                 | `--color-text`, `--color-text-muted`                             | `#072733`, `#6b7280`            |
| Page / muted background / surface | `--color-page`, `--color-background-muted`, `--color-surface`    | `#ffe298`, `#f5f5f5`, `#ffffff` |
| Border                            | `--color-border`                                                 | `#e5e7eb`                       |
| Success / error                   | `--color-success`, `--color-error`                               | `#2e7d32`, `#c62828`            |
| Warning                           | `--color-warning-background`, `--color-warning-text`             | `#fff3cd`, `#8a5318`            |
| Cook mode                         | `--color-cook-background`, `--color-cook-text`                   | `#fffdf5`, `#0b2530`            |
| Login "terra" set                 | `--color-terra-light`, `--color-terra-mid`, `--color-terra-dark` | `#ffefdf`, `#b88f6c`, `#705c4a` |

Compatibility aliases include `--primary-color`, `--secondary-color`, `--tertiary-color`, `--primary-text-color`, `--secondary-text-color`, `--primary-background-color`, `--tertiary-background-color`, `--text-light`, `--border`, and `--surface`.

Approved text pairs (WCAG ratio, 4.5 needed for normal text):

| Pair                   | Ratio |
| ---------------------- | ----- |
| `#f8e1a7` on `#154153` | 8.53  |
| `#fabf2c` on `#154153` | 6.56  |
| `#154153` on `#fabf2c` | 6.56  |
| `#154153` on `#ffe298` | 8.67  |
| `#072733` on `#ffe298` | 12.31 |
| `#ffffff` on `#154153` | 10.98 |
| `#6b7280` on `#ffffff` | 4.83  |

There is **no dark mode** (no `prefers-color-scheme`, no theme switch).

### 2.2 Typography

| Item      | As built                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Family    | `Biko, sans-serif` on `#root` [`index.css:35`]. **Biko is never loaded** (no `@font-face`, no link), so it renders as the system sans-serif |
| Mono      | `var(--font-mono)` for OCR text and JSON                                                                                                    |
| Base size | `--font-size-base: 1rem` on `#root` (16 px at the browser default)                                                                          |
| Sizes     | Mostly `rem`; common component values include `0.9rem`, `0.85rem`, `0.95rem`, `1.1rem`. No global heading scale.                            |
| Weights   | 600 (most used), 700, 500                                                                                                                   |
| Headings  | No global heading scale. Each component sets its own (`1.05rem` in cook mode up to `2rem` on login)                                         |
| Cook step | `1.375rem` times the user's font scale, bounded 0.8 to 1.8 [`CookMode.tsx:166`]                                                             |
| Inputs    | Use at least 16 px to avoid iOS focus-zoom (the navbar search does; three other inputs do not)                                              |

### 2.3 Spacing, size and shape

| Scale     | Tokens                                                                      | Values                                                             |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Spacing   | `--space-1` through `--space-6`                                             | 4, 8, 12, 16, 24, 32 px                                            |
| Radius    | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill` | 4, 6, 8, 12, 999 px                                                |
| Layout    | `--header-height`, `--dock-height`, `--sidebar-width`, `--gap`              | 64 px (56 px at 600 px and below), 60 px, 320 px, `var(--space-2)` |
| Safe area | `--safe-top`, `--safe-bottom`                                               | `env(safe-area-inset-*)`; use for content pinned to device edges   |

### 2.4 Touch targets

| Target                                     | Size                        |
| ------------------------------------------ | --------------------------- |
| Minimum for any tappable control           | **44 px** (39 declarations) |
| Start-cooking button                       | 48 px                       |
| Cook-mode controls, floating action button | 56 px                       |
| Dock                                       | 60 px                       |
| Checkbox glyph                             | 22 px inside a 44 px label  |

### 2.5 Elevation and layering

Use the semantic layer tokens. New overlays must fit this order and update the token and table together.

| Token                  |    z | Layer                            |
| ---------------------- | ---: | -------------------------------- |
| `--z-drawer-header`    |    1 | Sticky drawer header             |
| `--z-sticky`           |   25 | App header                       |
| `--z-cook-sheet`       |   50 | Cook ingredient sheet backdrop   |
| `--z-floating-mobile`  |  140 | Floating action button (phones)  |
| `--z-mobile-dock`      |  150 | Mobile dock                      |
| `--z-scrim`            |  160 | Drawer scrim                     |
| `--z-drawer`           |  200 | Drawers                          |
| `--z-drawer-tab`       |  201 | Desktop edge tabs                |
| `--z-floating-desktop` | 1000 | Floating action button (desktop) |
| `--z-modal`            | 1100 | Import/edit modal                |
| `--z-toast`            | 1200 | Toast viewport (always on top)   |

### 2.6 Motion

| Where                           | Motion                                               |
| ------------------------------- | ---------------------------------------------------- |
| Drawers                         | `transform` `var(--motion-drawer)` / standard easing |
| Toast enter                     | `var(--motion-fast)` / emphasized easing, 8 px rise  |
| Cook progress                   | `var(--motion-standard)` / standard easing           |
| Hover and state changes         | 0.12 to 0.2 s                                        |
| Pane switching in import review | smooth scroll (instant when reduced motion)          |

`prefers-reduced-motion: reduce` is honored for drawers, the cook progress bar and import-review scrolling. It is **not** honored for toast entry, the chef-hat draw animation, the caret blink, hover transitions or smooth `scrollIntoView`. New motion must respect it.

### 2.7 Breakpoints and viewport

| Breakpoint           | Meaning                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **900 px and below** | "Mobile" layout: drawers are overlays, dock and floating action button appear. JS constant `MOBILE_QUERY` in `MainLayout.tsx` and the CSS rules must agree (they are copied by hand) |
| 1100 px and above    | Import review shows original and parsed side by side (`WIDE_QUERY` in `ImportReview.tsx`)                                                                                            |
| 600 px and below     | Header shrinks to 56 px; compact navbar and modals                                                                                                                                   |
| 480 px and below     | Smallest-phone tweaks                                                                                                                                                                |

Other values in the CSS (420, 460, 640, 700, 768) are one-offs. Prefer 900/600/480. Use `100dvh` (with a `100vh` fallback) for full-height surfaces. There are no hover, pointer or dark-mode queries.

---

## 3. Layout patterns

| Pattern          | Rules                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell        | Header, left grocery drawer, `main`, optional right index drawer, bottom dock on phones                                                            |
| Drawer (phones)  | Overlay at z 200, slides 220 ms, scrim, `main` becomes `inert`, focus trapped, Escape and 60 px swipe toward its edge close it, page scroll locked |
| Drawer (desktop) | Docked beside `main`; edge tabs toggle it; no trap                                                                                                 |
| Full-screen mode | Cook mode lives on its own route outside the shell                                                                                                 |
| Bottom sheet     | Cook ingredients sheet (`max-height: 80dvh`), a labelled `dialog`, trapped, Escape closes                                                          |
| Pane pair        | Import review: scroll-snap tabs on narrow screens, side by side from 1100 px                                                                       |
| Never overflow   | Nothing may be wider than the viewport. Checked by tests against `page.viewportSize().width`, not `innerWidth`                                     |

---

## 4. Component inventory

Paths are under `client/src/components` unless noted.

### 4.1 Shell and navigation

| Component                                   | Purpose                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `layout/MainLayout`                         | The shell described above. Owns drawer state, `useIsMobile()`, scroll lock, focus restore, Escape handling |
| `Navbar/Navbar`                             | Search (`role="search"`, collapses to an icon at 900 px), links, copy-to-Keep, avatar                      |
| `Sidebar/Sidebar`                           | Hosts the grocery list in the left drawer                                                                  |
| `Recipes/Recipe Details/RecipeIndexSidebar` | In-page nav (IntersectionObserver) and recipe index                                                        |
| `common/FloatingActionButton`               | "Create Recipe" entry to the import dialog                                                                 |
| `auth/ProtectedRoute`                       | Route guard                                                                                                |

### 4.2 Feedback and overlays

| Component                                    | Purpose and contract                                                                                                                                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `common/Toast` (`ToastProvider`, `useToast`) | `showToast(message, type, { action, durationMs, onClose })` returns an id. Types `success`, `error`, `info`. 3.5 s default; **8 s with an action**; max 3 visible (oldest evicted, its `onClose` still runs); hover or focus pauses; `role="status"`, `aria-live="polite"` |
| `common/ToastSafeFocusTrap`                  | The only focus trap to use. It adds the toast viewport to the trap so a keyboard user can reach Undo                                                                                                                                                                       |
| `common/OCRModal`                            | Five-tab import dialog (upload, text, gallery, URL, review) with draft saving; failed URL imports explain the block and switch to paste-and-parse; `dialog`, `aria-modal`                                                                                                  |
| `common/ImportReview`                        | Original versus parsed, tabs with arrow-key support                                                                                                                                                                                                                        |
| `common/ParsedRecipeEditor`                  | Editable recipe; removals are undoable and restore into the _current_ recipe                                                                                                                                                                                               |
| `common/ImageGallery`, `common/AuthImage`    | Uploaded files with undoable delete; images fetched as authenticated blobs                                                                                                                                                                                                 |

### 4.3 Grocery list

| Component                    | Purpose                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `GroceryList/GroceryList`    | Server-synced list: debounced autosave (500 ms), versioned, 409 merge, copy and share |
| `GroceryList/EditableList`   | Add form and aisle sections with an "In cart" group; undoable delete                  |
| `GroceryList/SingleListItem` | One row with inline edit and aisle select                                             |

### 4.4 Recipes and cooking

| Component                                | Purpose                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Recipes/RecipesIndex`                   | Search and filter, grouped by meal type                                                                       |
| `RecipeDisplay/RecipeDisplay`            | Chooses the recipe to show                                                                                    |
| `Recipes/Recipe Details/RecipeDetails`   | The reading page: favorite, add to list, share, edit, start cooking, scaler, check-off, timers                |
| `Cook/CookMode`                          | Full-screen steps, progress, font scale, ingredient sheet, wake lock, swipe and arrow navigation              |
| `Cook/ServingScaler`                     | Half, 1, 2 and 3 times chips plus a stepper; warns past 3 times or under 0.5 times that scaling is non-linear |
| `Cook/TimerTray`, `Cook/InstructionText` | Persisted timers; detected durations in instructions become tappable timer chips                              |

### 4.5 Hooks

| Hook             | Contract                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useUndoable`    | `({ message, apply, revert, commit?, windowMs })`: apply now, show an Undo toast, run `commit` when the toast closes (flushed on `pagehide` and on the page going hidden) |
| `useUserStorage` | User-scoped, versioned `localStorage` state with an optional max age and cross-tab sync                                                                                   |
| `useCookState`   | Step, checks, scale, font scale per recipe (12 h)                                                                                                                         |
| `useTimers`      | Absolute end times, 250 ms tick, max 12, 24 h; beeps and vibrates on finish                                                                                               |
| `useWakeLock`    | Requests a screen wake lock and re-acquires it when the tab becomes visible; reports support                                                                              |
| `useRecipe`      | Fetch one recipe                                                                                                                                                          |

### 4.6 Unused or legacy (do not copy)

`Thumbnail/`, `auth/DevLogin`, `FormInputs/FormAction.tsx` (empty), `pages/ApiRequest*`, `App.css` (Vite template).

---

## 5. Interaction patterns

### 5.1 Destructive actions: undo, never confirm

1. Apply the change immediately (optimistic).
2. Show a toast "<thing> removed" with **Undo** for 8 seconds.
3. Undo restores into the **current** state, not a stale snapshot (edits made during the window survive).
4. Anything irreversible on the server (deleting a file) is **deferred until the toast closes** and flushed if the page hides.

Used by: grocery item delete, taking a recipe off the plan, gallery delete, import-editor ingredient and step removal. No `confirm()`, `alert()` or `prompt()` remains in the app.

### 5.2 Drafts and resumable work

Long forms save as the user types (500 ms debounce) to user-scoped storage with an expiry (7 days for imports). Closing keeps the draft and says so ("Draft saved. Reopen Create Recipe to resume.") with a Discard action. Finishing clears it.

### 5.3 Focus and keyboard

- Overlays (phone drawers, import dialog, cook sheet) trap focus with `ToastSafeFocusTrap`, set `escapeDeactivates: false`, and handle Escape themselves.
- Content behind an overlay is `inert`. Closed drawers are `inert`.
- Keys: Escape closes the topmost overlay (the import dialog keeps its draft); Left/Right change cook steps (ignored in text fields and while the sheet is open); Left/Right move between review tabs.
- Every action reachable by touch must be reachable by keyboard. Tests use real Tab presses, not `.focus()`.

### 5.4 Gestures

| Gesture                                 | Threshold              | Where              |
| --------------------------------------- | ---------------------- | ------------------ |
| Swipe a drawer toward its edge          | 60 px, horizontal wins | `MainLayout.tsx`   |
| Swipe left/right for next/previous step | 60 px, horizontal wins | `CookMode.tsx`     |
| Swipe between original and parsed       | Native scroll-snap     | `ImportReview.css` |

Every gesture has a button or key equivalent.

### 5.5 Hardware

Wake lock while cooking with a visible state ("Screen stays on", "Screen may sleep", "Screen lock off", "Screen lock unavailable"); camera input for photo import; `navigator.share` for the list where available (hidden where not); vibration and audio on timers.

### 5.6 Persistence rules

| Data                                 | Where                      | Lifetime                      |
| ------------------------------------ | -------------------------- | ----------------------------- |
| Account data (recipes, grocery list) | Server                     | Permanent                     |
| Cooking progress, scale, checks      | `localStorage`, per recipe | 12 h                          |
| Timers                               | `localStorage`, per recipe | 24 h                          |
| Import draft                         | `localStorage`             | 7 days                        |
| Access token                         | Memory only                | Until reload (silent refresh) |

All user-scoped keys are wiped on logout.

---

## 6. Accessibility standard

A change is not done until it meets these:

1. Every control has an accessible name (text, `aria-label`, or a real `<label>` tied to the input). Icon-only buttons need `aria-label`.
2. Visible focus on every interactive element. Do not use `outline: none` without an equally visible replacement.
3. Text contrast at least 4.5:1 (3:1 for large text and UI borders). Use the approved pairs in 2.1 or compute the ratio.
4. Status changes are announced (`role="status"` or `aria-live="polite"`); urgent ones use `role="alert"` (finished timers).
5. Overlays are labelled dialogs with a focus trap, Escape, and focus returned on close.
6. Respect `prefers-reduced-motion`.
7. Touch targets at least 44 px.
8. Render user and imported text as text. Never inject recipe content as HTML.

---

## 7. Naming and file conventions

| Thing      | Convention                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Components | PascalCase, one per file, default export, in a PascalCase folder (`Cook/CookMode.tsx`)                                                                                                                           |
| Hooks      | `use*.ts` in `src/hooks`, named export (`useUndoable`)                                                                                                                                                           |
| Utilities  | camelCase `.ts` in `src/utils`; pure logic shared with the server is called out in the architecture doc                                                                                                          |
| CSS        | One `.css` file beside the component, imported by it. kebab-case class names. BEM-style (`block__element--modifier`) is used in the grocery area. Prefix new classes with the component name to avoid collisions |
| Tests      | Unit: `*.test.ts` beside the code (Vitest). End-to-end: `client/e2e/tests/*.spec.ts` (Playwright)                                                                                                                |

---

## 8. Checklists

**New component**: folder and file per 7; own `.css`; accessible names; focus style; 44 px targets; works at 900 px and 600 px; no overflow at the smallest phone width; reduced-motion respected.

**New overlay** (dialog, drawer, sheet): use `ToastSafeFocusTrap`; mark the rest `inert`; handle Escape; lock page scroll; restore focus on close; pick a z-index from 2.5; add a Playwright test that reaches its buttons with Tab.

**New destructive action**: `useUndoable`, 8 s, restore into current state; defer irreversible server work to commit. Test: act, Undo, item is back in place; and the commit happens when the toast closes.

**New persisted state**: `useUserStorage` with a feature name and a max age; confirm `clearAllUserData()` wipes it on logout; never store tokens.

**New status color or token**: add it to `index.css` and to section 2.1 in the same change.

---

## 9. Known inconsistencies (do not repeat them)

Verified in the code; fixing them is a separate piece of work.

| Area           | Issue                                                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens         | Canonical palette, spacing, radius, motion and z-index tokens now live in `index.css`; 338 CSS `var()` uses, 0 literal z-index declarations, 0 repeated core brand colors outside the token file. About 155 one-off hex literals (60 distinct) remain, mainly legacy screen/status colors. Legacy aliases remain during migration. |
| Typography     | Biko font declared but not loaded. No heading scale. An unscoped `p` rule (14 px, weight 200) applies app-wide                                                                                                                                                                                                                     |
| Breakpoints    | 13 distinct media conditions; the 900 px mobile breakpoint is duplicated by hand between CSS and JS                                                                                                                                                                                                                                |
| Z-index        | All 11 layers now use semantic tokens. The floating action button intentionally has separate mobile (140) and desktop (1000) layers.                                                                                                                                                                                               |
| Naming         | Three class styles (kebab-case, BEM-ish, camelCase). Colliding class names across files (`.form-group`, `.error-message`, `.surprise`, `.recipe-index`, `.sidebar-toggle-tab`). Global `input` and `p` rules leak across screens                                                                                                   |
| Colors         | Per-action hues outside the brand (pink, green, purple, blue on recipe action buttons; other greens, blues and reds in pantry and generator screens)                                                                                                                                                                               |
| Motion         | Reduced motion not honored for toasts, chef animation, caret, hover transitions and smooth scroll-into-view                                                                                                                                                                                                                        |
| Accessibility  | Unlabelled inputs in the pantry list, inline grocery edit, profile search, recipes search and the SousChef prompt form; `FormInput` labels are not associated with controls; `:focus-visible` rules exist in only 8 files; two inputs remove the outline with no replacement                                                       |
| Contrast fails | `#ffe298` text on `#f8e1a7` in the grocery drawer (ratio 1.02, children that inherit the color); white on `#5cb85c` (2.48), `#ff6b9d` (2.68), `#4caf50` (2.78), `#2196f3` (3.12), `#4a90e2` (3.29); `#999999` on white (2.85); `#007bff` on `#ffefdf` (3.54)                                                                       |
| Small inputs   | 13 px and 15 px inputs trigger iOS focus-zoom                                                                                                                                                                                                                                                                                      |
| Dead code      | `.todos__single` CSS loads an external image; unused components (4.6)                                                                                                                                                                                                                                                              |

---

## 10. Where the rules are tested

| Rule                                               | Playwright spec                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| No horizontal overflow, drawers, dock, focus traps | `layout.spec.ts`, `pages.spec.ts`                                                                  |
| Cook mode, timers, scaler, wake lock, check-off    | `cook-features.spec.ts`                                                                            |
| Grocery merge, aisles, undo, drafts, sync          | `grocery-undo-draft.spec.ts`, `grocery-sync.spec.ts`, `grocery-copy-to-keep.spec.ts`               |
| Import review and editor undo                      | `import-review.spec.ts`, `import-editor-undo.spec.ts`                                              |
| Saved recipe editing                               | `recipe-edit.spec.ts` plus `recipes.update.integration.test.ts` (real PostgreSQL, owner isolation) |
| Ingredient display of strings and objects          | `ingredient-display.spec.ts`                                                                       |
| Sharing, URL import, sign-in                       | `recipe-share.spec.ts`, `url-import.spec.ts`, `google-pkce.spec.ts`                                |

Unit tests for the pure logic (quantity, units, ingredient parsing, timers, merge) run under Vitest and share fixtures with the server.
