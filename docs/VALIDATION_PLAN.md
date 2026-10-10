# Demand and underwriting validation

All targets and milestones below are proposed research. No customer, interview, paid sale, or commercial capital commitment has occurred during this build.

## Ten potential underwriting interview categories

1. Licensed parametric insurers.
2. Reinsurers with weather exposure teams.
3. Specialty event-insurance underwriters.
4. Insurance-linked securities fund managers.
5. Weather-risk trading firms.
6. Licensed insurance brokers arranging delegated underwriting.
7. Event operators with captive or self-insurance programs.
8. Cooperative risk-pooling organizations.
9. Family offices considering fully collateralized risk assets.
10. Institutional digital-asset treasury managers with an approved risk mandate.

These categories do not imply that unlicensed entities can legally issue insurance. Any paid pilot requires qualified legal review and an authorized delivery structure.

## Ten buyer questions

1. Which rain disruptions occurred at your last five outdoor events, and what did each cost?
2. What do you do today to reduce or finance those losses?
3. Who approves spending on cancellation protection, and when?
4. Which specific costs would a fixed payout need to cover?
5. Would a grid-based trigger be useful when it differs from conditions at your venue?
6. How would a payout after five to fourteen days affect your cash flow?
7. What premium would you actually pay for a stated payout, date, and threshold?
8. Would you choose a cheaper unknown underwriter or a more expensive known one, and why?
9. Which wallet, currency, evidence, and refund requirements would prevent a purchase?
10. Will you agree to a dated pilot offer, with its limitations, rather than only express interest?

## Paid-demand experiment and abandonment gates

Conduct 20 organizer interviews and 10 capital-provider interviews, documenting existing alternatives, losses, budgets, and reasons for refusal. Present identical dated terms with the trigger, basis risk, payment delay, provider trust, and full collateral requirement. Collect consented intent documents; do not describe them as sales. Have an independent actuary assess price adequacy and a qualified professional assess the legal structure before collecting real premiums.

Proceed to an authorized paid pilot only if at least five organizers accept a concrete priced offer and at least two independent capital providers commit adequate collateral on terms they have reviewed. Track offer-to-purchase conversion, actual customer acquisition cost, premium adequacy, withdrawal opportunity cost, dispute/support load, and retained demand after basis-risk explanation. Require actual paid purchases for the paid-demand milestone; test tokens and refundable waitlist deposits are not proof of insured demand.

Abandon or materially redesign if, after those interviews and a four-week concrete-offer experiment, fewer than three organizers will pay a viable quoted price, no two independent providers will collateralize it, or the legal delivery model is unavailable. Redesign the index if repeated venue-versus-grid mismatches make the protection unacceptable. Do not respond to refusal by increasing simulated TVL or presenting testnet activity as demand.

## PricingReference architecture

`web/lib/probability-reference.ts` defines a read-only, spec-bound reference interface. V1 returns `Pricing reference unavailable`, preserving the manually quoted premium. A future adapter may supply historical frequency or a valid-member ensemble proportion for exactly the quoted day/window/threshold. Every valid member must cover the full window with compatible units and timestamps; missing members must be reported and incompatible datasets rejected. Record model, issue time, sample denominator, uncertainty, and calibration status. Label a raw proportion as an uncalibrated ensemble estimate. This information cannot change event terms, quote premiums, reservations, or settlement evidence.

Reference documentation: [ensemble API](https://open-meteo.com/en/docs/ensemble-api), [historical API](https://open-meteo.com/en/docs/historical-weather-api), [API terms](https://open-meteo.com/en/terms). Commercial use and data licensing must be assessed before a paid pilot.
