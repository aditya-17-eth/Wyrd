// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AegisTypes as T} from "./AegisTypes.sol";
import {AegisUnderwritingVault} from "./AegisUnderwritingVault.sol";
import {IResolutionAdapter} from "./interfaces/IResolutionAdapter.sol";

contract AegisPolicyManager is ReentrancyGuard {
    using SafeERC20 for IERC20;
    error Unauthorized(); error InvalidTerms(); error AlreadyInitialized(); error InvalidQuote();
    error PurchaseClosed(); error ExposureLimit(); error Unresolved(); error AlreadySettled(); error AssetMismatch();
    enum QuoteStatus { None, Open, Consumed, Revoked }
    uint256 public constant MAX_EVENT_COVERAGE = 1000e6;
    uint256 public constant MAX_BUYER_COVERAGE = 200e6;
    struct Quote { uint256 eventId; uint256 vaultId; uint256 coverage; uint256 premium; uint64 expiry; QuoteStatus status; bytes32 specHash; }
    struct Policy { address buyer; uint256 quoteId; uint256 eventId; uint256 vaultId; uint256 coverage; uint256 premium; bytes32 specHash; bytes32 termsHash; address adapter; bytes32 requestId; bool settled; T.Outcome outcome; uint256 payout; }
    IERC20 public immutable asset;
    address public immutable administrator;
    IResolutionAdapter public adapter;
    bool public initialized;
    uint256 public eventCount; uint256 public vaultCount; uint256 public quoteCount; uint256 public policyCount;
    uint256 public premiumEscrow; uint256 public totalPremiumsReceived; uint256 public totalPremiumsEarned; uint256 public totalPremiumsRefunded;
    mapping(uint256 => T.EventTerms) private eventsById;
    mapping(bytes32 => bool) public registeredHashes;
    mapping(uint256 => bytes32) public requestIds;
    mapping(uint256 => AegisUnderwritingVault) public vaults;
    mapping(uint256 => Quote) public quotes;
    mapping(uint256 => Policy) private policiesById;
    mapping(uint256 => uint256) public eventExposure;
    mapping(uint256 => mapping(address => uint256)) public buyerCoveragePurchased;
    event VaultCreated(uint256 indexed vaultId, address indexed vault, address indexed quotingManager);
    event EventRegistered(uint256 indexed eventId, bytes32 specHash, bytes32 requestId, T.Mode mode, string specificationURI);
    event QuotePublished(uint256 indexed quoteId, uint256 indexed eventId, uint256 indexed vaultId, uint256 coverage, uint256 premium, uint64 expiry);
    event QuoteRevoked(uint256 indexed quoteId);
    event PolicyPurchased(uint256 indexed policyId, address indexed buyer, uint256 indexed quoteId, uint256 vaultId, uint256 coverage, uint256 premium, bytes32 termsHash);
    event PolicySettled(uint256 indexed policyId, address indexed buyer, T.Outcome outcome, uint256 payout, uint256 refund);
    constructor(IERC20 token, address admin) {
        if (block.chainid != 10143 && block.chainid != 31337) revert InvalidTerms();
        if (admin == address(0) || IERC20Metadata(address(token)).decimals() != 6) revert InvalidTerms();
        asset = token; administrator = admin;
    }
    modifier onlyAdmin() { if (msg.sender != administrator) revert Unauthorized(); _; }
    function initializeAdapter(IResolutionAdapter resolver) external onlyAdmin {
        if (initialized) revert AlreadyInitialized();
        if (address(resolver).code.length == 0 || resolver.policyManager() != address(this) || resolver.authority() == address(0)) revert InvalidTerms();
        adapter = resolver; initialized = true;
    }
    function createVault(address quotingManager, uint64 deadline, address[] calldata underwriters, T.Mode mode) external onlyAdmin returns (uint256 id) {
        if (!initialized) revert InvalidTerms();
        AegisUnderwritingVault vault = new AegisUnderwritingVault(asset, address(this), quotingManager, deadline, underwriters, mode);
        id = ++vaultCount; vaults[id] = vault;
        asset.forceApprove(address(vault), type(uint256).max);
        emit VaultCreated(id, address(vault), quotingManager);
    }
    function registerEvent(T.EventTerms calldata t) external onlyAdmin returns (uint256 id) {
        if (!initialized || t.specHash == bytes32(0) || t.sourceConfigHash == bytes32(0) || registeredHashes[t.specHash] || bytes(t.specificationURI).length == 0 || bytes(t.specificationURI).length > 512) revert InvalidTerms();
        if (t.minimumLeadTime < 1 days || t.observationStart <= block.timestamp || t.observationEnd != uint256(t.observationStart) + 1 days || t.observationStart < t.minimumLeadTime || t.purchaseCutoff > t.observationStart - t.minimumLeadTime || t.purchaseCutoff <= block.timestamp) revert InvalidTerms();
        if (t.captureEligibleAt != uint256(t.observationEnd) + 5 days || t.resolutionDeadline != uint256(t.observationEnd) + 14 days || t.thresholdMilliMm == 0 || t.maxBuyerCoverage == 0 || t.maxEventCoverage < t.maxBuyerCoverage || t.maxEventCoverage > MAX_EVENT_COVERAGE || t.maxBuyerCoverage > MAX_BUYER_COVERAGE) revert InvalidTerms();
        if (t.mode == T.Mode.Synthetic) {
            if (t.fixtureManifestHash == bytes32(0) || t.fixtureResponseHash == bytes32(0) || t.fixtureOutcome == T.Outcome.None) revert InvalidTerms();
            if (t.fixtureOutcome != T.Outcome.Invalid && (t.fixtureRainfallMilliMm >= t.thresholdMilliMm) != (t.fixtureOutcome == T.Outcome.Yes)) revert InvalidTerms();
        } else if (t.fixtureManifestHash != bytes32(0) || t.fixtureResponseHash != bytes32(0) || t.fixtureRainfallMilliMm != 0 || t.fixtureOutcome != T.Outcome.None) revert InvalidTerms();
        id = ++eventCount; eventsById[id] = t; registeredHashes[t.specHash] = true;
        requestIds[id] = adapter.registerRequest(id, t);
        emit EventRegistered(id, t.specHash, requestIds[id], t.mode, t.specificationURI);
    }
    function getEvent(uint256 id) external view returns (T.EventTerms memory) { return eventsById[id]; }
    function getPolicy(uint256 id) external view returns (Policy memory) { return policiesById[id]; }
    function unassignedSurplus() external view returns (uint256) { return asset.balanceOf(address(this)) - premiumEscrow; }
    function publishQuote(uint256 eventId, uint256 vaultId, uint256 coverage, uint256 premium, uint64 expiry) external returns (uint256 id) {
        AegisUnderwritingVault vault = vaults[vaultId]; T.EventTerms storage t = eventsById[eventId];
        if (address(vault) == address(0) || msg.sender != vault.quotingManager()) revert Unauthorized();
        if (t.specHash == bytes32(0) || coverage == 0 || coverage > t.maxBuyerCoverage || premium == 0 || vault.phase() != AegisUnderwritingVault.Phase.Underwriting || t.mode != vault.mode()) revert InvalidQuote();
        if (block.timestamp >= t.purchaseCutoff || expiry <= block.timestamp || expiry > block.timestamp + 1 days || expiry > t.purchaseCutoff || expiry > vault.issuanceDeadline() || adapter.getResolution(requestIds[eventId]).status != T.ResolutionStatus.Open) revert PurchaseClosed();
        id = ++quoteCount; quotes[id] = Quote(eventId, vaultId, coverage, premium, expiry, QuoteStatus.Open, t.specHash);
        emit QuotePublished(id, eventId, vaultId, coverage, premium, expiry);
    }
    function revokeQuote(uint256 id) external {
        Quote storage q = quotes[id];
        if (q.status != QuoteStatus.Open) revert InvalidQuote();
        if (msg.sender != vaults[q.vaultId].quotingManager()) revert Unauthorized();
        q.status = QuoteStatus.Revoked; emit QuoteRevoked(id);
    }
    function purchase(uint256 quoteId) external nonReentrant returns (uint256 id) {
        Quote storage q = quotes[quoteId]; T.EventTerms storage t = eventsById[q.eventId];
        if (q.status != QuoteStatus.Open || q.specHash != t.specHash) revert InvalidQuote();
        if (block.timestamp >= q.expiry || block.timestamp >= t.purchaseCutoff || block.timestamp >= t.observationStart || adapter.getResolution(requestIds[q.eventId]).status != T.ResolutionStatus.Open) revert PurchaseClosed();
        if (eventExposure[q.eventId] + q.coverage > t.maxEventCoverage || buyerCoveragePurchased[q.eventId][msg.sender] + q.coverage > t.maxBuyerCoverage) revert ExposureLimit();
        id = ++policyCount; q.status = QuoteStatus.Consumed;
        eventExposure[q.eventId] += q.coverage; buyerCoveragePurchased[q.eventId][msg.sender] += q.coverage;
        bytes32 termsHash = keccak256(abi.encode(block.chainid, address(this), msg.sender, quoteId, q.specHash, address(vaults[q.vaultId]), q.coverage, q.premium, address(adapter), requestIds[q.eventId]));
        policiesById[id] = Policy(msg.sender, quoteId, q.eventId, q.vaultId, q.coverage, q.premium, q.specHash, termsHash, address(adapter), requestIds[q.eventId], false, T.Outcome.None, 0);
        vaults[q.vaultId].reserve(id, q.coverage);
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), q.premium);
        if (asset.balanceOf(address(this)) != beforeBalance + q.premium) revert AssetMismatch();
        premiumEscrow += q.premium; totalPremiumsReceived += q.premium;
        emit PolicyPurchased(id, msg.sender, quoteId, q.vaultId, q.coverage, q.premium, termsHash);
    }
    function settlePolicy(uint256 id) external nonReentrant {
        Policy storage p = policiesById[id];
        if (p.buyer == address(0)) revert InvalidTerms();
        if (p.settled) revert AlreadySettled();
        T.Resolution memory r = IResolutionAdapter(p.adapter).getResolution(p.requestId);
        if (r.eventId != p.eventId || r.specHash != p.specHash) revert InvalidTerms();
        if (r.status != T.ResolutionStatus.FinalYes && r.status != T.ResolutionStatus.FinalNo && r.status != T.ResolutionStatus.FinalInvalid) revert Unresolved();
        p.settled = true; p.outcome = r.outcome; p.payout = r.outcome == T.Outcome.Yes ? p.coverage : 0;
        premiumEscrow -= p.premium; eventExposure[p.eventId] -= p.coverage;
        bool invalid = r.outcome == T.Outcome.Invalid;
        if (invalid) { totalPremiumsRefunded += p.premium; } else { totalPremiumsEarned += p.premium; }
        vaults[p.vaultId].settle(id, p.buyer, r.outcome == T.Outcome.Yes, invalid ? 0 : p.premium);
        if (invalid) asset.safeTransfer(p.buyer, p.premium);
        emit PolicySettled(id, p.buyer, r.outcome, p.payout, invalid ? p.premium : 0);
    }
}
