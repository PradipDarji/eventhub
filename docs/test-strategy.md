# EventHub — Booking Management Test Strategy

Generated: 2026-06-06
Input: `docs/test-scenarios.md` (57 scenarios, TC-001 to TC-511)
Sources scanned: `bookingService.js`, `bookingRepository.js`, `bookingController.js`, `bookingValidator.js`, `BookingCard.jsx`, `ConfirmDialog.jsx`, `bookings/page.tsx`, `bookings/[id]/page.tsx`, `tests/booking-management.spec.js`

---

## 1. Layer Distribution Summary

| Layer | TC Count | Focus | Approx. Run Time |
|---|---|---|---|
| **Unit** | 3 | Pure helper functions — `randomRef`, `generateUniqueRef` (no DB, no browser) | < 1 s |
| **API / Integration** | 26 | Backend contracts, auth enforcement, FIFO business rules, DB-state assertions | 15–45 s |
| **Component** | 16 | Client-side UI states, conditional rendering, refund logic (mocked API responses) | 5–20 s |
| **E2E** | 11 | Critical user journeys, multi-page flows, cross-session security | 3–6 min |
| **Total distinct** | **56** | (TC-506 collapsed into TC-003; TC-400/TC-401 merged with TC-100/TC-101) | |

**Pyramid shape**: Unit (3) → API (26) → Component (16) → E2E (11) ✓

> **Defense-in-depth**: TC-102 (booking ref rule) is covered at Unit + E2E. TC-106 (price calculation) is covered at API + E2E (implicit). TC-200/TC-201 (cross-user access) are covered at API + E2E.

---

## 2. Layer Assignments

### Unit Tests
_Criteria: Pure function, no I/O, no DB, no browser._
_File: `tests/unit/bookingService.test.js`_
_Source: `backend/src/services/bookingService.js:11-32`_

| TC | Title | Function Under Test | Source |
|---|---|---|---|
| TC-102 | Booking ref prefix = event title first char (uppercase) | `randomRef(eventTitle)` | `bookingService.js:11` |
| TC-405 | Collision retry — up to 10 attempts, then timestamp fallback | `generateUniqueRef(eventTitle)` with mocked `findByRef` | `bookingService.js:21` |
| TC-408 | Event title starting with digit — prefix is the digit char | `randomRef('100 Days Festival')` | `bookingService.js:12` |

**Rationale**: `randomRef()` is a pure function — prefix derivation and string building have no side effects. `generateUniqueRef()` calls `bookingRepository.findByRef` once per attempt; mock it to return a match on the first 10 calls to exercise the timestamp fallback path at `bookingService.js:29-31`. Testing either of these at API or E2E adds database setup, network, and a login flow — all cost with zero added confidence in the pure logic.

---

### API / Integration Tests
_Criteria: Backend rule, API contract, or DB-state verification. All require a live JWT._
_File: `tests/api/bookings.api.spec.js`_

#### Happy Path — Contracts
| TC | Title | Endpoint | Key Assertion |
|---|---|---|---|
| TC-007 | GET /api/bookings/ref/:ref returns full booking | `GET /api/bookings/ref/:ref` | 200, nested `event` included; `bookingRef` matches; ownership enforced |
| TC-107 | GET /api/bookings returns pagination envelope | `GET /api/bookings?page=1&limit=10` | `pagination.{page,limit,total,totalPages}` all present |
| TC-407 | Page 2 with limit=5 returns correct slice | `GET /api/bookings?page=2&limit=5` | `pagination.page=2`, `data.length <= 5` |
| TC-406 | Clear all with 1 booking returns `deleted:1` | `DELETE /api/bookings` | Response `{ deleted: 1 }`; subsequent GET returns empty array |

#### Business Rules — DB-Dependent
| TC | Title | Service Function | Code Location |
|---|---|---|---|
| TC-100 / TC-400 | FIFO preferred path — 10th prunes oldest from different event | `bookingService.createBooking` | `bookingService.js:73` `findOldestUserBookingExcludingEvent` |
| TC-101 / TC-401 | FIFO same-event fallback — permanently burns a seat | `bookingService.createBooking` | `bookingService.js:95` `eventRepository.decrementSeats` |
| TC-106 | totalPrice = price × quantity | `bookingService.createBooking` | `bookingService.js:99` `parseFloat(event.price) * data.quantity` |
| TC-108 | Cancel booking releases computed seat count (dynamic event) | `bookingService.cancelBooking` | `bookingService.js:133` `bookingRepository.delete(id)` |

