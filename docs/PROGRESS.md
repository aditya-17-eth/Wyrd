# Honest milestone log

Updated 10 October 2026. Acceptance remains incomplete until the real testnet purchase-to-redemption lifecycle and Wallet C competing quote are verified.

| Milestone | Evidence / status |
|---|---|
| Local MONSKILLS | Installed and read before implementation; seven relevant skills, external-wallet/keystore user choices retained |
| Workspace Foundry | 1.8.0 official Windows binary, checksum verified; Solidity 0.8.28, Monad execution, OZ 5.6.1 |
| Financial lifecycle | All three outcomes, full reservation, escrow separation, epoch closure, rounding and redemption implemented |
| Competing vaults | Fixed independent managers and modes; local B bought C's 200/30 quote after completed core |
| Evidence | Independent Worker/R2/D1; authenticated publish/capture, immutable objects, first snapshot, public downloads/history |
| Financial tests | Latest run recorded below; includes 256-case fuzz and 256 invariant runs at depth 64 |
| Evidence/generator/formatting/RPC tests | 41 passed, including source mismatches, revisions, concurrency, storage-upload deadline crossings, tampering, replay, frontend independence, bigint formatting, request pacing and rate-limit backoff |
| Local actual transactions | 55 seed/demo transactions per fresh run, plus browser purchase/commit/finalize/settle; retained records in .local/history |
| Frontend | Six routes, injected external wallets, actual RPC/event reads, responsive obsidian/ivory/violet design |
| Static checks | Typecheck and lint passed after activity-view refinement; static production export passed |
| Public archive | Published, public, R2/D1 bindings verified; separate site, origin, deployment and runtime configuration |
| Testnet deployment | Final contracts deployed; source verification, exact creation/runtime bytecode, roles and 1,000/200 ceilings checked. Earlier unused deployment retained |
| Public frontend | Published publicly at https://aegis-weather-cover.sweetmoss1.chatgpt.site; saved version and deployment IDs in deployments/hosting.json |
| Real core / competing demo | Requires genuine browser-wallet transactions from A, B and C; not substituted with Anvil receipts |

The final suite passed 22 lifecycle tests plus two invariants over 256 runs × 64 depth (16,384 handler calls, zero handler reverts), including two 256-case fuzz tests. Registration cannot exceed 1,000 event and 200 buyer mUSDC. Three claim groups of 200/300/500 are split across buyers so each remains within 200. Unexpected deposits to both competing vaults and the manager are tested before funding, after purchase, after settlement, and after redemption. Local browser acceptance passed wallet rejection, evidence outage visibility, all six core routes, actual purchase/commit/finalize/settle, per-event transaction links, byte/hash/calculation verification, and mobile overflow checks.

Native Windows Foundry preprocessing emitted import-resolution warnings, but solc compiled successfully and the test runner completed; sandbox signature-cache writes also emitted a warning. These warnings are not represented as successful deployment evidence. A frontend typecheck caught a duplicate type during refinement; it was fixed before publishing. Local evidence-server socket permissions initially blocked browser retrieval; restarting with the permitted socket context restored verified hash matching.

Three supplied wallets received actual test MON faucet receipts, recorded separately. Initial unsigned deployment simulation estimated a 1.589 MON maximum-fee budget; the first deployment charged 0.691983252006718284 MON and the corrected final deployment charged 0.695341258006750886 MON using transaction gas limits and effective prices. Historic signing-to-confirmation latency was not recorded. The final creation inputs, runtime bytecode, roles, and exposure ceilings all match RPC checks. Verification responses and actual fees are recorded rather than inferred from a simulation.

The archive is operational; there is no live weather result for the future seeded event yet. Local synthetic fixtures are explicitly marked. No paid demand, actuarial calibration, APY, customer count, production insurance, or UMA integration is claimed.

## Remaining acceptance and external blockers

The independent evidence service and public frontend are both published at saved version 3; exact source and deployment IDs are in deployments/hosting.json. Upload-completion deadline guards are deployed. Automatic approval review was temporarily unavailable due to the account usage limit, then resumed; publication and the subsequent read-only public browser check completed with approval.

The public RPC's 15 requests/second limit interrupted the balance refresh after the user's successful vault creation. The frontend now shares a four-request-starts/second lane, backs off on rate limits, and batches contract reads only after verifying Multicall3's deployed code and comparing its result with a direct read. A same-block actual testnet snapshot used 12 requests in 4.208 seconds and confirmed vault #1 exists in Funding with zero accounted assets. Confirmed transactions are preserved when a refresh fails. The published browser check verified all six core routes, connected onchain reads, correct deployed addresses, public archive bindings/catalog, no browser exceptions, and no mobile overflow. These checks do not claim signed wallet transactions.

Computer Use's Chrome app approval timed out. The user chose browser wallets for B and C. Real wallet confirmations are required to fund A's core vault, execute purchase/settlement/redemption, authenticate public evidence publication, fund C independently, publish its competing offer, and leave fresh purchasable epochs. Those actions have not been represented as completed. Vault #1 has already been created; do not create it again. The current user action is: claim mock USDC on Protection as A, then approve/deposit 1,000 into vault #1 on Underwrite and open underwriting; verify its RPC state before issuing policies.
