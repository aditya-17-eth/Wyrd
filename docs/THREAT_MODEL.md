# Threat model

Protected assets are mock collateral, buyer premium escrow, immutable policy terms, and evidence commitments. Expected adversaries include late buyers, malicious callers, replaying clients, unavailable RPC/data/storage, dishonest managers, and a compromised trusted resolver.

Controls: onchain cutoff/lead time/expiry; single-use quote IDs; aggregate per-event/per-buyer limits; full claim reservations; strict vault modes/phases; fixed manager-created vault code; immutable adapters; authority-only commitments; one-way finality; permissionless finalization/settlement; reentrancy guards; SafeERC20 and exact transfer accounting; no owner sweep/cancellation; append-only content-addressed application storage; origin/payload-bound signatures with one-use nonces; provider URL allowlisting; bounded responses and timeouts.

Residual risks: the trusted authority can lie or withhold evidence, the capture service can distort provenance or availability, upstream reanalysis can be preliminary, and grid readings can differ from venue loss. Infrastructure administrators can delete external storage even though application APIs cannot. Hashes detect changed bytes but cannot recover deleted data or prove an honest source. Content availability must be monitored/exported operationally before production use.

An evidence commitment permanently blocks INVALID. A no-commitment timeout can still refund premiums despite an offchain valid snapshot if the authority withheld commitment. This limitation is explicit rather than represented as independent dispute resolution. No production audit, regulator approval, solvency under nonstandard tokens, or factual oracle guarantee is claimed.
