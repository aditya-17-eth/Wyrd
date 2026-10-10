// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AegisTypes as T} from "./AegisTypes.sol";

contract AegisUnderwritingVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum Phase { Funding, Underwriting, RunOff, Closed }
    error Unauthorized(); error WrongPhase(); error InsufficientCapacity();
    error InvalidAmount(); error SharesNontransferable(); error LiabilitiesOutstanding(); error AssetMismatch();
    IERC20 public immutable asset;
    address public immutable policyManager;
    address public immutable quotingManager;
    uint64 public immutable issuanceDeadline;
    T.Mode public immutable mode;
    Phase public phase;
    uint256 public accountedAssets;
    uint256 public reservedCoverage;
    uint256 public activePolicies;
    uint256 public totalDeposited;
    uint256 public realizedPremiums;
    uint256 public settledPayouts;
    uint256 public totalRedeemed;
    mapping(address => bool) public invited;
    mapping(uint256 => uint256) public policyReservations;
    event Deposited(address indexed underwriter, uint256 assets, uint256 shares);
    event PhaseChanged(Phase phase);
    event Reserved(uint256 indexed policyId, uint256 coverage);
    event LiabilitySettled(uint256 indexed policyId, address indexed buyer, uint256 payout, uint256 premium);
    event Redeemed(address indexed underwriter, uint256 shares, uint256 assets);
    constructor(IERC20 token, address manager, address quoteManager, uint64 deadline, address[] memory underwriters, T.Mode vaultMode)
        ERC20("AEGIS Underwriting Shares", "aSHARE") {
        if (manager == address(0) || quoteManager == address(0) || deadline <= block.timestamp) revert InvalidAmount();
        asset = token; policyManager = manager; quotingManager = quoteManager; issuanceDeadline = deadline; mode = vaultMode;
        for (uint256 i; i < underwriters.length; ++i) invited[underwriters[i]] = true;
    }
    modifier onlyManager() { if (msg.sender != policyManager) revert Unauthorized(); _; }
    function decimals() public pure override returns (uint8) { return 6; }
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) revert SharesNontransferable();
        super._update(from, to, amount);
    }
    function unassignedSurplus() public view returns (uint256) { return asset.balanceOf(address(this)) - accountedAssets; }
    function availableCapacity() public view returns (uint256) { return accountedAssets - reservedCoverage; }
    function deposit(uint256 amount) external nonReentrant {
        if (phase != Phase.Funding) revert WrongPhase();
        if (!invited[msg.sender]) revert Unauthorized();
        if (amount == 0) revert InvalidAmount();
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) != beforeBalance + amount) revert AssetMismatch();
        accountedAssets += amount; totalDeposited += amount; _mint(msg.sender, amount);
        emit Deposited(msg.sender, amount, amount);
    }
    function beginUnderwriting() external {
        if (msg.sender != quotingManager) revert Unauthorized();
        if (phase != Phase.Funding || block.timestamp >= issuanceDeadline || accountedAssets == 0) revert WrongPhase();
        phase = Phase.Underwriting; emit PhaseChanged(phase);
    }
    function endIssuance() external {
        if (msg.sender != quotingManager && block.timestamp < issuanceDeadline) revert Unauthorized();
        if (phase != Phase.Funding && phase != Phase.Underwriting) revert WrongPhase();
        phase = Phase.RunOff; emit PhaseChanged(phase);
    }
    function closeEpoch() external {
        if (phase != Phase.RunOff) revert WrongPhase();
        if (activePolicies != 0 || reservedCoverage != 0) revert LiabilitiesOutstanding();
        phase = Phase.Closed; emit PhaseChanged(phase);
    }
    function reserve(uint256 policyId, uint256 coverage) external onlyManager {
        if (phase != Phase.Underwriting || block.timestamp >= issuanceDeadline) revert WrongPhase();
        if (coverage == 0 || policyReservations[policyId] != 0) revert InvalidAmount();
        if (coverage > availableCapacity()) revert InsufficientCapacity();
        policyReservations[policyId] = coverage; reservedCoverage += coverage; ++activePolicies;
        emit Reserved(policyId, coverage);
    }
    function settle(uint256 policyId, address buyer, bool paysClaim, uint256 earnedPremium) external onlyManager nonReentrant {
        uint256 coverage = policyReservations[policyId];
        if (coverage == 0) revert InvalidAmount();
        delete policyReservations[policyId]; reservedCoverage -= coverage; --activePolicies;
        if (earnedPremium != 0) {
            uint256 beforeBalance = asset.balanceOf(address(this));
            asset.safeTransferFrom(policyManager, address(this), earnedPremium);
            if (asset.balanceOf(address(this)) != beforeBalance + earnedPremium) revert AssetMismatch();
            accountedAssets += earnedPremium; realizedPremiums += earnedPremium;
        }
        uint256 payout = paysClaim ? coverage : 0;
        if (payout != 0) { accountedAssets -= payout; settledPayouts += payout; asset.safeTransfer(buyer, payout); }
        if (accountedAssets < reservedCoverage) revert InsufficientCapacity();
        emit LiabilitySettled(policyId, buyer, payout, earnedPremium);
    }
    function previewRedeem(uint256 shares) public view returns (uint256) {
        if (totalSupply() == 0) return 0;
        return Math.mulDiv(shares, accountedAssets, totalSupply());
    }
    function redeem(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (phase != Phase.Closed) revert WrongPhase();
        if (shares == 0 || shares > balanceOf(msg.sender)) revert InvalidAmount();
        assets = previewRedeem(shares);
        _burn(msg.sender, shares); accountedAssets -= assets; totalRedeemed += assets;
        if (assets != 0) asset.safeTransfer(msg.sender, assets);
        emit Redeemed(msg.sender, shares, assets);
    }
}
