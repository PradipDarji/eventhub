# EventHub — Booking Management Test Scenarios

Generated: 2026-06-06
Scope: Booking Management (Flow 4 — View, Cancel, Clear, Refund Eligibility)
Sources: `bookingService.js`, `bookingValidator.js`, `bookings/page.tsx`, `bookings/[id]/page.tsx`

---

## Happy Path

### TC-001: View bookings list with existing bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Observe the list of booking cards rendered
**Expected Results**: Each booking card displays booking reference, event name, quantity, total price, and "View Details" link; page heading "My Bookings" is visible
**Business Rule**: Flow 4 — Manage Bookings
**Suggested Layer**: E2E

---

### TC-002: View single booking detail page — all sections present
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details" on any booking card
3. Observe the booking detail page at `/bookings/:id`
**Expected Results**: Page shows all five sections — Event Details (title, category, date, venue, city), Customer Details (name, email, phone), Payment Summary (tickets, price per ticket, total paid), Refund section, Booking Information (booked on date, booking ID); breadcrumb shows booking ref; "Cancel Booking" button visible
**Business Rule**: Booking model fields; Flow 4
**Suggested Layer**: E2E

---

### TC-003: Cancel a single booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one confirmed booking
**Steps**:
1. Navigate to `/bookings/:id`
2. Click "Cancel Booking" button
3. Observe the ConfirmDialog appears
4. Click "Yes, cancel it"
5. Observe the redirect and bookings list
**Expected Results**: Success toast "Booking cancelled successfully" appears; user is redirected to `/bookings`; cancelled booking no longer appears in the list (or "No bookings yet" if it was the only one)
**Business Rule**: Rule 1 — booking cancellation deletes the record; `bookingService.cancelBooking` at `bookingService.js:126`
**Suggested Layer**: E2E

---

### TC-004: Clear all bookings from the bookings list page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" link
3. Accept the browser `confirm()` dialog — "Clear all your bookings? This cannot be undone."
4. Observe the page after clearing
**Expected Results**: All bookings removed; page shows empty state "No bookings yet" with "Browse Events" button; `DELETE /api/bookings` returns `{ deleted: N }`
**Business Rule**: Rule 4 — `clearAllBookings` service; `bookingsApi.clearAll()` in `bookings/page.tsx:31`
**Suggested Layer**: E2E

---

### TC-005: Navigate back to bookings list via "← Back to My Bookings" button
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User is on a booking detail page `/bookings/:id`
**Steps**:
1. Scroll to bottom of the detail page
2. Click "← Back to My Bookings" button
**Expected Results**: User is navigated to `/bookings`
**Business Rule**: UI navigation — secondary Button links to `/bookings` at `[id]/page.tsx:209`
**Suggested Layer**: E2E

---

### TC-006: Navigate to bookings via "View My Bookings" link after completing a booking
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User just completed a booking (confirmation card shown at `/events/:id`)
**Steps**:
1. Complete a booking from the event detail page
2. On the confirmation card, click "View My Bookings" link
3. Observe the bookings page
**Expected Results**: User lands on `/bookings`; the newly created booking appears in the list with correct booking ref and event title
**Business Rule**: Flow 3 → Flow 4 navigation
**Suggested Layer**: E2E

---

### TC-007: Lookup booking by reference via API
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is authenticated; user has a booking with known `bookingRef`
**Steps**:
1. Send `GET /api/bookings/ref/:ref` with valid JWT and own booking ref
**Expected Results**: HTTP 200; response `data` includes full booking object with nested `event`; `bookingRef` matches the requested ref
**Business Rule**: `bookingService.getBookingByRef` at `bookingService.js:61`
**Suggested Layer**: API

---

## Business Rules

### TC-100: FIFO pruning — 10th booking replaces oldest booking from a different event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has exactly 9 bookings across multiple events; user has valid JWT
**Steps**:
1. Note the ID of the oldest booking (for a different event than the new one)
2. Send `POST /api/bookings` to create a 10th booking for Event X
3. Send `GET /api/bookings` to retrieve all user bookings
**Expected Results**: Total booking count is still 9; the oldest booking (different event) is deleted; the new booking is present
**Business Rule**: Rule 4 — `MAX_USER_BOOKINGS = 9`; `findOldestUserBookingExcludingEvent` preferential pruning at `bookingService.js:73`
**Suggested Layer**: API

---