> TC-100 and TC-400 are the same business rule framed as Business Rule vs Edge Case respectively — one test file entry covers both. Same for TC-101/TC-401.

#### Security — Auth Enforcement
| TC | Title | Endpoint | Enforcement Point |
|---|---|---|---|
| TC-201 | Cross-user GET booking returns 403 | `GET /api/bookings/:id` | `bookingService.js:57` `booking.userId !== userId` |
| TC-202 | Cross-user DELETE booking returns 403 | `DELETE /api/bookings/:id` | `bookingService.js:129` `booking.userId !== userId` |
| TC-206 | Cross-user ref lookup returns 403 | `GET /api/bookings/ref/:ref` | `bookingService.js:64` `booking.userId !== userId` |
| TC-203 | Unauthenticated GET /api/bookings returns 401 | `GET /api/bookings` | Auth middleware — no token |
| TC-204 | Unauthenticated GET /api/bookings/:id returns 401 | `GET /api/bookings/:id` | Auth middleware |
| TC-205 | Unauthenticated DELETE /api/bookings returns 401 | `DELETE /api/bookings` | Auth middleware |

#### Negative — Validation & Not-Found
| TC | Title | Validator / Service | Validation Rule |
|---|---|---|---|
| TC-301 | GET non-existent ID returns 404 | `bookingService.getBookingById` | `bookingService.js:56` `NotFoundError` |
| TC-302 | Insufficient seats returns 400 | `bookingService.createBooking` | `bookingService.js:88` `InsufficientSeatsError` |
| TC-303 | Non-existent event returns 404 | `bookingService.createBooking` | `bookingService.js:83` `NotFoundError` |
| TC-307 | Double-cancel returns 404 | `bookingService.cancelBooking` | `bookingService.js:128` `findById` returns null |
| TC-304 | Missing required fields returns 400 | `validateCreateBooking` | `bookingValidator.js:21,27,33,38` `notEmpty()` |
| TC-305 | Quantity 0 or negative returns 400 | `validateCreateBooking` | `bookingValidator.js:39` `isInt({min:1,max:10})` |
| TC-306 | Quantity > 10 returns 400 | `validateCreateBooking` | `bookingValidator.js:39` `isInt({min:1,max:10})` |
| TC-309 | customerName 1 char returns 400 | `validateCreateBooking` | `bookingValidator.js:24` `isLength({min:2})` |
| TC-310 | Invalid phone format (letters) returns 400 | `validateCreateBooking` | `bookingValidator.js:36` `.matches(/^[0-9+\-\s()]+$/)` |
| TC-311 | Invalid email format returns 400 | `validateCreateBooking` | `bookingValidator.js:29` `.isEmail()` |
| TC-409 | eventId = 0 or negative returns 400 | `validateCreateBooking` | `bookingValidator.js:17` `isInt({min:1})` |
| TC-410 | customerPhone exactly 10 digits accepted | `validateCreateBooking` | `bookingValidator.js:35` `isLength({min:10})` boundary min |

---

### Component Tests
_Criteria: Single component or page renders correctly for a given React state or mocked API response. No real backend._
_File: `tests/components/booking-ui.spec.js`_
_Pattern: `page.route('**/api/bookings**', route => route.fulfill({...}))` before navigation_

#### `RefundEligibility` component — `bookings/[id]/page.tsx:21`
| TC | Title | Trigger | Assertion |
|---|---|---|---|
| TC-103 | qty=1 → eligible result | render detail page with qty=1 booking; click `#check-refund-btn` | `#refund-result` contains "Eligible for refund." after 4s |
| TC-104 | qty=3 → ineligible with correct count | render with qty=3; click check | `#refund-result` contains "Group bookings (3 tickets) are non-refundable" |
| TC-404 | qty=2 boundary → ineligible (first failing value) | render with qty=2; click check | `#refund-result` shows ineligible message |
| TC-105 | Spinner appears immediately; disappears after 4s | click check; assert immediately | `#refund-spinner` visible; `not.toBeVisible({ timeout:6000 })` |
| TC-508 | State machine: button gone → spinner → result | click check | `#check-refund-btn` not visible during/after check; `#refund-result` appears |

