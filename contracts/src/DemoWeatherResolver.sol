// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {AegisTypes as T} from "./AegisTypes.sol";
import {IResolutionAdapter} from "./interfaces/IResolutionAdapter.sol";

/// @notice Trusted evidence authority. No truth/dispute guarantees or arbitrary invalidation.
contract DemoWeatherResolver is IResolutionAdapter {
    error Unauthorized(); error InvalidEvidence(); error WrongState(); error WrongBinding(); error TimeBoundary();
    address public immutable policyManager;
    address public immutable authority;
    mapping(bytes32 => T.Resolution) private resolutions;
    mapping(bytes32 => T.EventTerms) private termsByRequest;
    mapping(bytes32 => bool) public usedAttestations;
    event ResolutionRequested(bytes32 indexed requestId, uint256 indexed eventId, bytes32 specHash, T.Mode mode);
    event EvidenceCommitted(bytes32 indexed requestId, bytes32 manifestHash, bytes32 responseHash, uint256 rainfallMilliMm, uint64 capturedAt, string evidenceURI);
    event OutcomeFinalized(bytes32 indexed requestId, T.Outcome outcome, uint64 finalizedAt, bytes32 evidenceHash, string reason);
    constructor(address manager, address resolverAuthority) {
        if (manager == address(0) || resolverAuthority == address(0)) revert Unauthorized();
        policyManager = manager; authority = resolverAuthority;
    }
    function registerRequest(uint256 eventId, T.EventTerms calldata terms) external returns (bytes32 id) {
        if (msg.sender != policyManager) revert Unauthorized();
        id = keccak256(abi.encode(block.chainid, address(this), policyManager, eventId, terms.specHash));
        if (resolutions[id].status != T.ResolutionStatus.None) revert WrongState();
        termsByRequest[id] = terms;
        T.Resolution storage r = resolutions[id]; r.eventId = eventId; r.specHash = terms.specHash;
        r.sourceConfigHash = terms.sourceConfigHash; r.status = T.ResolutionStatus.Open;
        emit ResolutionRequested(id, eventId, terms.specHash, terms.mode);
    }
    function getResolution(bytes32 id) external view returns (T.Resolution memory) { return resolutions[id]; }
    function commitEvidence(bytes32 id, bytes32 specHash, bytes32 sourceConfigHash, bytes32 manifestHash,
        bytes32 responseHash, uint256 rainfallMilliMm, uint64 capturedAt, uint256 nonce, string calldata uri) external {
        if (msg.sender != authority) revert Unauthorized();
        T.Resolution storage r = resolutions[id]; T.EventTerms storage t = termsByRequest[id];
        if (r.status != T.ResolutionStatus.Open) revert WrongState();
        if (r.specHash != specHash || r.sourceConfigHash != sourceConfigHash) revert WrongBinding();
        if (manifestHash == bytes32(0) || responseHash == bytes32(0) || bytes(uri).length == 0 || bytes(uri).length > 512) revert InvalidEvidence();
        if (capturedAt > block.timestamp || capturedAt == 0 || rainfallMilliMm > 10_000_000) revert InvalidEvidence();
        if (t.mode == T.Mode.Live) {
            if (block.timestamp < t.captureEligibleAt || block.timestamp >= t.resolutionDeadline || capturedAt < t.captureEligibleAt) revert TimeBoundary();
        } else {
            if (t.fixtureOutcome == T.Outcome.Invalid || manifestHash != t.fixtureManifestHash || responseHash != t.fixtureResponseHash || rainfallMilliMm != t.fixtureRainfallMilliMm) revert InvalidEvidence();
        }
        bytes32 attestation = keccak256(abi.encode(block.chainid, address(this), id, specHash, nonce));
        if (usedAttestations[attestation]) revert InvalidEvidence();
        usedAttestations[attestation] = true;
        r.status = T.ResolutionStatus.EvidenceCommitted; r.manifestHash = manifestHash; r.responseHash = responseHash;
        r.rainfallMilliMm = rainfallMilliMm; r.capturedAt = capturedAt; r.committedAt = uint64(block.timestamp); r.evidenceURI = uri;
        emit EvidenceCommitted(id, manifestHash, responseHash, rainfallMilliMm, capturedAt, uri);
    }
    function finalize(bytes32 id) external {
        T.Resolution storage r = resolutions[id];
        if (r.status != T.ResolutionStatus.EvidenceCommitted) revert WrongState();
        bool yes = r.rainfallMilliMm >= termsByRequest[id].thresholdMilliMm;
        r.outcome = yes ? T.Outcome.Yes : T.Outcome.No;
        r.status = yes ? T.ResolutionStatus.FinalYes : T.ResolutionStatus.FinalNo;
        r.finalizedAt = uint64(block.timestamp);
        emit OutcomeFinalized(id, r.outcome, r.finalizedAt, r.manifestHash, "Committed trusted evidence; no challenge window");
    }
    function timeoutEvidenceHash(bytes32 id) public view returns (bytes32) {
        return keccak256(abi.encode("AEGIS_TIMEOUT_V1", block.chainid, address(this), id, resolutions[id].specHash, termsByRequest[id].resolutionDeadline));
    }
    function finalizeTimeoutInvalid(bytes32 id, string calldata evidenceURI) external {
        T.Resolution storage r = resolutions[id]; T.EventTerms storage t = termsByRequest[id];
        if (r.status != T.ResolutionStatus.Open || t.mode != T.Mode.Live) revert WrongState();
        if (block.timestamp < t.resolutionDeadline) revert TimeBoundary();
        if (bytes(evidenceURI).length == 0 || bytes(evidenceURI).length > 512) revert InvalidEvidence();
        r.manifestHash = timeoutEvidenceHash(id); r.evidenceURI = evidenceURI;
        r.status = T.ResolutionStatus.FinalInvalid; r.outcome = T.Outcome.Invalid; r.finalizedAt = uint64(block.timestamp);
        emit OutcomeFinalized(id, r.outcome, r.finalizedAt, r.manifestHash, "No valid evidence committed by deadline");
    }
    function finalizeSyntheticInvalid(bytes32 id, string calldata evidenceURI) external {
        if (msg.sender != authority) revert Unauthorized();
        T.Resolution storage r = resolutions[id]; T.EventTerms storage t = termsByRequest[id];
        if (r.status != T.ResolutionStatus.Open || t.mode != T.Mode.Synthetic || t.fixtureOutcome != T.Outcome.Invalid) revert WrongState();
        if (bytes(evidenceURI).length == 0 || bytes(evidenceURI).length > 512) revert InvalidEvidence();
        r.manifestHash = t.fixtureManifestHash; r.responseHash = t.fixtureResponseHash; r.evidenceURI = evidenceURI;
        r.status = T.ResolutionStatus.FinalInvalid; r.outcome = T.Outcome.Invalid; r.finalizedAt = uint64(block.timestamp);
        emit OutcomeFinalized(id, r.outcome, r.finalizedAt, r.manifestHash, "PRECOMMITTED SYNTHETIC INVALID FIXTURE");
    }
}
