# Deployment and operations

## Verified testnet contracts

Chain ID: 10143. RPC: `https://testnet-rpc.monad.xyz`. Final deployment begins at block 69785714. All three sources passed the MONSKILLS verification service on 10 October 2026. MonadVision reported perfect matches; Monadscan verified manager/resolver and reported MockUSDC already verified. `deployments/bytecode-check.json` independently confirms creation inputs and runtime code for all three contracts.

| Contract | Actual address / explorer |
|---|---|
| MockUSDC | [0xc574794b36fedf6dd2f0e621cc2240d96664a1e6](https://testnet.monadscan.com/address/0xc574794b36fedf6dd2f0e621cc2240d96664a1e6) |
| AegisPolicyManager | [0xf72da3dbf0c764e5d962847efce7223877259226](https://testnet.monadscan.com/address/0xf72da3dbf0c764e5d962847efce7223877259226) |
| DemoWeatherResolver | [0x16e8e989931be076c11d821908dc6737c237f4db](https://testnet.monadscan.com/address/0x16e8e989931be076c11d821908dc6737c237f4db) |

Public evidence service: [AEGIS independent archive](https://aegis-evidence.sweetmoss1.chatgpt.site). Its separate Sites project binds its own R2 bucket and D1 catalog. The static frontend neither owns nor packages evidence objects. Public frontend publication status is recorded in `deployments/hosting.json` when verified.

`deployments/monad-testnet.json` contains actual receipts, gas limits, effective prices, derived Monad fees, and block timestamps. Exact historic submission-to-confirmation latency was not instrumented and is explicitly unavailable. Verification API responses are retained in `deployments/verification-results.json`. Unsigned simulation predictions are excluded from public records.

## User-controlled signing

Wallet A: `0xd4fEbE16AefC4498828bF439FD4C6Eb569A37666`; Wallet B: `0x48915030F02e64a698c2a72580DE42AFc5856865`; Wallet C: `0xDa62770d6caA9A455537E00989166c52264a1349`.

The selected encrypted account is `aegis-testnet`. Enter its password only in your own terminal. Never put private keys or passwords in chat, environment examples, command arguments, Git, or evidence storage. Contracts are already deployed; do not rerun deployment merely to seed events.

For a deliberate fresh deployment:

```powershell
Set-Location C:\Users\Aditya\Orakels\aegis
powershell -ExecutionPolicy Bypass -File scripts/deploy-testnet.ps1 -AccountName aegis-testnet
node scripts/verify-contracts.mjs
node scripts/record-deployment.mjs
```

The script checks the decrypted address, checks chain ID, simulates, estimates gas, broadcasts, and records only successful real receipts. If interrupted, inspect `contracts/broadcast/Deploy.s.sol/10143/run-latest.json` and the RPC before retrying. Preserve previous deployment history. If the verification API is unavailable, use Foundry's Sourcify verifier with the exact compiler/settings/constructor arguments and retain its actual outcome; do not label an attempt as success.

## Evidence runtime

Set production variables in the evidence site's runtime configuration, not the hosting manifest: `RPC_URL`, `ALLOWED_MANAGERS` (verified manager addresses only), and `ALLOWED_ORIGINS` (frontend origin). Do not set `LOCAL_ONLY` on the public service. Deploy a saved evidence version after environment changes. The service holds no transaction-signing key. Capture authorization is an origin/action/payload/event-bound wallet signature with a short expiry and single-use nonce.

Check `/health` for `storageConfigured:true` and `chainConfigured:true`. Public objects use `/evidence/{keccak256}`. Capture history uses `/events?manager={address}&eventId={id}`. Signed `/publish` archives canonical specifications and fixed synthetic fixtures. Signed `/capture` can only request the frozen ERA5 query, after day 5 and before day 14. Permissionless `/timeout` archives the fixed timeout commitment once eligible; the chain independently enforces its state and timing.

Create an event bundle using current chain time and the next unregistered event ID:

```powershell
node scripts/prepare-event.mjs deployments/monad-testnet.json synthetic YES
# Register that bundle before generating the next ID.
node scripts/prepare-event.mjs deployments/monad-testnet.json synthetic NO
node scripts/prepare-event.mjs deployments/monad-testnet.json synthetic INVALID
node scripts/prepare-event.mjs deployments/monad-testnet.json live YES
```

Use the operator screen to register each prepared bundle, then publish its specification/fixture to the independent archive with Wallet A. Registration is irreversible. Generating two bundles before registering either gives the same event ID; register sequentially. Live observation is the first IST Saturday at least 72 hours after preparation. No synthetic fixture is accepted for a live event.

## Reproducible local verification

Install dependencies, workspace-local Foundry 1.8.0 and forge-std v1.11.0 as described in the README. Run `npm run contracts:test`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Start Monad-configured Anvil on loopback, run `npm run demo`, start the separate local evidence server and frontend, then run `node scripts/browser-qa.mjs`. A rerun deploys fresh contracts and retains previous deployment/result records in `.local/history/`; it does not erase existing liabilities. Keep the evidence server aligned with the latest local manager.

Standalone verification:

```powershell
npm run verify:evidence -- "https://aegis-evidence.sweetmoss1.chatgpt.site/evidence/MANIFEST_HASH" "https://aegis-evidence.sweetmoss1.chatgpt.site/evidence/SPEC_HASH" "https://testnet-rpc.monad.xyz"
```

Replace the placeholders with actual hashes from a committed resolution. The command checks archived raw bytes, canonical manifest, exact specification/term bindings, rainfall calculation, chain, request, and onchain commitment. Public archive integrity checks remain available without the frontend. For timeout INVALID, download the ABI-encoded timeout bytes and compare their Keccak hash with `timeoutEvidenceHash(requestId)` and the deadline/status onchain.

## Publication and remaining demonstration

Use the existing exact IDs in `web/.openai/hosting.json` and `evidence/.openai/hosting.json`; never create duplicate sites. Stage source using `scripts/prepare-sites.mjs`, build in the selected staging checkout, and use the Sites workflow helper to push the exact source and package build output. Save that pushed SHA/archive, then deploy the saved version. Source repository credentials are short-lived and must not be printed or persisted.

Before declaring the MVP complete, execute the real two-wallet YES/NO/INVALID lifecycle and redemption, then fund an independently managed Wallet C vault and publish equivalent 200/30 coverage against the same event as Wallet A's 200/25 offer. Record B's genuine purchase of the selected vault, verify isolation, retain completed records, and leave a fresh funded epoch with purchasable quotes. Wallet B/C signing is required; public addresses alone cannot authorize those transactions. Full acceptance status is in `PROGRESS.md`.

## ERA5 integration checks

New markets use source validator v2 (18.5196 / 73.8554); existing v1 commitments remain supported. After a service update, /health reports both supported versions. Runtime signing stays in the authorized external wallet. Public signing keys are never stored by the evidence service.

Run `node scripts/check-era5-source.mjs YYYY-MM-DD` for a read-only provider compatibility audit. This retains exact response bytes and their Keccak hash as QA artifacts; it never creates or settles a market. Run `node scripts/oracle-integration-qa.mjs` to exercise signed capture, independent archival, and real commit/finalization receipts on an isolated local chain with explicitly mocked ERA5 transport. It preserves the existing local chain and all public contracts.

## Multi-city oracle rollout

Deploy the evidence Worker and frontend together after ABI/shared validator export, tests, lint and build. Preserve the existing R2/D1 bindings and public origins. v3 recognizes Pune and Mumbai; earlier v1/v2 objects stay immutable. No contract migration is needed. Read [WEATHER_DATA.md](WEATHER_DATA.md) for `ORACLE_ACCOUNT`/server-only signing, CLI preparation and resolution. Preparation never registers or funds a market. Import prepared JSON in Operator, verify terms, register with the administrator, publish independently, then fund the matching live/replay vault and quote. For historical replay use mode-1 isolation and the actual historical date in the specification; the future clock is demonstration execution only.
