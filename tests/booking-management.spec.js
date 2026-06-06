import { test, expect } from '@playwright/test';

// playwright.config.ts sets baseURL = https://eventhub.rahulshettyacademy.com
// All page.goto() calls use relative paths so this file is environment-agnostic.

const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  // Fix #5: exact link name with Unicode arrow (live site renders '→' not '->'), .first() removed
  await expect(page.getByRole('link', { name: 'Browse Events →' })).toBeVisible();
}

/**
 * Books the first available (non-sold-out) event.
 * Returns { bookingRef, eventTitle }.
 * Precondition: user must be logged in.
 */
async function bookEvent(page) {
  await page.goto('/events');

  const firstCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstCard).toBeVisible();

  const eventTitle = (await firstCard.locator('h3').textContent())?.trim() ?? '';
  await firstCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  // Fill customer form
  await page.getByLabel('Full Name').fill('Test User');
  // Fix #4: getByTestId over #id — data-testid="customer-email" at events/[id]/page.tsx:137
  await page.getByTestId('customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  // Fix #2: role over CSS class — button text confirmed at events/[id]/page.tsx:152
  await page.getByRole('button', { name: 'Confirm Booking' }).click();

  // Capture booking ref from confirmation card.
  // TODO: switch to page.getByTestId('booking-ref') once data-testid="booking-ref" is deployed
  // (added locally at events/[id]/page.tsx:40 — awaiting deployment)
  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  console.log(`Booked "${eventTitle}" — ref: ${bookingRef}`);
  return { bookingRef, eventTitle };
}

/**
 * Clears all bookings for the test account.
 * Safe to call when already empty.
 */
async function clearBookings(page) {
  await page.goto('/bookings');
  const isEmpty = await page.getByText('No bookings yet').isVisible().catch(() => false);
  if (isEmpty) return;

  // Register dialog handler BEFORE triggering the browser confirm() dialog
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Management — Critical Happy Paths', () => {

  // TC-001 ───────────────────────────────────────────────────────────────────
  test('TC-001: displays booking card on bookings list page', async ({ page }) => {
    // -- Step 1: Login, clear state, create one fresh booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to /bookings --
    await page.goto('/bookings');

    // -- Step 3: Assert booking card renders with correct data --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(bookingRef);

    // -- Step 4: Assert booking ref first char matches event title first char (business-rules.md §7) --
    // Fix #1: validates the key domain rule — ref format [FIRST_LETTER]-[6_RANDOM]
    expect(bookingRef.charAt(0)).toBe(eventTitle.charAt(0).toUpperCase());
  });

  // TC-002 ───────────────────────────────────────────────────────────────────
  test('TC-002: shows all sections on booking detail page', async ({ page }) => {
    // -- Step 1: Login, clear state, create one fresh booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to /bookings and open View Details --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Verify booking ref in header badge --
    // TODO: switch to page.getByTestId('booking-ref-badge') once data-testid="booking-ref-badge"
    // is deployed (added locally at bookings/[id]/page.tsx:157 — awaiting deployment)
    await expect(page.locator('span.font-mono.font-bold').first()).toContainText(bookingRef);

    // -- Step 4: Verify Event Details section --
    await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
    await expect(page.getByText(eventTitle).first()).toBeVisible();

    // -- Step 5: Verify Customer Details section --
    await expect(page.getByRole('heading', { name: 'Customer Details' })).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();

    // -- Step 6: Verify Payment Summary section --
    await expect(page.getByRole('heading', { name: 'Payment Summary' })).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();

    // -- Step 7: Verify refund eligibility check button is present --
    // Fix #3a: getByTestId over #id — data-testid="check-refund-btn" at bookings/[id]/page.tsx:37
    await expect(page.getByTestId('check-refund-btn')).toBeVisible();
  });

  // TC-003 ───────────────────────────────────────────────────────────────────
  test('TC-003: cancels booking from detail page — shows toast and redirects', async ({ page }) => {
    // -- Step 1: Login, clear state, create one fresh booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page);

    // -- Step 2: Navigate to booking detail via View Details --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click Cancel Booking button --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: Assert confirmation dialog appears --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    // Fix #3b: getByTestId over #id — data-testid="confirm-dialog-yes" at ConfirmDialog.jsx:23
    await expect(page.getByTestId('confirm-dialog-yes')).toBeVisible();

    // -- Step 5: Confirm cancellation --
    await page.getByTestId('confirm-dialog-yes').click();

    // -- Step 6: Assert redirect to /bookings and success toast --
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 7: Assert booking is no longer in the list --
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

});
