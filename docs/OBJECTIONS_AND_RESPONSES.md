# Ten objections and the implemented response

## 1. Slow resolution

V1 waits until five days after the observation ends to capture ERA5, and requires a valid commitment before day 14. An authorized commitment fixes evidence permanently; anyone can then finalize YES/NO and settle. This is a trusted authority path with transparent records, no dispute window, and no instant decentralized truth guarantee. An optimistic dispute system would add challenge time and economic assumptions. An Open live request without commitment at day 14 becomes permissionlessly INVALID, returning its premium. A committed request never becomes INVALID.

## 2. UMA deployment

UMA's [published network addresses](https://docs.uma.xyz/resources/network-addresses) were checked on 10 October 2026; Monad was not listed. No UMA address was guessed and no native UMA integration is claimed. `IResolutionAdapter` defines the binding and final-result interface; `DemoWeatherResolver` implements the trusted MVP. A future adapter needs verified infrastructure, dispute incentives, and a documented bridge model if it resolves on another chain.

## 3. Missing prediction-market liquidity

The 25 and 30 mUSDC premiums are manager-selected, explicitly unvalidated offers. No liquid market price or 12% probability is invented. The read-only ProbabilityReference interface currently returns unavailable. [Open-Meteo ensemble forecasts](https://open-meteo.com/en/docs/ensemble-api) and [historical weather](https://open-meteo.com/en/docs/historical-weather-api) are potential inputs. An actuary, weather specialist, and prospective capital provider must validate out-of-sample calibration, expenses, tail losses, and required capital return. Forecasts cannot serve as observed settlement evidence.

## 4. Adverse selection

The dated specification fixes a purchase cutoff at least 24 hours before observation. Each quote expires within 24 hours and no later than the cutoff or vault issuance deadline. The contracts enforce buyer and event limits across participating vaults. Purchase requires an Open resolution and fully available collateral. Buyers can still have better forecasts, venue information, or private loss information. A 24-hour cutoff reduces late selection; it does not establish fair pricing.

## 5. Cold-start underwriters

Funding is by invited wallets in fixed epochs; deposits stop when underwriting starts. Actual onchain amounts are shown without invented TVL, customers, or APY. Underwriters need premium compensation above expected claims, operating cost, capital opportunity cost, uncertainty, and illiquidity. Full collateralization may make that price unattractive. Validation requires identifiable willing capital providers and paid buyers at mutually acceptable terms; proposed gates are in `VALIDATION_PLAN.md`.

## 6. Correlated losses

Each vault reserves every policy's maximum payout. For 1,000 mUSDC collateral, simultaneous 200/300/500 claims reserve the full 1,000; further exposure is rejected. The lifecycle test executes these claims, while reconciliation invariants compare every unsettled policy with reservations and escrow. The second vault cannot subsidize the first: its assets, shares, reservations, and manager are separate. Full collateralization addresses promised payout solvency, not capital efficiency or economic profitability.

## 7. Basis risk and oracle trust

The trigger concerns a gridded ERA5 rainfall value, not actual event cancellation or a venue gauge. A buyer can suffer a loss without a payout, or receive a payout without matching damage. Provider query, governing cell, calendar day, threshold, preliminary-data policy, and snapshot rule are hash-bound. Archived bytes and manifests are verifiable. The capture service and resolver remain trusted for authentic source access and timely commitment; withholding can cause timeout refunds. An infrastructure owner can impair archive availability despite no application deletion API.

## 8. Prior art

[Etherisc's whitepaper](https://docs.etherisc.com/learn/whitepaper-en) describes decentralized insurance infrastructure. [AXA's official innovation discussion](https://www.axa.com/news/bringing-innovation-to-the-next-level) describes Fizzy's parametric flight-delay work; we do not infer its current availability or repeat an unverified shutdown claim. [Descartes' event-cancellation case study](https://descartesunderwriting.com/case-studies/extreme-weather-climate-change-and-innovation-in-event-cancellation-insurance) describes weather-related parametric insurance. Fixed triggers, automated payouts, and weather cover are established ideas. AEGIS's visible competing vault offers and inspectable evidence are prototype choices. Whether open underwriting improves customer outcomes is unproven.

## 9. Why Monad

Monad offers an EVM environment and fast block/finality targets useful for approvals, reservations, and frequent portfolio reads. [Official execution-state guidance](https://docs.monad.xyz/developer-essentials/reserve-balance) and [gas rules](https://docs.monad.xyz/developer-essentials/gas-pricing) inform simulations, gas limits, and confirmed reads. Weather-data latency still dominates resolution. The app could be implemented on Base or Arbitrum. `.local/demo-results.json` records 55 actual local Anvil transactions with gas and timing; those are local measurements, not real Monad performance claims. Real-network deployment receipts, fees, and observation timing belong in `deployments/` only after broadcast and RPC confirmation.

## 10. Scope and customer demand

The buyer hypothesis is a Pune outdoor event organizer concerned about disruption from heavy rain. Candidate alternatives to test in interviews include cancellation terms, cash reserves, venue changes, rain infrastructure, and conventional event insurance. Their actual use has not been measured. V1 offers one rainfall trigger with mock assets, external wallets, transparent evidence, and invited competing underwriters. UMA, actuarial pricing, generalized products, indexers, leverage, yield strategies, and production insurance are excluded. The next commercial evidence is buyer interviews, informed acceptance of basis risk, willingness to pay, and capital commitments—not transaction counts from a testnet demo.