#### `BookingsContent` component — `bookings/page.tsx:14`
| TC | Title | Mocked API State | Assertion |
|---|---|---|---|
| TC-500 | 5 skeleton cards while loading | intercept GET → delay; or `isLoading=true` | 5 `BookingCardSkeleton` elements visible |
| TC-501 | Empty state when no bookings | intercept GET → `{ data: [], pagination: {...} }` | "No bookings yet" heading + "Browse Events" link |
| TC-308 | Error state when server unreachable | intercept GET → status 500 | "Couldn't load bookings" + "Retry" button |
| TC-109 | "Clear all bookings" link visible with bookings | intercept GET → return 1+ bookings | "Clear all bookings" link in DOM; sub-text visible |
| TC-507 | Button shows "Clearing…" during in-flight DELETE | intercept DELETE → delay | Button text = "Clearing…"; `disabled` attribute set |
| TC-510 | Pagination renders when totalPages > 1 | intercept GET → `pagination.totalPages=3` | `Pagination` component visible; next-page click updates URL |

#### `BookingDetailPage` and `ConfirmDialog` — `bookings/[id]/page.tsx:91`
| TC | Title | Mocked State | Assertion |
|---|---|---|---|
| TC-502 | Full-screen spinner while loading | intercept GET → delay | `Spinner size="lg"` visible in `min-h-[60vh]` container |
| TC-300 | "Booking not found" on 404 | intercept GET → status 404 | `EmptyState` title = "Booking not found" |
| TC-503 | Cancel dialog appears on button click | real booking via mock | `ConfirmDialog` visible; title "Cancel this booking?"; `#confirm-dialog-yes` present |
| TC-504 | Dismiss dialog — booking NOT cancelled | open dialog, click Cancel button | Dialog closes; no DELETE call fired; booking still visible |
| TC-511 | Dialog description interpolates ref and seat count | mock booking ref="T-A3FZ19", qty=2 | Description contains "T-A3FZ19" and "2 seat(s)" |

---

### E2E Tests
_Criteria: Multi-page user journey, real full-stack data flow, or cross-session security requiring two browser identities._
_File: `tests/booking-management.spec.js` (existing; extend for missing TCs)_
_Config: `playwright.config.ts` `baseURL=https://eventhub.rahulshettyacademy.com`_

#### Critical Happy Paths — must be green before any release
| TC | Title | Journey Scope | Status |
|---|---|---|---|
| TC-001 | View bookings list with existing bookings | login → `/bookings` → assert cards rendered | ✅ Implemented |
| TC-002 | View single booking detail — all sections | login → `/bookings` → "View Details" → `/bookings/:id` → assert all sections | ✅ Implemented |
| TC-003 | Cancel booking from detail page | login → detail → "Cancel Booking" → confirm → toast + redirect | ✅ Implemented |
| TC-004 | Clear all bookings | login → `/bookings` → "Clear all" → confirm dialog → empty state | ✅ Implemented |
| TC-006 | "View My Bookings" link after booking | login → book event → click link → assert booking in list | ✅ Implemented |

#### Business Rule Validation
| TC | Title | What E2E Adds Over API/Unit | Status |
|---|---|---|---|
| TC-102 | Booking ref prefix matches event title first char | Validates the UI confirmation card renders the correct ref (not just API response) | ✅ Implemented |

#### Security — Requires Two Browser Sessions
| TC | Title | Why Must Be E2E | Status |
|---|---|---|---|
| TC-200 | Cross-user access shows "Access Denied" UI | Login as User A → create booking → logout → login as User B → navigate → assert `EmptyState` title | ❌ Not yet |
| TC-509 | Access Denied vs Booking Not Found — correct branch | Validates `error.status===403` branch at `[id]/page.tsx:119` renders "Access Denied" not "not found" | ❌ Not yet |

#### Edge Case UI Behaviors
| TC | Title | Why Must Be E2E | Status |
|---|---|---|---|
| TC-402 | Quantity = 1 (min) — decrement button disabled | Real DOM interaction; button `disabled` state requires browser rendering | ❌ Not yet |
| TC-403 | Quantity = 10 (max) — increment button disabled | Same; increment button `disabled` after 9 clicks | ❌ Not yet |
| TC-005 | Back button navigates to /bookings | Validates `Link href="/bookings"` renders correctly as a navigable link | ❌ Not yet |

> **TC-506** (cancel success toast + redirect) is fully covered by TC-003. No separate E2E test needed.
> **TC-505** (breadcrumb shows booking ref) is fully covered during TC-002's step-by-step assertions.
> **TC-501** (empty state) is covered as a side-effect of TC-004. No dedicated E2E needed — dedicate to Component layer.

---

## 3. Decision Rationale — Contested Assignments

### TC-103 / TC-104 / TC-105 — Refund Eligibility → Component (NOT E2E)