### TC-101: FIFO pruning — same-event fallback permanently burns a seat
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has exactly 9 bookings all for the SAME event; enough seats remain
**Steps**:
1. Record current `availableSeats` for the event
2. Send `POST /api/bookings` to create a 10th booking for that same event
3. Send `GET /api/events/:id` to re-fetch available seats
**Expected Results**: Oldest booking is deleted; new booking is created; `availableSeats` is decremented by the new booking's quantity (seat permanently burned via `eventRepository.decrementSeats`)
**Business Rule**: `sameEventFallback = true` → `decrementSeats` at `bookingService.js:95-96`
**Suggested Layer**: API

---

### TC-102: Booking reference first character matches event title first character (uppercase)
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User is logged in; event with known title exists (e.g., "Tech Conference Bangalore")
**Steps**:
1. Book the event via UI
2. Read the `bookingRef` from the confirmation card
**Expected Results**: `bookingRef` starts with the uppercase first character of the event title followed by a hyphen and 6 alphanumeric characters — e.g., `T-A3FZ19` for "Tech Conference Bangalore"
**Business Rule**: Rule 7 — `randomRef()`: `prefix = (eventTitle?.[0] ?? 'E').toUpperCase()` at `bookingService.js:12`
**Suggested Layer**: E2E

---

### TC-103: Refund eligibility — single ticket booking is eligible
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User is on booking detail page for a booking with `quantity = 1`
**Steps**:
1. Click "Check eligibility for refund?"
2. Wait for spinner to disappear (~4 seconds)
3. Read the result
**Expected Results**: `#refund-result` shows green card with "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: Rule 8 — `quantity === 1 ? 'eligible' : 'ineligible'` at `[id]/page.tsx:27`
**Suggested Layer**: Component

---

### TC-104: Refund eligibility — multi-ticket booking is NOT eligible
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User is on booking detail page for a booking with `quantity = 3`
**Steps**:
1. Click "Check eligibility for refund?"
2. Wait for spinner to disappear (~4 seconds)
3. Read the result
**Expected Results**: `#refund-result` shows red card with "Not eligible for refund. Group bookings (3 tickets) are non-refundable."
**Business Rule**: Rule 8 — `quantity > 1 → ineligible`; message uses actual quantity at `[id]/page.tsx:66`
**Suggested Layer**: Component

---

### TC-105: Refund eligibility spinner shows during the 4-second check
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is on a booking detail page in idle refund state
**Steps**:
1. Click "Check eligibility for refund?"
2. Immediately check for spinner
3. Wait for spinner to disappear
**Expected Results**: `#refund-spinner` is visible immediately after clicking; disappears after ~4 seconds; `#refund-result` then appears
**Business Rule**: Rule 8 — `setTimeout(..., 4000)` at `[id]/page.tsx:26`
**Suggested Layer**: Component

---

### TC-106: Total price is calculated as price × quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Event with known price exists (e.g., Tech Conference Bangalore at $1499); user books 3 tickets
**Steps**:
1. Book the event with quantity = 3
2. View the booking detail page
3. Check "Total Paid" in Payment Summary
**Expected Results**: "Total Paid" shows $4,497; API response `totalPrice` = `event.price × quantity`
**Business Rule**: Rule 9 — `totalPrice = parseFloat(event.price) * data.quantity` at `bookingService.js:99`
**Suggested Layer**: E2E / API

---

### TC-107: GET /api/bookings returns paginated response shape
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is authenticated; user has bookings
**Steps**:
1. Send `GET /api/bookings?page=1&limit=10`
**Expected Results**: Response includes `pagination.page`, `pagination.limit`, `pagination.total`, `pagination.totalPages`; `data` array has at most 10 items
**Business Rule**: `bookingService.getBookings` default limit=10 at `bookingService.js:39`
**Suggested Layer**: API

---

### TC-108: Cancelling a booking releases seat count for dynamic events
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has a booking for a dynamic (user-created) event; user knows current computed `availableSeats`
**Steps**:
1. Note `availableSeats` for the event via `GET /api/events/:id`
2. Cancel the booking via `DELETE /api/bookings/:id`
3. Re-fetch `GET /api/events/:id`
**Expected Results**: `availableSeats` increases by the cancelled booking's quantity (computed value: total - remaining booked quantities)
**Business Rule**: Rule 6 — dynamic events compute seats as `totalSeats - sum(user's booking quantities)`; cancellation removes booking record so sum drops
**Suggested Layer**: API

