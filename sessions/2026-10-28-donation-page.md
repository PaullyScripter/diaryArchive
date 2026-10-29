# 2026-10-28 — Static pseudonymous donation page

## Request

Add a static donation page for BTC, ETH, LTC, USDC on Ethereum, and USDT on
Ethereum. Skip XMR for now and explain that every donation is appreciated, but
pseudonymous donations cannot receive site badges, receipts, personal
thank-you emails, or other site rewards.

## Findings

The existing public main layout provides shared navigation and a footer. A
static frontend route is sufficient: no wallet connection, donor form,
backend endpoint, account linkage, or analytics is needed. Blockchain
transactions remain publicly visible, so the page describes the donation flow
as pseudonymous rather than fully anonymous. Ethereum-token network warnings
are shown next to the USDC and USDT addresses.

## Changes

- Added `/donate` with the five supplied addresses and clear irreversible-
  transfer/network warnings.
- Added browser-local copy buttons with an accessible live status and no
  server request.
- Added a responsive reference-inspired layout with a crypto selector, a
  locally rendered QR code for the selected address, and a copyable address
  panel beneath it. QR values are generated in the browser; no QR service is
  contacted.
- Added the appreciation and no-site-rewards disclosure requested by the
  project owner.
- Added Donate links to the main and footer navigation.
- Added focused rendering, copy behavior, XMR omission, and accessibility
  tests.
- Added the local `qrcode.react` frontend dependency for QR rendering.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- --run src/tests/donation-page.test.tsx` — passed: 3 tests.
- `git diff --check` — passed.

## Git

Included in the implementation commit for this prompt; push status is
recorded in the final response.

## Follow-up

If donation accounting, receipts, tax acknowledgements, exchange rates, or
additional networks are needed later, they require a separate threat-model and
compliance review rather than extending this static page casually.
