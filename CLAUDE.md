# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform built for QA training. Users can browse events, book tickets, manage bookings, and create events. Each user operates in an isolated sandbox.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, React Query v5
- **Backend**: Express.js, Prisma ORM, MySQL 8+
- **Auth**: JWT (7-day expiry), bcryptjs
- **Testing**: Playwright E2E (Chromium only)

## Commands

```bash
# First-time setup
npm run setup        # installs backend + frontend dependencies

# Development
npm run dev          # starts frontend (port 3000) + backend (port 3001) concurrently
npm run seed         # seeds static events and upserts test users

# Database
npm run migrate      # runs prisma migrate dev (creates migration files)
npm run db:push      # syncs schema without creating migration files

# Testing
npm run test                                                # run all Playwright tests
npm run test:ui                                             # Playwright UI mode
npx playwright test tests/<file>.spec.js --reporter=line   # run a single test file
npm run test:report                                         # open last HTML report
```

## Architecture

### Backend layered pattern
Routes → Controllers → Services → Repositories → Database (Prisma)

- `routes/` — Express router, declares HTTP endpoints, applies validators + `authMiddleware`
- `controllers/` — thin; calls service, returns JSON
- `services/` — all business logic and domain rules
- `repositories/` — all Prisma queries, no business logic
- `utils/errors.js` — domain error classes (`NotFoundError` 404, `ForbiddenError` 403, `InsufficientSeatsError` 400, `ValidationError` 400); `errorHandler.js` middleware maps these to HTTP responses

All API routes require a JWT bearer token except `POST /auth/register` and `POST /auth/login`. `authMiddleware` injects `req.user = { userId, email }` from the verified token.

API response envelope: `{ success: boolean, data?, message?, pagination?, error?, details? }`

Swagger UI is available at `http://localhost:3001/api-docs` when the backend is running.

### Per-user virtual `availableSeats`
`Event.availableSeats` in the DB is the global count. `eventService.js → withPersonalSeats()` replaces it with a per-user computed value by subtracting each user's own confirmed bookings for that event. Two users see different seat counts for the same event.

### Static vs dynamic events
Events with `isStatic: true` are seeded, shared across all users, and cannot be modified or deleted. They have `userId: null`. Dynamic events are user-created and private to their owner.

### Frontend API layer
`frontend/lib/api/client.ts` — fetch wrapper; reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001/api`). Auth token is read from `localStorage` key `token` and sent as `Authorization: Bearer <token>`.

`frontend/lib/hooks/` — React Query hooks (`useEvents`, `useBookings`) that wrap the API client. Pages consume these hooks, not the API client directly.

### Playwright test setup
`playwright.config.ts` sets `baseURL`, but the current test files define their own `BASE_URL` constant and use absolute URLs — so the config's `baseURL` is effectively unused. The fix is to use relative `page.goto('/path')` calls so the config controls the target host.

## Key Business Rules
- Max 6 user-created events per user — FIFO pruning on overflow (oldest deleted automatically)
- Max 9 bookings per user — FIFO pruning on overflow, preferring a different event than the one being booked
- Booking ref format: `{EventTitleFirstChar}-{6 random A-Z0-9}`, e.g. `T-A3FZ19`
- Seat count reduces on booking, restores on cancellation
- Refund eligibility: quantity = 1 → eligible; quantity > 1 → not eligible (enforced client-side only)
- Cross-user booking access returns 403
- `DELETE /api/bookings` (no ID) clears all bookings for the authenticated user

## Testing Conventions
- Test files go in `tests/` as `<feature-name>.spec.js`
- Locator priority: `data-testid` > role > label/placeholder > ID > CSS class
- No `page.waitForTimeout()` — use `expect().toBeVisible()`
- Tests must be self-contained (login → action → assert)
- Primary test account: `rahulshetty1@gmail.com` / `Magiclife1!`
- See `.claude/docs/playwright-best-practices.md` for detailed standards

## Custom Slash Commands
- `/generate-tests <feature>` — generates Playwright tests
- `/review-tests <file>` — reviews test code quality
- `/create-scenarios <area>` — creates test scenario documents
- `/test-strategy <scenarios>` — assigns tests to optimal pyramid layers

## Skill Documents
- `.claude/docs/playwright-best-practices.md` — Playwright testing standards
- `.claude/docs/eventhub-domain.md` — full domain knowledge and business rules