---

### TC-109: "Clear all bookings" link is always visible on bookings page when bookings exist
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has at least one booking
**Steps**:
1. Navigate to `/bookings`
2. Look for "Clear all bookings" link in the top-right area
**Expected Results**: "Clear all bookings" link is visible; sub-text "Do this often for clean test data." is also visible
**Business Rule**: Flow 4 — UI always renders clear option when on `/bookings`; `bookings/page.tsx:57-63`
**Suggested Layer**: E2E / Component

---

## Security

### TC-200: Cross-user booking access shows "Access Denied" in UI
**Category**: Security
**Priority**: P0
**Preconditions**: Two test accounts exist (`pradipdarji@gmail.com` / `Pradip@123` and `rahulshetty1@yahoo.com` / `Magiclife1!`); User A has a booking
**Steps**:
1. Log in as User A (`pradipdarji@gmail.com`), create a booking, note the booking ID
2. Clear localStorage JWT (`localStorage.removeItem('token')`)
3. Log in as User B (`rahulshetty1@yahoo.com`)
4. Navigate to `/bookings/:userA_booking_id`
**Expected Results**: Page renders `EmptyState` with title "Access Denied" and description "You are not authorized to view this booking."; "View My Bookings" button is present
**Business Rule**: Rule 2 — `is403 = (error as any)?.status === 403` → "Access Denied" at `[id]/page.tsx:119`
**Suggested Layer**: E2E

---

### TC-201: Cross-user GET booking returns 403 via API
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `GET /api/bookings/:userA_booking_id` with User B's JWT
**Expected Results**: HTTP 403; response body contains `"You are not authorized to view this booking"`
**Business Rule**: `booking.userId !== userId` → `ForbiddenError` at `bookingService.js:57`
**Suggested Layer**: API

---

### TC-202: Cross-user DELETE booking returns 403 via API
**Category**: Security
**Priority**: P0
**Preconditions**: User A has a booking; User B has a valid JWT
**Steps**:
1. Send `DELETE /api/bookings/:userA_booking_id` with User B's JWT
**Expected Results**: HTTP 403; booking is NOT deleted from the database
**Business Rule**: `booking.userId !== userId` → `ForbiddenError` at `bookingService.js:129`
**Suggested Layer**: API

---

### TC-203: Unauthenticated GET /api/bookings returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No Authorization header
**Steps**:
1. Send `GET /api/bookings` with no JWT
**Expected Results**: HTTP 401; error response "Unauthorized"
**Business Rule**: Auth middleware applied to all `/api/bookings` routes
**Suggested Layer**: API

---

### TC-204: Unauthenticated GET /api/bookings/:id returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No Authorization header
**Steps**:
1. Send `GET /api/bookings/1` with no JWT
**Expected Results**: HTTP 401
**Business Rule**: Auth middleware
**Suggested Layer**: API

---

### TC-205: Unauthenticated DELETE /api/bookings (clear all) returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: No Authorization header
**Steps**:
1. Send `DELETE /api/bookings` with no JWT
**Expected Results**: HTTP 401
**Business Rule**: Auth middleware; `clearAllBookings` requires authenticated user
**Suggested Layer**: API

---

### TC-206: Cross-user booking lookup by ref returns 403
**Category**: Security
**Priority**: P1
**Preconditions**: User A has a booking with known `bookingRef`; User B has a valid JWT
**Steps**:
1. Send `GET /api/bookings/ref/:userA_ref` with User B's JWT
**Expected Results**: HTTP 403; `"You do not own this booking"`
**Business Rule**: `booking.userId !== userId` → `ForbiddenError` at `bookingService.js:64`
**Suggested Layer**: API

---

## Negative / Error

### TC-300: Navigate to non-existent booking ID shows "Booking not found"
**Category**: Negative
**Priority**: P1
**Preconditions**: User is logged in
**Steps**:
1. Navigate to `/bookings/99999` (ID that does not exist)
**Expected Results**: `EmptyState` with title "Booking not found" and description "This booking doesn't exist or may have been cancelled."; "View My Bookings" button present
**Business Rule**: `NotFoundError` → API 404 → frontend `isError` with non-403 status at `[id]/page.tsx:123`
**Suggested Layer**: E2E

---

