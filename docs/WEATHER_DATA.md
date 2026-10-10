# Weather data and trusted settlement

Aegis uses Open-Meteo to expose inspectable, reproducible rainfall requests for educational Monad Testnet protection. ERA5 reanalysis reconstructs past conditions; forecasts predict future conditions and are reference information only. Solidity never calls an external API.

## Supported locations and immutable versions

The registry is `evidence/src/core.mjs` (`LOCATIONS`). New v3 market templates are Pune ≥50 mm, Pune ≥20 mm, and Mumbai ≥75 mm. Pune requests 18.5204, 73.8567; Mumbai requests 19.0760, 72.8777. Actual verified ERA5 grid coordinates are respectively 18.5, 73.75 and 19.0, 73.0. The returned grid is validated independently of requested coordinates. A changed grid fails validation; it cannot silently redefine an issued event. Existing v1 and v2 Pune specifications retain their original queries and hashes.

Historical requests use `https://archive-api.open-meteo.com/v1/archive`, identical `start_date` and `end_date` for settlement, `daily=rain_sum`, `models=era5`, `timezone=Asia/Kolkata`, `precipitation_unit=mm`, and `cell_selection=nearest`. Discovery alone permits ranges of up to 366 days. Dates and contiguous arrays, IST offset, units, numeric values and governing grid are checked. The API does not echo an authenticated dataset identifier: the exact allowlisted `models=era5` request binds the dataset selection, while provider authenticity remains trusted. Never use Best Match, ERA5-Land, forecast `past_days`, or another variable for ERA5 settlement.

## Thresholds and event specifications

Existing contracts use **milli-mm**, preserved across clients, UI and resolver: 63.8 mm is 63,800; 50 mm is 50,000. YES uses an inclusive integer comparison. No floating-point financial arithmetic, missing-to-zero conversion, or rounding across thresholds is allowed.

Canonical recursively sorted JSON is hashed with Keccak-256. Specifications bind network, manager, adapter, event ID, requested coordinates, governing grid, source, dataset, variable, units, threshold, day, timezone, cutoff, coverage caps, capture window, invalid procedure, mode and fixture commitments. Registration stores the same specification/source hashes. Issued terms never change. The specification's hash is its content address and is kept outside the JSON itself to avoid circular hashing.

## CLI and archive

Run from the repository root on Node 22.14 or later. In Windows PowerShell use `npm.cmd` in place of `npm` when passing named CLI options; some npm PowerShell shims strip those option names. Direct `node --experimental-strip-types scripts/oracle.ts ...` and `scripts/weather.ts ...` also work:

```powershell
npm run weather:discover -- --start 2026-06-01 --end 2026-09-30
npm run weather:fetch -- --city mumbai --date 2026-07-04
npm run weather:forecast -- --city pune --date 2026-10-11
npm run oracle:prepare -- --city mumbai --threshold 75 --mode live
npm run oracle:prepare -- --city pune --mode historical-replay --date 2026-07-04
```

Preparation is read-only. Inspect the JSON, then use the existing authorized Operator workflow to register and publish the specification. A prepared candidate has no liquidity or purchasability. Create an appropriate mode-isolated vault, fund it, begin underwriting, and publish a valid quote. Purchase eligibility uses the actual chain timestamp and contract cutoff; the maximum claim is reserved atomically.

```powershell
npm run oracle:resolve -- --event 1
npm run oracle:resolve -- --event 1 --bundle .local/oracle/10143-1-historical-replay.json
npm run oracle:verify -- --event 1
```

Use `--deployment <verified JSON>` for a different existing deployment. The CLI validates chain and registered immutable terms, obtains authorized capture/publication signatures, downloads and hashes archived bytes, validates rainfall, checks current resolver status, simulates and estimates gas, submits evidence, waits for receipts, finalizes, settles unclaimed policies for that event, and confirms actual payouts. A repeated successful resolve verifies existing results without submitting duplicate commitments or payouts. Results with real transaction hashes are saved as timestamped `.local/oracle/*-resolution-*.json` files.

The encrypted Foundry account (`ORACLE_ACCOUNT`, default `aegis-testnet`) is unlocked in the user's terminal. Alternatively a server-only `ORACLE_PRIVATE_KEY` environment variable supplies the authorized account. Neither is bundled into frontend code. CLI never writes keys or passwords. Verify operations require no signer.

Exact provider response bytes, canonical manifests and specifications are content-addressed in the independent evidence service (R2/D1 in production, SQLite/files locally). Evidence includes provider, request URL, retrieval time, requested/returned coordinates, date, units, threshold calculation, spec/source hashes, raw hash and context. The raw response is separately retrievable by its hash. `/weather/history` archives discovery responses without creating or resolving markets; `/weather/forecast` is read-only reference information and never enters settlement. Neither exposes synthetic financial data.