**Decision**: Component only.

`RefundEligibility` at `[id]/page.tsx:21-71` is 100% client-side:
```javascript
const check = () => {
  setStatus('checking');
  setTimeout(() => {
    setStatus(quantity === 1 ? 'eligible' : 'ineligible');
  }, 4000);
};
```
No backend API call. No database. Testing this at E2E means: login (10s), navigate to events, book an event (10s), go to bookings, click details, wait for the spinner (4s), assert result. That's 25+ seconds of test time to verify a `quantity === 1` ternary. A component test using route interception to mock a booking with `quantity:1` runs in under 6 seconds. E2E for this is the definition of the ice cream cone anti-pattern.

---

### TC-100 / TC-101 / TC-400 / TC-401 — FIFO Pruning → API (NOT E2E)

**Decision**: API only (TC-100 ≡ TC-400; TC-101 ≡ TC-401 — collapse to single test each).

FIFO pruning executes entirely in `bookingService.createBooking` (`bookingService.js:70-97`):
1. `bookingRepository.countUserBookings(userId)` — count check
2. `bookingRepository.findOldestUserBookingExcludingEvent(userId, eventId)` — preferred pruning
3. `bookingRepository.findOldestUserBooking(userId)` — fallback
4. `bookingRepository.delete(oldest.id)` — pruning
5. `eventRepository.decrementSeats(data.eventId, data.quantity)` — seat burn on same-event fallback

An E2E test for this requires pre-seeding exactly 9 bookings via UI (9 full booking flows × ~20s = 3 minutes of setup per test run). API tests can POST 9 bookings directly in under 5 seconds total. The behavior is fully observable via `GET /api/bookings` count before and after.

---

### TC-304 / TC-305 / TC-306 / TC-309 / TC-310 / TC-311 — Validation → API (NOT E2E)

**Decision**: API only.

All input validation runs in `bookingValidator.js` (express-validator middleware) **before** `bookingService.createBooking` is even called. The validator produces a structured 400 response with `details` array. Testing these at E2E means: filling a form, submitting, reading a toast — slow, brittle, and proves nothing about the service layer. A direct `POST /api/bookings` with the bad payload is precise, fast, and tests exactly the right layer.

---

### TC-200 / TC-509 — Cross-User Security → E2E (NOT just API)

**Decision**: Both API (TC-201) and E2E (TC-200, TC-509) required.

TC-201 proves the API returns 403. But TC-200 and TC-509 test the **frontend error-handling branch**:
```typescript
// [id]/page.tsx:119
const is403 = (error as any)?.status === 403;
return (
  <EmptyState
    title={is403 ? 'Access Denied' : 'Booking not found'}
    description={is403 ? 'You are not authorized...' : "This booking doesn't exist..."}
  />
);
```
This branch is only exercisable by:
1. Holding two real JWT tokens simultaneously (or switching sessions)
2. Navigating to a real `/bookings/:id` URL that belongs to User A while logged in as User B

A component test with a mocked 403 response would work **but** loses the real cross-session JWT enforcement. Since this is a security scenario, the E2E test provides meaningful defense that a mock cannot replicate.

---

### TC-300 / TC-308 / TC-501 / TC-502 — Loading/Error/Empty States → Component (NOT E2E)

**Decision**: Component with mocked API responses.

These three states (`isLoading`, `isError`, `data.data=[]`) are React Query flags. They're testable in 2 lines:
```javascript
// TC-308 example
await page.route('**/api/bookings**', route => route.fulfill({
  status: 500, body: JSON.stringify({ error: 'Server error' })
}));
await page.goto('/bookings');
await expect(page.getByText("Couldn't load bookings")).toBeVisible();
```
An E2E test for TC-308 would require taking the backend offline — not portable across environments, not deterministic. Component tests own this layer.

TC-501 (empty state) is partially covered by TC-004 E2E as a side-effect. The Component test provides an isolated, instant verification of the empty-state rendering logic without requiring a real booking to clear.

---

### TC-503 / TC-504 / TC-511 — ConfirmDialog → Component (NOT E2E)

**Decision**: Component (isolated from full booking journey).

`ConfirmDialog` at `ConfirmDialog.jsx:1` and `BookingCard.jsx:90` is a reusable component with well-defined `isOpen`, `onClose`, `onConfirm`, `isLoading` props. Its behavior (show/hide, disable buttons during loading, interpolate description) is testable by rendering a mocked booking detail page with the dialog forced open. This avoids the full login → book → navigate journey just to test a dialog's dismiss button. The cancel success flow (TC-003 E2E) already proves the dialog works end-to-end.