### TC-301: GET /api/bookings/:id with non-existent ID returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `GET /api/bookings/99999` with valid JWT
**Expected Results**: HTTP 404; error message `"Booking with id 99999 not found"`
**Business Rule**: `bookingRepository.findByIdOnly(id)` returns null → `NotFoundError` at `bookingService.js:56`
**Suggested Layer**: API

---

### TC-302: Create booking with insufficient seats returns 400
**Category**: Negative
**Priority**: P0
**Preconditions**: User is authenticated; event has 0 personal available seats (all booked by this user)
**Steps**:
1. Send `POST /api/bookings` with `quantity: 1` for a fully-booked event
**Expected Results**: HTTP 400; `"Only 0 seat(s) available, but 1 requested"`
**Business Rule**: `personalAvailable < data.quantity` → `InsufficientSeatsError` at `bookingService.js:88-91`
**Suggested Layer**: API

---

### TC-303: Create booking for non-existent event returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `eventId: 99999` and valid customer fields
**Expected Results**: HTTP 404; `"Event with id 99999 not found"`
**Business Rule**: `eventRepository.findById` returns null → `NotFoundError` at `bookingService.js:83`
**Suggested Layer**: API

---

### TC-304: Create booking with missing required fields returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` omitting `customerName`
2. Send `POST /api/bookings` omitting `customerEmail`
3. Send `POST /api/bookings` omitting `customerPhone`
**Expected Results**: Each returns HTTP 400; `details` array names the missing field and message
**Business Rule**: `validateCreateBooking` — each field has `notEmpty()` at `bookingValidator.js:21,27,33`
**Suggested Layer**: API

---

### TC-305: Create booking with quantity = 0 or negative returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 0`
2. Send `POST /api/bookings` with `quantity: -1`
**Expected Results**: HTTP 400 for both; `"Quantity must be an integer between 1 and 10"`
**Business Rule**: `isInt({ min: 1, max: 10 })` at `bookingValidator.js:39`
**Suggested Layer**: API

---

### TC-306: Create booking with quantity > 10 returns 400
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `quantity: 11`
**Expected Results**: HTTP 400; `"Quantity must be an integer between 1 and 10"`
**Business Rule**: `isInt({ min: 1, max: 10 })` at `bookingValidator.js:39`
**Suggested Layer**: API

---

### TC-307: Cancel a booking that has already been cancelled returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: User is authenticated; a booking exists
**Steps**:
1. Send `DELETE /api/bookings/:id` to cancel the booking
2. Send `DELETE /api/bookings/:id` again for the same ID
**Expected Results**: Second request returns HTTP 404; `"Booking with id X not found"`
**Business Rule**: `bookingRepository.findById` returns null after deletion → `NotFoundError` at `bookingService.js:128`
**Suggested Layer**: API

---

### TC-308: Bookings page shows error state when server is unreachable
**Category**: Negative
**Priority**: P2
**Preconditions**: `GET /api/bookings` returns a non-2xx response (mocked via route interception)
**Steps**:
1. Intercept `GET /api/bookings` to return HTTP 500
2. Navigate to `/bookings`
**Expected Results**: `EmptyState` renders with title "Couldn't load bookings", description "Failed to connect to the server. Please try again.", and a "Retry" button
**Business Rule**: `isError` branch in `BookingsContent` at `bookings/page.tsx:72`
**Suggested Layer**: Component

---

### TC-309: Create booking with invalid customerName (1 character) returns 400
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `customerName: "A"` (1 char)
**Expected Results**: HTTP 400; `"Customer name must be at least 2 characters"`
**Business Rule**: `isLength({ min: 2 })` at `bookingValidator.js:24`
**Suggested Layer**: API

---

### TC-310: Create booking with invalid phone format returns 400
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `customerPhone: "abcde12345"` (contains letters)
**Expected Results**: HTTP 400; `"Customer phone must contain only digits and +, -, spaces, or parentheses"`
**Business Rule**: `.matches(/^[0-9+\-\s()]+$/)` at `bookingValidator.js:36`
**Suggested Layer**: API

---

### TC-311: Create booking with invalid email format returns 400
**Category**: Negative
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `customerEmail: "not-an-email"`
**Expected Results**: HTTP 400; `"Customer email must be a valid email address"`
**Business Rule**: `.isEmail()` at `bookingValidator.js:29`
**Suggested Layer**: API

---

