# ERA5 integration — 10 October 2026

Published to the existing [evidence archive](https://aegis-evidence.sweetmoss1.chatgpt.site/health) and [Aegis frontend](https://aegis-weather-cover.sweetmoss1.chatgpt.site/resolution/), preserving their public access, project IDs, R2/D1 bindings, and deployment URLs.

New market specifications use latitude 18.5196, longitude 73.8554, daily rain_sum, models=era5, timezone=Asia/Kolkata, precipitation_unit=mm, and cell_selection=nearest. start_date and end_date are the same immutable market observation date. Source validator v2 defaults to this configuration. Existing v1 market specifications and archived hashes retain their original query. No deployed Solidity interface changed.

Missing/null observations, rate limits, network failures, and provider outages remain pending when retry is eligible. Failure bytes and manifests are archived without selecting a rainfall observation. A successful response must match the date, single-day shape, units, offset, governing grid, and allowlisted historical source. Captures, frozen snapshots, and onchain commitments retain the existing day-5/day-14 rules. Forecast endpoints, Best Match, and ERA5-Land substitutions are rejected. See [Open-Meteo historical API documentation](https://open-meteo.com/en/docs/historical-weather-api).

Before commitEvidence, the operator rechecks the independent archive's specification, canonical manifest, raw-response hash, event/request binding, first-selected live snapshot, and fresh chain state/time. The existing external authority wallet signs the simulated transaction; success is shown only after receipt confirmation. The service holds no signing key. Synthetic replay stays separated from live resolution.

Resolution displays the rainfall reading, source request, requested coordinates, governing grid, manifest and raw hashes, retrieval time, and onchain status. An archived-but-uncommitted observation is labeled separately; an archive/chain mismatch produces a verification error.

Actual validation:

- 37 automated evidence/configuration/formatting tests passed.
- TypeScript, lint, and production builds passed.
- Browser wallet flow passed: purchase, deposit approvals, quotes, verified fixture commitment, finalization, settlement, capital locks, redemption, and history.
- 36 route/viewport checks passed at 1440, 1024, 768, and 390 pixels without horizontal page overflow or browser exceptions.
- Isolated oracle integration passed signed publication/capture, archive verification, unauthorized resolver rejection, and real local commitEvidence/finalization receipts. Provider transport was explicitly mocked, not claimed as a real weather observation. Records: `.local/qa/oracle-integration-results.json` and `.local/oracle-qa/`.
- A separate read-only real provider request for 2026-07-01 validated 23.8 mm, Asia/Kolkata, and the returned 18.5 / 73.75 grid. Exact bytes and Keccak hash are retained in `.local/qa/era5-provider-response.json` and `.local/qa/era5-provider-check.json`. This audit is not settlement evidence for any market.
- Published service health reports validator v2, v1 compatibility, storageConfigured=true, and chainConfigured=true. The production resolution page returned HTTP 200.

The public manager had eventCount=0 and policyCount=0 during verification. No public-chain observation was submitted or market resolved. Register future live markets using the existing operator workflow; the authorized wallet captures and commits only once the committed ERA5 window is eligible.

The Sites source workflow pushed the tested source. Its Bash packaging wrapper could not handle Windows paths, so `scripts/package-sites-windows.mjs` invokes the same Sites artifact preparer and uses native Windows tar. Both archives were accepted and deployed successfully. Deployment/version/source records are retained in `deployments/era5-integration.json`.

Production browser QA also passed: resolution and operator routes, v2 coordinates and exact-date query preparation, live specs without replay fixtures, disconnected writes disabled, homepage rendering, and no browser exceptions. The read-only prepared next observation date was 2026-10-17; no registration or signing occurred. Results are in `.local/qa/public-era5-results.json`.
