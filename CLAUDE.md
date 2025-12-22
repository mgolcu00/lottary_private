# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **digital lottery application** built with React + TypeScript + Vite + Firebase. The app is designed for internal company Christmas events, featuring a live lottery drawing system inspired by Turkish Milli Piyango (National Lottery) with a 5-ball drawing mechanism and Christmas theming.

## Development Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint

# Build must pass TypeScript compilation + Vite build
# Warning: Bundle size > 500KB is expected due to Firebase SDK
```

## Architecture Overview

### Authentication Flow
1. **Login** (`/login`) → Email OTP or Google OAuth
2. **Name Setup** (`/setup-name`) → First-time users set display name
3. **Disclaimer** (`/disclaimer`) → 18+ age confirmation + terms acceptance
4. **User Home** (`/`) → Main lottery interface

Users MUST complete all steps (auth → name → terms) before accessing main app.

**Admin users MUST also complete these steps** before accessing `/admin` panel. AdminRoute enforces the same flow as PrivateRoute, plus admin check.

### Core Data Models (src/types/index.ts)

**User**: Firebase Auth user + custom fields (isAdmin, termsAccepted, isOver18)
**LotterySettings**: Lottery configuration (eventDate, ticketPrice, maxTickets, status)
**Ticket**: Individual lottery ticket with 5 random numbers (1-9 range)
**TicketRequest**: Purchase request workflow (pending → approved/rejected)
**LotterySession**: Live drawing session state (amorti draws + grand prize)

### Firebase Collections

- `users` - User profiles with admin flags
- `lotteries` - Lottery configurations
- `tickets` - All tickets (available/requested/confirmed/expired)
- `ticketRequests` - Purchase approval workflow
- `lotterySessions` - Live drawing state

### Critical Security Patterns

**Transaction-based ticket purchase** (`src/utils/secureOperations.ts`):
```typescript
// ALWAYS use secureTicketPurchase() for ticket operations
// Prevents race conditions when multiple users request same ticket
await secureTicketPurchase(db, ticketRef, userId, userName);
```

**Rate limiting** (`src/utils/validation.ts`):
```typescript
// Enforced on ticket requests: 5 requests per minute per user
ticketRequestLimiter.isAllowed(userId)
```

**Field naming convention**:
- Tickets use `userId` and `userName` (NOT `requestedBy`/`requestedByName`)
- Always update both fields together when changing ticket ownership

### Smart Lottery Algorithm

The `getSmartNumber()` function in `LotterySession.tsx` implements a **guaranteed winner algorithm**:

1. Each number drawn MUST match at least one ticket's prefix
2. Position 1: Draw from numbers that exist in position 1 of confirmed tickets
3. Position 2: Draw from numbers that match positions 1+2 in at least one ticket
4. Positions 3-5: Continue prefix matching pattern
5. By position 5, exactly one ticket will match all 5 numbers (guaranteed winner)

This ensures every lottery MUST have a winner - no random chance of "no winner".

### Lottery Drawing Workflow

**Stages** (controlled manually by admin):
1. `amorti1` → Draw first consolation prize (1-5 range)
2. `amorti2` → Draw second consolation prize (5-9 range)
3. **Manual transition** → Admin clicks "Büyük Ödüle Geç" button
4. `grand` → Draw 5 numbers for grand prize (1-9 range each)
5. `completed` → Show results screen

**Important**: After amorti2, admin MUST manually transition to grand prize. The system does NOT auto-advance.

### Real-time Features

All lottery data uses Firebase `onSnapshot` listeners for real-time updates:
- Ticket availability updates live
- Drawing numbers appear in real-time for all viewers
- Viewer count updates every 30 seconds
- Session state syncs across all clients

### Component Organization

```
components/
├── auth/          # Login, name setup, disclaimer flow
├── admin/         # Admin panel (lottery creation, approval management)
├── user/          # User home, ticket purchase, lottery selector
├── lottery/       # Live drawing session with animations
└── common/        # Reusable (Ticket, Navigation, ChristmasEffects)
```

### Date Handling

**CRITICAL**: Firebase Timestamps → JavaScript Dates
```typescript
import { toDateSafe } from './utils/date';

// Always convert Firestore timestamps before using:
eventDate: toDateSafe(lotteryData.eventDate)
```

Firestore returns Timestamps, but app expects Date objects. Use `toDateSafe()` wrapper.

### Static Asset Paths

**Images in public/** folder:
```typescript
// ✅ Correct - will work in production
<img src="/ticket_2_5.png" />
<img src="/raw_icon.svg" />

// ❌ Wrong - breaks in production build
<img src="/src/assets/ticket.png" />
```

Assets in `public/` are copied to `dist/` root during build.

## Deployment (Static Site)

### SPA Routing Setup

**Render.com**: Manual configuration required
1. Settings → Redirects/Rewrites → Add Rule
2. Source: `/*` → Destination: `/index.html` → Action: **Rewrite**

**Vercel**: Automatic (uses `vercel.json`)
**Netlify**: Automatic (uses `public/_redirects`)

### Build Output

```
dist/
├── index.html
├── _redirects          # SPA routing for Netlify/Render
├── ticket_2_5.png      # Ticket background image
├── raw_icon.svg        # App logo
└── assets/             # Bundled JS/CSS (hashed filenames)
```

### Environment Variables

Required for Firebase connection (prefix with `VITE_`):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## Common Patterns

### Admin-only operations
```typescript
if (!user?.isAdmin) return; // Guard all admin functions
```

### Firestore queries
```typescript
// Always filter by lotteryId when querying tickets
const ticketsQuery = query(
  collection(db, 'tickets'),
  where('lotteryId', '==', lottery.id),
  where('status', '==', 'confirmed')
);
```

### TypeScript strict mode
- Use `ReturnType<typeof setTimeout>` instead of `NodeJS.Timeout`
- Avoid parameter properties syntax (breaks in erasableSyntaxOnly mode)
- All unused imports/variables must be prefixed with `_` or removed

## Firebase Security Rules (Must be configured)

Users collection: Users can only modify their own document
Lotteries/Tickets: Admin-only writes
TicketRequests: Users can create, admins can update

See README.md "Firestore Rules" section for complete rule set.

## Known Limitations

- Bundle size warning (653KB) is expected - Firebase SDK is large
- Christmas theme is hardcoded (snowflakes, decorations, colors)
- Only supports single lottery at a time (LotterySelector shows all but UX expects one)
- Turkish language UI only