---

## 4. Anti-Patterns Found in Existing Tests

Reviewing `tests/booking-management.spec.js` (current implementation):

| # | Anti-Pattern | Location | Fix |
|---|---|---|---|
| 1 | `BASE_URL` hardcoded constant at top of file | `booking-management.spec.js:3` | Use relative `page.goto('/bookings')` — `playwright.config.ts` already sets `baseURL` to the live site |
| 2 | `bookEvent()` helper always books the FIRST available card | `booking-management.spec.js:27` | Could become flaky if first card is sold out due to another test; consider picking a static event by title |
| 3 | `clearBookings()` uses `.catch(() => false)` to suppress errors | `booking-management.spec.js:58` | Acceptable here but masks unexpected failures; consider asserting the clear succeeded |
| 4 | No isolation between tests — TC-001 through TC-004 all call `clearBookings` + `bookEvent` on the same account | All tests | Fine for now at 6 tests; when API tests are added, use a dedicated E2E account (`pradipdarji@gmail.com`) so API and E2E don't race |
| 5 | `page.once('dialog', d => d.accept())` registered before the button click for clear-all | `booking-management.spec.js:213` | Correct pattern — `once` is right to avoid leaking the handler |

---

## 5. Defense-in-Depth Coverage Map

| Business Rule | Unit | API | Component | E2E |
|---|---|---|---|---|
| Booking ref prefix = event title first char | TC-102 | — | — | TC-102 |
| Ref collision retry → timestamp fallback | TC-405 | — | — | — |
| totalPrice = price × quantity | — | TC-106 | — | TC-002 (implicit) |
| Refund: qty=1 eligible, qty>1 not | — | — | TC-103, TC-104, TC-404 | — |
| FIFO pruning at 9 bookings | — | TC-100, TC-101 | — | — |
| Cross-user access denied | — | TC-201, TC-202, TC-206 | — | TC-200, TC-509 |
| Cancel → toast + redirect | — | — | TC-503, TC-504 | TC-003 |
| Auth required (401) on all endpoints | — | TC-203, TC-204, TC-205 | — | — |
| Empty state after clear-all | — | — | TC-501 | TC-004 |

---

## 6. Implementation Priority Order

**Tier 1 — P0, must pass before any release**
- `TC-001, TC-002, TC-003, TC-004, TC-006` — E2E happy paths ✅ done
- `TC-102` — booking ref rule (Unit + E2E) ✅ done (E2E); ❌ Unit still needed
- `TC-201, TC-202` — cross-user security (API) ❌
- `TC-200` — cross-user access (E2E) ❌
- `TC-302` — insufficient seats (API) ❌

**Tier 2 — P1, run on every CI PR**
- `TC-100, TC-101` — FIFO pruning (API) ❌
- `TC-103, TC-104, TC-105` — refund eligibility (Component) ❌
- `TC-203, TC-204, TC-205` — auth enforcement (API) ❌
- `TC-304, TC-305, TC-306` — validation (API) ❌
- `TC-500, TC-501, TC-308` — UI states (Component) ❌
- `TC-503, TC-506→covered` — cancel dialog (Component) ❌

**Tier 3 — P2, run nightly or pre-release**
- `TC-405, TC-408` — ref edge cases (Unit) ❌
- `TC-107, TC-407` — pagination (API) ❌
- `TC-402, TC-403, TC-005` — UI boundaries (E2E) ❌
- `TC-507, TC-508, TC-510, TC-511` — UI micro-states (Component) ❌

---

## 7. Source File Map for Test Generation

| Layer | File | Key Source Files |
|---|---|---|
| Unit | `tests/unit/bookingService.test.js` | `backend/src/services/bookingService.js:11-32` |
| API | `tests/api/bookings.api.spec.js` | `backend/src/routes/`, `backend/src/validators/bookingValidator.js`, `backend/src/services/bookingService.js` |
| Component | `tests/components/booking-ui.spec.js` | `frontend/app/bookings/page.tsx`, `frontend/app/bookings/[id]/page.tsx`, `frontend/components/bookings/BookingCard.jsx`, `frontend/components/ui/ConfirmDialog.jsx` |
| E2E | `tests/booking-management.spec.js` | Full stack; accounts: `pradipdarji@gmail.com` / `Pradip@123` (primary) and `rahulshetty1@yahoo.com` / `Magiclife1!` (secondary for cross-user) |
