# Frontend validation — 10 October 2026

Actual checks completed in the existing checkout:

- `npm test`: 25 passed, 0 failed. Includes independent evidence verification and frontend formatting beyond Number precision, exact signs, and milli-mm thresholds.
- `npm run typecheck`: passed. The final production build also completed its TypeScript stage.
- `npm run lint`: passed without errors or warnings.
- `npm run build`: all nine application pages exported successfully; independent evidence Worker built.
- `node scripts/design-qa.mjs`: passed 36 route/viewport combinations at 1440, 1024, 768, and 390 pixels, with no page overflow or browser exceptions. Checked search, status filtering, category previews, synthetic/live separation, and mobile navigation.
- `node scripts/browser-qa.mjs`: passed real loopback Anvil transactions for buyer purchase, evidence commitment, finalization, NO settlement, deposit approval, funding, quote publication, epoch closure, and redemption. Checked wrong-network blocking, rejected signing, evidence-service failure, evidence hashes, capital locks, and wallet-attributed history.

Browser wallet adapters and conventional test accounts exist only in the local test harness, never in the frontend export. New synthetic fixtures were registered on the existing local chain without resetting it or removing prior policies. No public-network transactions were sent for this frontend task. No Solidity source was changed.

Machine-readable browser results and screenshots are in `.local/qa/design-results.json`, `.local/qa/browser-results.json`, and `.local/qa/aegis-*.png`.

The public configuration contains the recorded Monad Testnet contracts. Its market reads returned no registered markets during the homepage review. The interface therefore shows an empty state. Upcoming categories have no markets or financial values. Verified forecast and historical rainfall series are unavailable and explicitly labeled; category artwork is illustrative. Synthetic replay uses precommitted simulated outcomes, not verified historical weather.