## Missing data and operational rules

Each existing live contract requires capture no earlier than observation end +5 days, and before end +14 days. This captures ERA5's approximate publication delay, but does not guarantee availability. These intervals are fixed by the deployed interface; they are committed in each specification, not adjustable for issued events. A future adapter would be required for other windows.

HTTP requests have a 10-second timeout, at most three attempts and exponential backoff for transient failures. Missing/null data remains unavailable. Live failed capture attempts preserve raw bytes and error manifests; retry guidance is normally one hour while the capture window remains open. Operators rerun the command; this is not an unattended scheduler. No valid observation means no YES/NO submission, and coverage collateral remains reserved.

Missing data or resolver inactivity does not itself submit INVALID. At the exact committed deadline, when **no evidence was committed**, anyone can use the existing explicit Operator timeout action to finalize INVALID and settle premium refunds. Already committed YES/NO evidence permanently disables timeout INVALID. Finalization and policy settlement are permissionless. Transaction execution still requires someone to pay gas; active capture depends on the trusted service/authority. There is no challenge window or guarantee of a truthful external observation.

## Historical replay

Historical replay uses the existing isolated mode-1 vault/events, distinct from live mode-0. It commits actual ERA5 raw bytes, their hash, a fixed rainfall measurement and a fixed resulting outcome. It cannot resolve a live market or invoke live capture. Synthetic fixtures remain explicitly simulated and separate.

The deployed manager refuses past observation clocks even in mode 1. Consequently a historical replay commits **both** the actual historical ERA5 day/window and a separate future test execution/purchase clock. The future clock does not claim that the historical rainfall was an unknown insurable event. UI labels this `HISTORICAL REPLAY — TESTNET DEMONSTRATION`. Replays are educational mock-money demonstrations, never genuine advance-purchased insurance.

Discovery on October 10, 2026 found:

| City | Threshold | YES date/value | NO date/value |
|---|---|---|---|
| Pune | 50 mm | July 4, 2026: 115.6 mm | June 1, 2026: 0.2 mm |
| Mumbai | 75 mm | July 4, 2026: 206.8 mm | June 1, 2026: 2.3 mm |

These are retrieved snapshot values, not promises about later provider revisions. Exact requests, raw bytes and retrieval metadata are in `.local/weather/`; registered replay bundles use fresh **single-day** responses rather than truncating range bytes.

`npm run demo:historical` fetches both real Pune days, starts a new isolated local Monad Anvil on 8546, archives provider evidence independently, registers two replay events, deposits 1,000 mock USDC, issues two 200/25 policies, exercises the authenticated TypeScript CLI, verifies YES/NO payouts, duplicate protection and collateral accounting, then stops its owned process. It never resets the existing 8545 chain or sends public transactions. Local receipts/evidence remain in `.local/historical-replay/`; public testnet demonstrations use the user's authorized external wallet and the same Operator/CLI workflow.

## Forecasts, licensing and limitations

Forecasts use the separate documented `https://api.open-meteo.com/v1/forecast` daily `rain_sum` query. UI displays date, expected rainfall, source, retrieval time and an unavailable state outside the horizon or on failure. Retrieval time is not claimed to be model initialization time. This deterministic reference provides no calibrated uncertainty interval; it does not price premiums or block settlement. Optional ensemble probability estimation is not implemented.

ERA5's approximately 0.25° spatial grid differs from conditions at a venue or farm, particularly near Mumbai's coast and Pune's terrain. Gridded reanalysis has basis risk, model error and later revisions. Aegis freezes the first eligible served snapshot, including preliminary ERA5T, and ignores later corrections under the committed rule. An evidence hash proves byte consistency, **not** provider truth or faithful resolver retrieval. This oracle is trusted, not decentralized or trustless.

Attribute Open-Meteo and Copernicus/ECMWF ERA5 under the data's CC BY 4.0 terms. Open-Meteo's free endpoint permits noncommercial uses within its limits; commercial/promotional use needs the applicable commercial access arrangement. This educational testnet integration uses the noncommercial endpoint. Review licensing before changing usage.

Official references: [Forecast API](https://open-meteo.com/en/docs), [Historical API](https://open-meteo.com/en/docs/historical-weather-api), [Ensemble API](https://open-meteo.com/en/docs/ensemble-api), [Terms](https://open-meteo.com/en/terms), [Monad documentation index](https://docs.monad.xyz/llms.txt), [Monad current facts](https://docs.monad.xyz/ai/current-facts).

Tests mock provider HTTP by default. `npm run weather:integration` is an explicit optional live API check. Contract tests cover authorization, timing, binding, duplicate/finalized outcomes, YES/NO/INVALID, replay isolation and reserved collateral. Solidity interfaces and deployments are unchanged.
