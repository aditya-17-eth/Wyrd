# Oracle trust and evidence transparency

The designated Wallet A resolver is trusted. Capturing data and committing the result are distinct actions; the evidence service has no private signing key. Commitment is not finalization. Anyone may finalize the deterministic YES/NO comparison after a commitment, and anyone may settle a finalized policy.

The archive independently preserves source/query, raw bytes, HTTP information, timestamps, validator version, coordinates, units, date, parsed reading, comparison, errors, and event/network/adapter bindings. Failed attempts are publicly inspectable. First-valid selection is frozen. Verification recomputes hashes and extraction from archived bytes rather than fetch today's revised reading. Frontend rebuild/removal leaves the archive intact.

Normal manifests use canonical JSON Keccak-256; raw response hashes use exact stored response-body bytes. Transport decompression is performed by fetch before archiving. Timeout evidence is deterministic ABI-encoded `AEGIS_TIMEOUT_V1`, chain ID, adapter, request ID, spec hash, and deadline; its bytes are independently archived. That digest proves a binding, not weather unavailability. Inspect the resolver's transaction for the enforced Open state and deadline.

No live administrator-selected INVALID action exists. At/after day 14, an Open live request permits permissionless timeout INVALID. EvidenceCommitted or finalized states permanently prohibit it. Only a designated, precommitted synthetic INVALID fixture permits immediate synthetic invalidation. There is no dispute or challenge mechanism, UMA security, or trustless resolution claim.

Future adapters require verified native deployments, explicit bonds/liveness/dispute assumptions, secure bridge analysis where relevant, and compatibility tests against existing immutable policy bindings. Existing policies must never silently switch adapters.
