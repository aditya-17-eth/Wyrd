# Reproducible demonstration

## Setup and core flow

Use the deployed chain 10143 configuration, not a local import, for the real demonstration. A manages underwriting and resolves; B buys; C manages the competing vault after the core milestone. Each wallet needs test MON. Mock USDC has no value and can be claimed from the UI once per wallet per day.

1. Connect A, create a synthetic vault in Demo operator (skip creation if vault #1 already exists), claim mock USDC on Protection, then approve and deposit 1,000 on Underwrite and open underwriting. Deposits now freeze.
2. Prepare and sequentially register distinct YES, NO, and INVALID bundles. Publish each specification and immutable fixture to the independent evidence service. Confirm downloads and hashes before selling quotes.
3. A publishes a 200/25 quote for each event. Connect B, claim mock USDC, approve premiums, and buy each. Check reserved coverage 600 and separate premium escrow 75. Redemption is blocked.
4. A loads each matching bundle in Demo operator. YES and NO use Commit reviewed evidence followed by permissionless Finalize committed outcome. INVALID uses only Finalize precommitted INVALID fixture. Each path carries the simulation label.
5. B (or anyone) settles each policy. YES pays 200 and earns its 25 premium, NO earns 25, INVALID refunds 25. The vault ends at 850, escrow at zero, reservations at zero. Confirm separate commitment, finalization, and settlement transactions in Resolution explorer.
6. A ends issuance; anyone closes the fully settled epoch; A redeems all shares for 850. Attempting a second settlement or redemption must fail. Preserve these records.

## Competing quote milestone and fresh judge epoch

After the completed core, create a fresh synthetic vault for A and a separate synthetic vault with fixed manager C. Each invited manager claims mock USDC, funds its own vault with 1,000, and opens underwriting. Register one fresh common synthetic event and archive its fixed fixture. A publishes 200 coverage / 25 premium, and C publishes identical coverage / 30 premium for that exact specification. Compare date, threshold, evidence rules, manager, capacity, and expiry.

B approves 30 and purchases C's offer. C's reservation becomes 200; A's reservation stays zero. The 200 buyer limit prevents B from buying both offers for the same event. A can resolve the event and anyone can finalize/settle, but only C's vault pays its policy. Preserve the completed transaction history and create another fresh common event with open quotes for judges. Leave enough available capital in both vaults; unconsumed quotes expire within 24 hours.

Create a separate live vault and event for the first Saturday at least 72 hours after seeding. Its date and UTC/IST window are immutable. Do not accelerate a live outcome using fixtures. Capture begins five days after observation ends; source commitment must arrive before day 14. A valid commitment permanently prevents timeout INVALID, and anyone can finalize later. An Open request without commitment at day 14 can be timed out by anyone with a premium refund. This waiting period is a real limitation, not a demo failure to conceal.

## Three-minute presentation

- 0:00–0:25: Define the outdoor organizer persona, fixed rainfall trigger, and basis risk. State mock assets and trusted resolver.
- 0:25–0:55: Show A's actual collateral, the lifecycle lock, and a dated quote. Show B's purchase/reservation and separate escrow receipt.
- 0:55–1:35: Inspect a labeled fixture's raw download, canonical hashes, calculation, and authority. Show evidence committed, outcome finalized, and policy settled as distinct operations.
- 1:35–2:05: Show all three outcomes and the completed 850 redemption from 1,000 collateral; INVALID refunded its premium.
- 2:05–2:35: Compare A's 25 and C's 30 premiums against identical terms. Show B choosing C and the two vault reservations proving isolation.
- 2:35–3:00: Show live ERA5 capture timing, preliminary-data freeze, the 14-day rule, and the independent archive. Close with the customer/capital validation that remains unproven.

## Thirty-second pitch

AEGIS is a testnet prototype for fully collateralized rainfall cover. An outdoor organizer chooses a fixed payout and an underwriter's quote. The chosen vault reserves the full claim, while the premium stays in separate escrow. Archived weather evidence fixes the result, and anyone can finalize and settle it. Competing vaults show different premiums for the same terms. V1 trusts its capture service and resolver, uses mock assets, and still needs paid-demand and actuarial validation.

## Reset and evidence audit

Local: rerun `npm run demo` while the existing loopback Anvil is running; restart the evidence server for the new manager; import the new local manifest. Existing contracts/records are retained. Public: finish existing liabilities and create a new epoch; never reset or rewrite an event. To refresh expired judge quotes, revoke unused quotes where appropriate and publish new ones before the fixed cutoff. A new observation date requires a new event specification and registration.

Use the standalone verification command in `DEPLOYMENT.md`. Remove/stop the local frontend and request a stored object directly from port 8787: it must remain available. A public frontend redeployment cannot delete the independently bound evidence bucket/catalog. Infrastructure-level deletion and outages remain a trust risk and are disclosed.

## Real historical ERA5 replay

Run `npm run weather:discover` to inspect Pune and Mumbai candidates, then `npm run demo:historical` for real Pune YES/NO provider bytes and a complete authenticated oracle CLI + local settlement demonstration. Receipts and content-addressed evidence remain in `.local/historical-replay/`; these are LOCAL receipts. For public testnet: prepare `--mode historical-replay --date 2026-07-04`, import the reviewed bundle in Operator, register and publish with Wallet A, fund a replay vault, publish a 200/25 quote, purchase with Wallet B, and run `oracle:resolve --event <ID> --bundle <file>` in the authorized signer terminal. Inspect Resolution evidence/hash/rainfall and Portfolio payout. Repeat with June 1 for NO. Do not describe historical policies as future insurance.
