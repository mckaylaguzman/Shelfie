# Shelfie — Agent Guide

## Critical: Expo SDK 54

**Expo HAS CHANGED.** Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code. Do not rely on memory for Expo APIs — verify against v54 docs.

---

## What This App Is

**Shelfie** is a cozy, vintage-aesthetic book tracking app built with Expo SDK 54 and React Native. Users log books, track reading status (TBR → Reading → Finished), rate and review finished reads, and browse their shelf on a single home screen.

- **Repo:** https://github.com/mckaylaguzman/Shelfie
- **Package name:** `shelfie` (Expo slug: `shelfie`)
- **Display name:** Shelfie
- **Target:** Must run in **Expo Go** (no custom native modules beyond what's in the Expo SDK)
- **Routing:** `expo-router` file-based routing — currently a single screen at `app/index.tsx`
- **New Architecture:** enabled (`newArchEnabled: true` in `app.json`)
- **React Compiler:** enabled (`experiments.reactCompiler: true`)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Expo ~54, React 19, React Native 0.81 |
| Routing | expo-router ~6 |
| Storage | expo-sqlite (`shelfie.db`) + expo-file-system for cover images |
| Images | expo-image, expo-image-picker |
| Search APIs | Google Books (primary), Open Library (fallback) |
| Navigation | @react-navigation/native Stack (header hidden on home) |
| Language | TypeScript |

---

## Project Structure

```
app/
  _layout.tsx          # Root Stack, nav theme, header hidden on index
  index.tsx            # Home screen — all shelf UI lives here

components/
  BookForm.tsx         # Add / edit / mark-finished modal form
  BookDetailModal.tsx  # Book detail view with actions
  themed-text.tsx      # Themed text wrapper
  themed-view.tsx      # Themed view wrapper
  ui/                  # Expo template leftovers (icon-symbol, collapsible)
  ...                  # Other Expo template components (unused on home)

constants/
  theme.ts             # Colors, Fonts, navigationTheme (derived from palette)
  cozy-theme.ts        # Breakpoints, layout helpers, date formatting

utils/
  storage.ts           # SQLite CRUD, Book types, cover persistence
  theme.ts             # Palette, shadows, cardStyle, useThemeColors
  book-search.ts       # Unified search + cover download
  google-books.ts      # Google Books API client
  open-library.ts      # Open Library API client

hooks/
  use-color-scheme.ts  # System color scheme
  use-theme-color.ts   # Hook for themed components
```

**App-specific code** is concentrated in `app/index.tsx`, `components/BookForm.tsx`, `components/BookDetailModal.tsx`, and `utils/`. The Expo template left boilerplate components in `components/` that are not used by the home screen.

---

## Data Model

Defined in `utils/storage.ts`.

### Book type

```ts
type Book = {
  id: number;
  title: string;
  author: string;
  status: 'tbr' | 'reading' | 'finished';
  format: 'physical' | 'audiobook';
  rating: number;           // 0–5; only meaningful when status === 'finished'
  dateFinished: string;     // ISO string; empty when not finished
  review: string;           // empty when not finished
  coverImageUri: string | null;
};
```

### Status behavior

- **TBR** and **Reading:** no rating, date, or review stored (cleared on status change)
- **Finished:** requires rating ≥ 1 to save; date defaults to today; review optional
- Books sort order in `getAllBooks()`: reading first, then TBR, then finished (finished by date desc)

### Storage details

- SQLite DB: `shelfie.db` with WAL mode
- Cover images copied from temp/cache to `document/covers/` on save
- Old covers deleted when replaced or book deleted
- `migrateDb()` adds `status` and `format` columns for existing installs

### Public API

- `addBook(input)` / `updateBook(id, updates)` / `deleteBook(id)` / `getAllBooks()`
- `getStatusLabel(status)` → display string

---

## Book Search

Unified in `utils/book-search.ts`.

1. **Google Books** tried first (`utils/google-books.ts`)
2. On zero results **or** Google failure (429, network, etc.) → **Open Library** fallback (`utils/open-library.ts`)
3. Minimum query length: 2 characters
4. Selected search result auto-fills title/author and downloads cover via `downloadSearchCover()`
5. Errors surfaced as `BookSearchError` with `kind: 'offline' | 'unknown'`

**Do not** show an offline error immediately when Google fails — always fall through to Open Library first.

---

## Screens & User Flows

### Home (`app/index.tsx`)

Single scrollable home screen with no nav header. Sections appear only when they have books:

1. **Header** — "Welcome back", contextual subtitle, stat chips (books read count, avg rating)
2. **Currently Reading** — horizontal carousel (`FlatList`, `nestedScrollEnabled`)
3. **Up Next** — horizontal carousel for TBR books
4. **Finished** — filterable 2-column grid with overlapping-cover cards

**FAB (+)** opens add-book form modal.

**Empty state:** header + empty shelf card when no books exist.

#### Finished section filters

| Filter | Behavior |
|---|---|
| All | All finished books, sorted by date (recent first) |
| Rating | Sorted by rating desc, then date |
| Recent | Default — sorted by date desc |
| Format | Sub-chips: Physical / Audiobook |

#### Finished grid layout

- Uses `onLayout` to measure actual grid width (padding makes calculated width wrong without measurement)
- 2 columns on tablet **or** when ≥ 2 books on phone; 1 column otherwise
- Cover width = 38% of measured item width
- Cards always use `compact` mode in the grid
- Overlapping cover aesthetic: cover floats left, cream card extends right with `paddingLeft: coverWidth * 0.48`

### Book detail (`components/BookDetailModal.tsx`)

Modal with side-by-side layout: cover left (126px phone / 148px iPad), info right.

- Status badge (olive = reading, dusty blue = TBR, olive/mint = finished)
- Stars, date finished, review
- Long reviews (>200 chars or >5 lines): ScrollView with max height ~28% screen; short reviews: plain text
- Actions pinned bottom with `marginTop: 'auto'`
- **Mark as Finished** (for TBR/Reading) → opens completion form
- **Edit** → opens edit form
- **Delete** → confirm alert, deletes book + cover file

### Book form (`components/BookForm.tsx`)

Slide-up modal (`presentationStyle="pageSheet"`). Three modes:

| Mode | Trigger | Behavior |
|---|---|---|
| Add | FAB | Full form with status picker, search, cover picker |
| Edit | Detail → Edit | Pre-filled; status/format editable |
| Complete | Detail → Mark as Finished | Rating, date, review only; sets status to finished |

Fields: title, author, status (TBR/Reading/Finished), format (Physical/Audiobook), cover photo, star rating, date finished, review.

- Book search with debounced API lookup and result list
- Cover from search download, or manual pick via `expo-image-picker` (2:3 aspect)
- Validation: title required (add/edit); rating ≥ 1 required when finished

---

## Design System

### Aesthetic

Cozy, vintage, warm. Cream backgrounds, serif headings, rounded labels, soft shadows.

### Palette (`utils/theme.ts`)

Light mode (primary palette):

| Token | Hex | Usage |
|---|---|---|
| background | `#F2EFE6` | Screen background |
| card | `#FAF7F0` | Cards, inputs |
| text | `#4A3F35` | Primary text |
| textSecondary | `#7A6455` | Subtitles, authors |
| primary / star / terracotta | `#C17B5A` | FAB, stars, selected chips |
| border / dustyBlue / pink | `#B8C8D4` | Borders, TBR badge |
| olive / mint | `#8B8768` | Stats accent, reading badge |
| danger | `#B85C4A` | Delete actions |

Dark mode palette also defined — app respects system color scheme.

### Typography (`constants/theme.ts`)

- **Headings:** `Fonts.serif`
- **Labels / UI chrome:** `Fonts.rounded`
- **Body:** default sans

### Shared styling helpers (`utils/theme.ts`)

- `cardStyle(colorScheme)` — card bg + radius + shadow
- `cardShadow()` / `fabShadow()` — elevation helpers
- `radii.card = 20`, `radii.button = 16`, `radii.input = 14`
- `useThemeColors()` hook for components

Use `ThemedText` and `ThemedView` from components, or pull colors from `palette[colorScheme]` directly (home screen uses the latter).

---

## Layout & Responsive Conventions

Defined in `constants/cozy-theme.ts`.

| Constant | Value |
|---|---|
| TABLET_BREAKPOINT | 768 |
| LARGE_TABLET_BREAKPOINT | 1024 |
| MAX_CONTENT_WIDTH | 560 (phone) |
| TABLET_CONTENT_WIDTH | 720 |
| LARGE_TABLET_CONTENT_WIDTH | 860 |

### Critical: iPad detection

**Do NOT import `Platform` inside `cozy-theme.ts`** — it caused circular dependency / ReferenceError bugs.

Instead, pass `{ isPad: Platform.OS === 'ios' && Platform.isPad }` from screens:

```ts
const isPad = Platform.OS === 'ios' && Platform.isPad;
const layoutOptions = useMemo(() => ({ isPad }), [isPad]);
const isTablet = isTabletLayout(width, layoutOptions);
```

iPad mini portrait is 744pt — below the 768 breakpoint — so `Platform.isPad` is required for correct tablet layout on smaller iPads.

### Home layout values

- Horizontal padding: 20 phone / 32 tablet / 48 large tablet
- Carousel cover widths: 104 phone / 140 tablet / 160 large tablet
- Header centered on tablet

---

## Navigation

`app/_layout.tsx`:

- Single `Stack` with `index` screen
- `headerShown: false` on home
- Navigation theme colors from `constants/theme.ts` `navigationTheme`
- StatusBar follows color scheme

No tabs, no additional routes yet.

---

## Coding Conventions for This Project

1. **Minimal scope** — smallest correct diff; don't touch unrelated files
2. **Match existing patterns** — inline subcomponents in screen files, `StyleSheet.create` at bottom, palette-driven colors
3. **Expo Go compatible** — only use packages already in `package.json` or standard Expo SDK modules
4. **Verify Expo v54 docs** before adding APIs or plugins
5. **No comments** unless explaining non-obvious business logic
6. **File-system covers** — always persist via `storage.ts` helpers, never store temp URIs directly
7. **Finished field clearing** — when status changes away from finished, rating/date/review are zeroed in storage
8. **Nested scrolling** — home uses `ScrollView` + horizontal `FlatList`; keep `nestedScrollEnabled` on carousels
9. **Accessibility** — existing components use `accessibilityRole`, `accessibilityLabel`, `accessibilityState`

---

## Bugs Fixed (Do Not Regress)

These were real production issues during initial build — avoid reintroducing them:

1. **Google search offline error** — Google 429/failure must fall through to Open Library, not error immediately
2. **`TABLET_BREAKPOINT` ReferenceError** — caused by importing Platform in `cozy-theme.ts`; use `{ isPad }` param instead
3. **Finished grid side-by-side broken** — item width must come from `onLayout` measurement, not calculated from `contentWidth` minus padding
4. **Finished card collapse** — overlapping cover layout needs explicit pixel widths; undefined width breaks flex
5. **iPad mini not getting tablet layout** — must use `Platform.isPad`, not width alone
6. **Removed `count` variable** — `FinishedBooksGrid` needs `books.length` directly, not a removed `count` ref

---

## Not Yet Implemented

These are natural next features but **do not exist** yet:

- Multiple routes / tab navigation
- Reading progress / page tracking
- Statistics charts or reading goals
- Export / backup
- Onboarding
- Custom app icon/branding beyond Expo defaults (icon/splash still Expo template assets)
- `.swp` / editor temp files in `.gitignore`

When adding features, extend the existing patterns rather than introducing new state libraries or navigation paradigms unless explicitly requested.

---

## Running the App

```bash
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
npm run lint       # ESLint
```

Scan QR code with Expo Go on device for physical testing.

---

## Git

- Default branch: `main`
- Remote: `origin` → https://github.com/mckaylaguzman/Shelfie.git
- Only commit when explicitly asked
- Do not commit secrets (`.env*.local` is gitignored)

---

## Quick Reference: Key Files to Read First

When starting a new task, read these in order:

1. `AGENTS.md` (this file)
2. `utils/storage.ts` — data model and persistence
3. `app/index.tsx` — home screen layout and state
4. `components/BookForm.tsx` — add/edit/complete flows
5. `components/BookDetailModal.tsx` — detail view
6. `utils/theme.ts` + `constants/cozy-theme.ts` — styling and layout
7. `utils/book-search.ts` — search behavior