## Edge Cases

### TC-400: Exactly 9 bookings — adding 10th prunes oldest from a DIFFERENT event (preferred path)
**Category**: Edge Case
**Priority**: P0
**Preconditions**: User has exactly 9 bookings across at least 2 different events; oldest booking is for a different event than the new one
**Steps**:
1. Note the ID of the oldest booking
2. Create a new booking for Event X (different from oldest booking's event)
3. Retrieve all bookings
**Expected Results**: Count stays at 9; oldest booking (different event) is gone; new booking is present; no seat burn on the pruned event
**Business Rule**: `findOldestUserBookingExcludingEvent` at `bookingService.js:73`; `sameEventFallback = false`
**Suggested Layer**: API

---

### TC-401: Exactly 9 bookings all from same event — 10th triggers same-event fallback and burns seat
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has 9 bookings all for Event X; sufficient seats remain
**Steps**:
1. Note `availableSeats` for Event X
2. Create a new (10th) booking for Event X
3. Re-fetch Event X available seats
**Expected Results**: Oldest booking removed; new booking created; `availableSeats` decremented by new booking's quantity (`decrementSeats` called); seat is permanently burned
**Business Rule**: `sameEventFallback = oldest.eventId === Number(data.eventId)` → `decrementSeats` at `bookingService.js:95-96`
**Suggested Layer**: API

---

### TC-402: Quantity = 1 (minimum) — decrement button disabled at 1
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is logged in; navigated to event detail page
**Steps**:
1. Observe the quantity control (default = 1)
2. Attempt to click the "−" decrement button
**Expected Results**: Decrement button is disabled when quantity = 1; quantity cannot go below 1; booking proceeds with `quantity: 1`
**Business Rule**: Quantity boundary: 1 is minimum (`isInt({ min: 1 })` at `bookingValidator.js:39`)
**Suggested Layer**: E2E

---

### TC-403: Quantity = 10 (maximum) — increment button disabled at 10
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is logged in; event has >= 10 available seats
**Steps**:
1. Navigate to event detail page
2. Click "+" increment button 9 times to reach quantity 10
3. Attempt to click "+" again
**Expected Results**: Increment button is disabled at 10; quantity cannot exceed 10; booking proceeds with `quantity: 10`; `totalPrice = price × 10`
**Business Rule**: Quantity boundary: 10 is maximum (`isInt({ max: 10 })` at `bookingValidator.js:39`)
**Suggested Layer**: E2E

---

### TC-404: Refund eligibility boundary — quantity = 2 is NOT eligible (first ineligible value)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User is on booking detail page for a booking with `quantity = 2`
**Steps**:
1. Click "Check eligibility for refund?"
2. Wait 4 seconds for result
**Expected Results**: `#refund-result` shows "Not eligible for refund. Group bookings (2 tickets) are non-refundable."
**Business Rule**: Rule 8 — threshold is `quantity === 1`; 2 is the first failing value at `[id]/page.tsx:27`
**Suggested Layer**: Component

---

### TC-405: Booking reference uniqueness — collision retry up to 10 times then timestamp fallback
**Category**: Edge Case
**Priority**: P2
**Preconditions**: `bookingRepository.findByRef` is mocked to always find a collision for the first 10 attempts
**Steps**:
1. Trigger booking creation with mocked `findByRef` always returning a match
2. Verify the 11th attempt uses timestamp-based fallback ref
**Expected Results**: `bookingRef` matches pattern `[A-Z]-[A-Z0-9]{8}` (timestamp suffix) rather than the 6-char format; booking is still created successfully
**Business Rule**: `generateUniqueRef` — retries `< 10` then `${prefix}-${Date.now().toString(36).toUpperCase().slice(-8)}` at `bookingService.js:29-31`
**Suggested Layer**: Unit

---

### TC-406: Clear all bookings when only one booking exists — response shows deleted: 1
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has exactly 1 booking
**Steps**:
1. Send `DELETE /api/bookings` with valid JWT
**Expected Results**: HTTP 200; response `{ deleted: 1 }`; subsequent `GET /api/bookings` returns empty array
**Business Rule**: `clearAllBookings` → `bookingRepository.deleteAllForUser` returns `result.count` at `bookingService.js:122-124`
**Suggested Layer**: API

---

### TC-407: Pagination — page 2 with partial results
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has more than 5 bookings
**Steps**:
1. Send `GET /api/bookings?page=2&limit=5`
**Expected Results**: Response `pagination.page = 2`, `data` array has <= 5 items; `pagination.totalPages` is correct
**Business Rule**: Pagination at `bookingService.js:37-51`
**Suggested Layer**: API

---

### TC-408: Event title starting with a digit — booking ref prefix is that digit
**Category**: Edge Case
**Priority**: P2
**Preconditions**: An event exists whose title starts with a digit (e.g., "100 Days Festival")
**Steps**:
1. Book the event
2. Check `bookingRef` value
**Expected Results**: `bookingRef` starts with `"1-XXXXXX"` — `toUpperCase()` has no effect on digits
**Business Rule**: `prefix = (eventTitle?.[0] ?? 'E').toUpperCase()` at `bookingService.js:12`
**Suggested Layer**: Unit / API

---

### TC-409: Create booking with eventId = 0 or negative returns 400
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User is authenticated
**Steps**:
1. Send `POST /api/bookings` with `eventId: 0`
2. Send `POST /api/bookings` with `eventId: -1`
**Expected Results**: HTTP 400; `"Event ID must be a positive integer"`
**Business Rule**: `isInt({ min: 1 })` on eventId at `bookingValidator.js:17`
**Suggested Layer**: API

---

### TC-410: Create booking with customerPhone exactly 10 digits (minimum valid)
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User is authenticated; valid event with seats
**Steps**:
1. Send `POST /api/bookings` with `customerPhone: "9876543210"` (exactly 10 digits)
**Expected Results**: HTTP 201; booking created successfully; phone accepted
**Business Rule**: `isLength({ min: 10 })` at `bookingValidator.js:35`
**Suggested Layer**: API

---

## UI State

### TC-500: Bookings list shows skeleton loading state while fetching
**Category**: UI State
**Priority**: P1
**Preconditions**: API response is delayed (mocked via route interception)
**Steps**:
1. Intercept `GET /api/bookings` with a delayed response
2. Navigate to `/bookings`
3. Observe the page before data loads
**Expected Results**: 5 `BookingCardSkeleton` placeholders are shown while `isLoading = true` at `bookings/page.tsx:67`
**Business Rule**: `isLoading` branch in `BookingsContent`
**Suggested Layer**: Component

---

### TC-501: Bookings list shows empty state when user has no bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: User is logged in with zero bookings (or mock empty response)
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: `EmptyState` renders with title "No bookings yet", description "You haven't booked any events yet. Browse upcoming events and grab your tickets!", and "Browse Events" button linking to `/events`
**Business Rule**: `bookings.length === 0` branch at `bookings/page.tsx:80`
**Suggested Layer**: E2E / Component

---

### TC-502: Booking detail page shows full-screen spinner while fetching
**Category**: UI State
**Priority**: P2
**Preconditions**: API response is delayed (mocked)
**Steps**:
1. Intercept `GET /api/bookings/:id` with a delayed response
2. Navigate to `/bookings/:id`
3. Observe before data loads
**Expected Results**: `Spinner size="lg"` visible inside `min-h-[60vh]` container at `[id]/page.tsx:115`
**Business Rule**: `isLoading` branch in `BookingDetailPage`
**Suggested Layer**: Component

---

### TC-503: Cancel booking confirmation dialog appears before deletion
**Category**: UI State
**Priority**: P0
**Preconditions**: User is on a booking detail page with a confirmed booking
**Steps**:
1. Click "Cancel Booking" button
2. Observe the dialog
**Expected Results**: `ConfirmDialog` appears with title "Cancel this booking?"; description mentions the booking ref and seat count (e.g., "Cancelling T-A3FZ19 will release 2 seat(s)..."); "Yes, cancel it" button and close (×) button are visible
**Business Rule**: `setConfirm(true)` triggers `ConfirmDialog` at `[id]/page.tsx:215`
**Suggested Layer**: E2E

---

### TC-504: Dismissing cancel dialog without confirming does NOT cancel the booking
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on a booking detail page; cancel dialog is open
**Steps**:
1. Click "Cancel Booking" to open dialog
2. Click the close (×) button or press Escape to dismiss
3. Observe booking status
**Expected Results**: Dialog closes; booking is still present in `/bookings`; no DELETE API call was made; "Cancel Booking" button still visible on detail page
**Business Rule**: `onClose={() => setConfirm(false)}` — `handleCancel` only fires via `onConfirm` at `[id]/page.tsx:216`
**Suggested Layer**: E2E

---

### TC-505: Booking detail breadcrumb displays the booking reference in monospace font
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on a valid booking detail page
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the breadcrumb nav at the top
**Expected Results**: Breadcrumb shows "My Bookings / {bookingRef}"; the ref portion renders in `font-mono` class at `[id]/page.tsx:150`; ref also appears in the header badge
**Business Rule**: Breadcrumb uses `booking.bookingRef`
**Suggested Layer**: E2E

---

### TC-506: Cancel booking success — toast appears and user redirects to /bookings
**Category**: UI State
**Priority**: P0
**Preconditions**: User confirms cancellation in the dialog
**Steps**:
1. Confirm cancellation by clicking "Yes, cancel it"
2. Observe page transition and notification
**Expected Results**: Success toast "Booking cancelled successfully" appears; user is redirected to `/bookings`; the cancelled booking is no longer in the list
**Business Rule**: `onSuccess` callback: `toast(...)` + `router.push('/bookings')` at `[id]/page.tsx:104-106`
**Suggested Layer**: E2E

---

### TC-507: "Clear all bookings" button shows "Clearing…" text and is disabled while in progress
**Category**: UI State
**Priority**: P2
**Preconditions**: User has bookings; network is slow (delayed mock)
**Steps**:
1. Click "Clear all bookings" and accept the confirm dialog
2. Observe the button state while the DELETE request is in flight
**Expected Results**: Button text changes to "Clearing…"; button has `disabled` attribute and `opacity-50` styling during the API call
**Business Rule**: `clearing` state variable; `{clearing ? 'Clearing…' : 'Clear all bookings'}` at `bookings/page.tsx:60`
**Suggested Layer**: Component

---

### TC-508: Refund eligibility state machine — button hidden once checking starts
**Category**: UI State
**Priority**: P2
**Preconditions**: User is on booking detail page; refund status is "idle"
**Steps**:
1. Click "Check eligibility for refund?"
2. Immediately check for the "Check eligibility" button
3. Wait for result
**Expected Results**: After click: button is gone (status = "checking"); spinner (`#refund-spinner`) shows; after 4 seconds spinner is replaced by result card (`#refund-result`); button never reappears
**Business Rule**: `status` state machine: idle → checking → eligible/ineligible at `[id]/page.tsx:22-29`
**Suggested Layer**: Component

---

### TC-509: Booking detail shows "Access Denied" (not "Booking not found") on 403 errors
**Category**: UI State
**Priority**: P0
**Preconditions**: User B's JWT; User A's booking ID
**Steps**:
1. Log in as User B; navigate to `/bookings/:userA_booking_id`
2. Observe the rendered error state
**Expected Results**: `EmptyState` title is "Access Denied" (not "Booking not found"); description is "You are not authorized to view this booking."; correct branching on `error.status === 403` at `[id]/page.tsx:119`
**Business Rule**: Frontend distinguishes 403 vs 404 to show appropriate message
**Suggested Layer**: E2E

---

### TC-510: Bookings page pagination UI renders when total exceeds page size
**Category**: UI State
**Priority**: P2
**Preconditions**: API returns `pagination.totalPages > 1` (mocked)
**Steps**:
1. Intercept `GET /api/bookings` to return a response with `pagination.totalPages = 3, page = 1`
2. Navigate to `/bookings`
3. Observe pagination controls
**Expected Results**: `Pagination` component renders; clicking next page appends `?page=2` to URL and triggers new API call; `currentPage` and `totalPages` reflect the response
**Business Rule**: Pagination in `BookingsContent` at `bookings/page.tsx:99-105`; `changePage` updates URL params
**Suggested Layer**: Component

---

### TC-511: Cancel booking — dialog description shows correct booking ref and seat count
**Category**: UI State
**Priority**: P1
**Preconditions**: User is on a booking detail page with booking ref "T-A3FZ19" and quantity 2
**Steps**:
1. Click "Cancel Booking"
2. Read the dialog description text
**Expected Results**: Description reads "Cancelling T-A3FZ19 will release 2 seat(s) back to the event. This cannot be undone."
**Business Rule**: `description` prop interpolates `booking.bookingRef` and `booking.quantity` at `[id]/page.tsx:221`
**Suggested Layer**: E2E / Component
