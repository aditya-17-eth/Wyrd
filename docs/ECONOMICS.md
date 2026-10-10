# Economics and reconciliation

Reserve the entire maximum payout of every unsettled policy. Across correlated policies, add maximum claims without diversification credit. Vault assets must cover reservations even if all policies trigger simultaneously. Premiums held by the manager are refundable escrow and cannot back underwriting capacity.

Per-vault invariants:

```
accountedAssets >= reservedCoverage == sum(unsettled policy coverage in this vault)
actualTokenBalance == accountedAssets + unassignedSurplus
accountedAssets == deposits + earnedPremiums - claims - redemptions
```

Manager invariants:

```
actualTokenBalance == outstandingPremiumEscrow + unassignedSurplus
receivedPremiums == escrow + earnedPremiums + refundedPremiums
```

Unexpected transfers mint no shares, earn no premiums, increase no capacity, and remain unassigned surplus. There is no sweep function. Deposits mint shares at 1:1 only before underwriting. Redemption floors proportional amounts; the last share holder receives all remaining accounted capital, so prior rounding dust is conserved. Zero-valued rounded shares can be burned without pretending a payout occurred.

YES: vault earns the premium and pays coverage. NO: vault earns the premium and pays zero. INVALID: manager refunds premium, vault earns zero and pays zero. All outcomes release exactly one policy reservation. Reverts roll back purchase/settlement accounting and transfers atomically.

Example local demo: deposit 1,000; sell three 200/25 policies; reserve 600 and escrow 75. YES leaves 825 accounted assets; NO increases to 850; INVALID refunds 25 and leaves 850. After all liabilities settle and epoch closes, redeem 850. This is a demonstrated loss of 150, not an APY claim. A second vault's 200/30 YES policy would leave 830 after settlement, independently of the first vault.

Underwriters require premium income above expected claims, operating costs, capital lockup, and opportunity cost, with conservative correlated exposure limits. Actual probabilities and willingness to underwrite are unvalidated; open underwriting is a business hypothesis.
