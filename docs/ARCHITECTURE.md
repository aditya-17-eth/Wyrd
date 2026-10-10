# Architecture

`AegisPolicyManager` holds refundable premiums, creates known vault implementations, registers immutable event terms, publishes single-use quotes through each vault's fixed manager, and coordinates settlement. Its administrator and initialized adapter cannot be replaced. Administrator powers are vault/event creation; there is no policy cancellation or collateral/premium sweep.

`AegisUnderwritingVault` holds collateral, nontransferable six-decimal shares, policy reservations, aggregate exposure, and realized results. Deposits require an invited wallet during Funding. Underwriting stops deposits. RunOff prevents issuance; Closed requires zero policies/reserves before redemption. Its immutable mode prevents live and synthetic policies sharing capital.

`DemoWeatherResolver` binds requests to chain ID, adapter, manager, event ID, and specification hash. Authority commits evidence; anyone finalizes its derived YES/NO. Timeout INVALID is a different, deterministic branch from Open after 14 days. Precommitted synthetic INVALID applies only to its designated fixture.

The independently hosted evidence service authenticates capture/publication with domain-bound wallet signatures, restricts fetches to the committed ERA5 source, preserves raw bytes, serializes captures, and freezes first-valid selection. R2 stores content-addressed objects; D1 stores attempts, selection, locks, and used authorization digests. Neither service nor frontend holds signing keys. The static frontend reads financial truth directly from RPC and paginates logs from the deployment block. An indexer is not required for this bounded MVP.

Public interfaces: vault IDs in Quote/Policy; immutable EventTerms; IResolutionAdapter request registration/result reads; `commitEvidence`, `finalize`, `finalizeTimeoutInvalid`; evidence `/publish`, `/capture`, `/timeout`, `/evidence/{hash}`, `/events`, and `/health`. See contract ABIs and source for exact argument shapes.

## Multi-city source and oracle CLI

`evidence/src/core.mjs` owns versioned immutable source configurations and canonical commitments. `weather-client.mjs` has a typed declaration schema, allowlisted historical/forecast requests, strict daily validation and bounded retries. `scripts/weather.ts` discovers genuine candidates; `scripts/oracle.ts` handles registered-event capture, archive verification, authorized resolution, receipt checks and permissionless policy settlement. The frontend consumes independent `/weather/history` and `/weather/forecast` references and verified market specifications; financial values continue to come from contract reads. Historical replay is a separately identified spec/evidence kind bound to existing onchain mode-1 fixture commitments. It preserves the historical provider day separately from the required future execution clock. Forecasts have no resolver path. Full details and trust limits: [WEATHER_DATA.md](WEATHER_DATA.md).
