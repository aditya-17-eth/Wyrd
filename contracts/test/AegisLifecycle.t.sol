// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AegisPolicyManager as Manager} from "../src/AegisPolicyManager.sol";
import {AegisUnderwritingVault as Vault} from "../src/AegisUnderwritingVault.sol";
import {DemoWeatherResolver as Resolver} from "../src/DemoWeatherResolver.sol";
import {AegisTypes as T} from "../src/AegisTypes.sol";

contract WrongDecimals is ERC20 { constructor() ERC20("Wrong", "WRONG") {} }
contract CallbackToken is ERC20 {
    address target; bytes callback; bool public attempted; bool public succeeded; bytes4 public failure;
    constructor() ERC20("Callback test token","CALL") {}
    function decimals() public pure override returns(uint8) { return 6; }
    function mint(address to,uint256 amount) external { _mint(to,amount); }
    function arm(address to,bytes memory data) external { target=to; callback=data; attempted=false; succeeded=false; failure=bytes4(0); }
    function _update(address from,address to,uint256 value) internal override {
        if(from!=address(0)&&target!=address(0)) {
            address callTarget=target; target=address(0); attempted=true;
            bytes memory result; (succeeded,result)=callTarget.call(callback);
            if(result.length>=4) failure=bytes4(result);
        }
        super._update(from,to,value);
    }
}

contract AegisLifecycleTest is Test {
    MockUSDC token; Manager manager; Resolver resolver; Vault vault;
    address a = address(0xA); address b = address(0xB); address c = address(0xC);
    uint256 constant U = 1e6;
    uint256 currentVaultId = 1;
    function setUp() public {
        vm.chainId(31337); vm.warp(1_900_000_000);
        token = new MockUSDC(); manager = new Manager(IERC20(address(token)), address(this));
        resolver = new Resolver(address(manager), a); manager.initializeAdapter(resolver);
        address[] memory invited = new address[](2); invited[0] = a; invited[1] = c;
        manager.createVault(a, uint64(block.timestamp + 3 days), invited, T.Mode.Synthetic); vault = manager.vaults(1);
        for (uint256 i; i < 3; ++i) { address who = i == 0 ? a : (i == 1 ? b : c); vm.startPrank(who); token.faucet(); token.approve(address(manager), type(uint256).max); token.approve(address(vault), type(uint256).max); vm.stopPrank(); }
    }
    function terms(T.Mode mode, T.Outcome outcome, uint256 salt) internal view returns (T.EventTerms memory t) {
        t.specHash = keccak256(abi.encode("spec", salt)); t.sourceConfigHash = keccak256("ERA5 exact query v1");
        t.observationStart = uint64(block.timestamp + 3 days); t.observationEnd = t.observationStart + 1 days;
        t.minimumLeadTime = 1 days; t.purchaseCutoff = t.observationStart - 1 days;
        t.captureEligibleAt = t.observationEnd + 5 days; t.resolutionDeadline = t.observationEnd + 14 days;
        t.thresholdMilliMm = 50_000; t.maxEventCoverage = 1000 * U; t.maxBuyerCoverage = 200 * U;
        t.mode = mode; t.specificationURI = "https://evidence.example/spec.json";
        if (mode == T.Mode.Synthetic) {
            t.fixtureManifestHash = keccak256(abi.encode("fixture", salt)); t.fixtureResponseHash = keccak256(abi.encode("response", salt));
            t.fixtureOutcome = outcome; t.fixtureRainfallMilliMm = outcome == T.Outcome.Yes ? 60_000 : 10_000;
        }
    }
    function fund(uint256 amount) internal { vm.prank(a); vault.deposit(amount); vm.prank(a); vault.beginUnderwriting(); }
    function useLiveVault() internal {
        address[] memory invited = new address[](1); invited[0] = a;
        currentVaultId = manager.createVault(a, uint64(block.timestamp + 3 days), invited, T.Mode.Live); vault = manager.vaults(currentVaultId);
        vm.prank(a); token.approve(address(vault), type(uint256).max); fund(1000 * U);
    }
    function issue(uint256 eventId, uint256 coverage, uint256 premium, address buyer) internal returns (uint256 id) {
        vm.prank(a); uint256 q = manager.publishQuote(eventId, currentVaultId, coverage, premium, uint64(block.timestamp + 1 days));
        vm.prank(buyer); return manager.purchase(q);
    }
    function resolve(uint256 eventId) internal {
        T.EventTerms memory t = manager.getEvent(eventId); bytes32 request = manager.requestIds(eventId);
        if (t.fixtureOutcome == T.Outcome.Invalid) { vm.prank(a); resolver.finalizeSyntheticInvalid(request, "https://evidence.example/invalid"); }
        else { vm.prank(a); resolver.commitEvidence(request, t.specHash, t.sourceConfigHash, t.fixtureManifestHash, t.fixtureResponseHash, t.fixtureRainfallMilliMm, uint64(block.timestamp), 1, "https://evidence.example/snapshot"); resolver.finalize(request); }
    }
    function reconcile(Vault v) internal view {
        assertEq(token.balanceOf(address(v)), v.accountedAssets() + v.unassignedSurplus());
        assertEq(v.accountedAssets() + v.settledPayouts() + v.totalRedeemed(), v.totalDeposited() + v.realizedPremiums());
        assertGe(v.accountedAssets(), v.reservedCoverage());
        assertEq(token.balanceOf(address(manager)), manager.premiumEscrow() + manager.unassignedSurplus());
        assertEq(manager.totalPremiumsReceived(), manager.premiumEscrow() + manager.totalPremiumsEarned() + manager.totalPremiumsRefunded());
    }
    function testThreeOutcomesEscrowAndRedeem() public {
        fund(1000 * U);
        uint256 yes = manager.registerEvent(terms(T.Mode.Synthetic, T.Outcome.Yes, 1));
        uint256 no = manager.registerEvent(terms(T.Mode.Synthetic, T.Outcome.No, 2));
        uint256 invalid = manager.registerEvent(terms(T.Mode.Synthetic, T.Outcome.Invalid, 3));
        uint256 p1 = issue(yes, 200 * U, 25 * U, b); uint256 p2 = issue(no, 200 * U, 25 * U, b); uint256 p3 = issue(invalid, 200 * U, 25 * U, b);
        assertEq(vault.reservedCoverage(), 600 * U); assertEq(manager.premiumEscrow(), 75 * U); assertEq(vault.realizedPremiums(), 0);
        resolve(yes); manager.settlePolicy(p1); reconcile(vault); assertEq(vault.accountedAssets(), 825 * U);
        resolve(no); manager.settlePolicy(p2); resolve(invalid); manager.settlePolicy(p3); reconcile(vault);
        assertEq(vault.accountedAssets(), 850 * U); assertEq(token.balanceOf(b), 10_150 * U); assertEq(vault.reservedCoverage(), 0);
        vm.prank(a); vault.endIssuance(); vault.closeEpoch(); vm.prank(a); assertEq(vault.redeem(1000 * U), 850 * U);
        assertEq(vault.totalSupply(), 0); reconcile(vault);
    }
    function testDepositsSharesAndInvitation() public {
        vm.prank(a); vault.deposit(17 * U); assertEq(vault.balanceOf(a), 17 * U); assertEq(vault.decimals(), 6);
        vm.prank(b); vm.expectRevert(Vault.Unauthorized.selector); vault.deposit(U);
        vm.prank(a); vm.expectRevert(Vault.SharesNontransferable.selector); vault.transfer(c, U);
        vm.prank(a); vault.beginUnderwriting(); vm.prank(a); vm.expectRevert(Vault.WrongPhase.selector); vault.deposit(U);
    }
    function testCorrelationAndOvercommit() public {
        fund(1000 * U); uint256 e = manager.registerEvent(terms(T.Mode.Synthetic, T.Outcome.Yes, 1));
        // Claim groups of 200 / 300 / 500, split among buyers to retain the 200 buyer ceiling.
        uint256[6] memory coverage = [200 * U,200 * U,100 * U,200 * U,200 * U,100 * U];
        for(uint256 i;i<6;++i){address buyer=address(uint160(0x100+i));vm.startPrank(buyer);token.faucet();token.approve(address(manager),type(uint256).max);vm.stopPrank();issue(e,coverage[i],U,buyer);}
        assertEq(vault.reservedCoverage(), 1000 * U);
        vm.prank(a); uint256 q = manager.publishQuote(e, 1, U, U, uint64(block.timestamp + 1 days));
        vm.prank(address(0xD)); vm.expectRevert(Manager.ExposureLimit.selector); manager.purchase(q);
        resolve(e); for (uint256 i = 1; i <= 6; ++i) { manager.settlePolicy(i); reconcile(vault); }
    }
    function testInsufficientCollateralAtomicRollback() public {
        fund(100 * U); uint256 e = manager.registerEvent(terms(T.Mode.Synthetic, T.Outcome.Yes, 1));
        vm.prank(a); uint256 q = manager.publishQuote(e, 1, 200 * U, U, uint64(block.timestamp + 1 days));
        vm.prank(b); vm.expectRevert(Vault.InsufficientCapacity.selector); manager.purchase(q);
        assertEq(manager.policyCount(), 0); assertEq(manager.eventExposure(e), 0); assertEq(manager.premiumEscrow(), 0);
    }
    function testUnresolvedDuplicateSettlementAndWithdrawalLock() public {
        fund(1000 * U); uint256 e = manager.registerEvent(terms(T.Mode.Synthetic, T.Outcome.Yes, 1)); uint256 p = issue(e, 200 * U, U, b);
        vm.expectRevert(Manager.Unresolved.selector); manager.settlePolicy(p);
        vm.prank(a); vm.expectRevert(Vault.WrongPhase.selector); vault.redeem(U);
        vm.prank(a); vault.endIssuance(); vm.expectRevert(Vault.LiabilitiesOutstanding.selector); vault.closeEpoch();
        resolve(e); manager.settlePolicy(p); vm.expectRevert(Manager.AlreadySettled.selector); manager.settlePolicy(p);
    }
    function testUnauthorizedProtocolFunctions() public {
        vm.startPrank(b); vm.expectRevert(Manager.Unauthorized.selector); manager.registerEvent(terms(T.Mode.Live, T.Outcome.None, 1));
        vm.expectRevert(Vault.Unauthorized.selector); vault.reserve(99, U);
        vm.expectRevert(Vault.Unauthorized.selector); vault.settle(99, b, true, 0);
        vm.expectRevert(Vault.Unauthorized.selector); vault.beginUnderwriting(); vm.stopPrank();
    }
    function testExpiredQuoteAndOnchainCutoff() public {
        useLiveVault(); T.EventTerms memory t = terms(T.Mode.Live, T.Outcome.None, 1); uint256 e = manager.registerEvent(t);
        vm.prank(a); uint256 q = manager.publishQuote(e, currentVaultId, U, U, uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 1 hours); vm.prank(b); vm.expectRevert(Manager.PurchaseClosed.selector); manager.purchase(q);
        vm.warp(t.purchaseCutoff); vm.prank(a); vm.expectRevert(Manager.PurchaseClosed.selector); manager.publishQuote(e, currentVaultId, U, U, uint64(block.timestamp + 1));
    }
    function testQuoteReplayBuyerLimitAndImmutableTerms() public {
        fund(1000 * U); T.EventTerms memory t = terms(T.Mode.Synthetic, T.Outcome.No, 1); t.maxBuyerCoverage = 200 * U;
        uint256 e = manager.registerEvent(t); uint256 p = issue(e, 200 * U, U, b); uint256 q = manager.getPolicy(p).quoteId;
        vm.prank(b); vm.expectRevert(Manager.InvalidQuote.selector); manager.purchase(q);
        vm.prank(a); uint256 other = manager.publishQuote(e, 1, U, U, uint64(block.timestamp + 1 days));
        vm.prank(b); vm.expectRevert(Manager.ExposureLimit.selector); manager.purchase(other);
        t.thresholdMilliMm = 55_000; vm.expectRevert(Manager.InvalidTerms.selector); manager.registerEvent(t);
        vm.expectRevert(Manager.AlreadyInitialized.selector); manager.initializeAdapter(resolver);
    }
    function testLiveEvidenceTimingBindingAndOneWayFinality() public {
        T.EventTerms memory t = terms(T.Mode.Live, T.Outcome.None, 1); uint256 e = manager.registerEvent(t); bytes32 id = manager.requestIds(e);
        vm.prank(b); vm.expectRevert(Resolver.Unauthorized.selector); resolver.commitEvidence(id,t.specHash,t.sourceConfigHash,bytes32(uint256(1)),bytes32(uint256(2)),50_000,uint64(block.timestamp),1,"ipfs://evidence");
        vm.prank(a); vm.expectRevert(Resolver.TimeBoundary.selector); resolver.commitEvidence(id,t.specHash,t.sourceConfigHash,bytes32(uint256(1)),bytes32(uint256(2)),50_000,uint64(block.timestamp),1,"ipfs://evidence");
        vm.warp(t.captureEligibleAt);
        vm.prank(a); vm.expectRevert(Resolver.WrongBinding.selector); resolver.commitEvidence(id,bytes32(uint256(7)),t.sourceConfigHash,bytes32(uint256(1)),bytes32(uint256(2)),50_000,uint64(block.timestamp),1,"ipfs://evidence");
        vm.prank(a); vm.expectRevert(Resolver.InvalidEvidence.selector); resolver.commitEvidence(id,t.specHash,t.sourceConfigHash,bytes32(0),bytes32(uint256(2)),50_000,uint64(block.timestamp),1,"ipfs://evidence");
        vm.prank(a); resolver.commitEvidence(id,t.specHash,t.sourceConfigHash,bytes32(uint256(1)),bytes32(uint256(2)),50_000,t.captureEligibleAt,1,"ipfs://evidence");
        vm.prank(a); vm.expectRevert(Resolver.WrongState.selector); resolver.commitEvidence(id,t.specHash,t.sourceConfigHash,bytes32(uint256(1)),bytes32(uint256(2)),10_000,uint64(block.timestamp),1,"ipfs://evidence");
        vm.warp(t.resolutionDeadline + 1 days); vm.expectRevert(Resolver.WrongState.selector); resolver.finalizeTimeoutInvalid(id,"ipfs://timeout");
        vm.prank(b); resolver.finalize(id); assertEq(uint256(resolver.getResolution(id).outcome), uint256(T.Outcome.Yes));
        vm.expectRevert(Resolver.WrongState.selector); resolver.finalize(id);
        vm.expectRevert(Resolver.WrongState.selector); resolver.finalizeTimeoutInvalid(id,"ipfs://timeout");
    }
    function testTimeoutOnlyAt14DaysRefundsAndRejectsLateCommit() public {
        useLiveVault(); T.EventTerms memory t = terms(T.Mode.Live, T.Outcome.None, 1); uint256 e = manager.registerEvent(t); uint256 p = issue(e, 200 * U, 25 * U, b); bytes32 id = manager.requestIds(e);
        vm.warp(t.resolutionDeadline - 1); vm.expectRevert(Resolver.TimeBoundary.selector); resolver.finalizeTimeoutInvalid(id,"ipfs://timeout");
        vm.warp(t.resolutionDeadline); vm.prank(a); vm.expectRevert(Resolver.TimeBoundary.selector); resolver.commitEvidence(id,t.specHash,t.sourceConfigHash,bytes32(uint256(1)),bytes32(uint256(2)),50_000,uint64(block.timestamp),1,"ipfs://evidence");
        vm.prank(b); resolver.finalizeTimeoutInvalid(id,"ipfs://timeout"); manager.settlePolicy(p);
        assertEq(token.balanceOf(b),10_000 * U); assertEq(vault.accountedAssets(),1000 * U); reconcile(vault);
    }
    function testSyntheticInvalidCannotInvalidateOtherFixture() public {
        uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.Yes,1));
        bytes32 request = manager.requestIds(e);
        vm.prank(a); vm.expectRevert(Resolver.WrongState.selector); resolver.finalizeSyntheticInvalid(request,"ipfs://invalid");
        vm.expectRevert(Resolver.WrongState.selector); resolver.finalizeTimeoutInvalid(request,"ipfs://invalid");
    }
    function testUnexpectedDepositsNeverBecomeCapacityOrProfit() public {
        vm.prank(a); token.transfer(address(vault), 10 * U); vm.prank(a); token.transfer(address(manager), 13 * U); reconcile(vault);
        fund(1000 * U); assertEq(vault.availableCapacity(),1000 * U);
        uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.No,1)); uint256 p = issue(e,200 * U,25 * U,b);
        vm.prank(c); token.transfer(address(vault),7 * U); vm.prank(c); token.transfer(address(manager),11 * U); reconcile(vault);
        resolve(e); manager.settlePolicy(p); vm.prank(a); vault.endIssuance(); vault.closeEpoch(); uint256 shares = vault.balanceOf(a); vm.prank(a); vault.redeem(shares);
        assertEq(token.balanceOf(address(vault)),17 * U); assertEq(vault.unassignedSurplus(),17 * U); assertEq(manager.unassignedSurplus(),24 * U); reconcile(vault);
    }
    function testFuzzRoundingFinalShareAndDonation(uint64 x, uint64 y, uint64 donation) public {
        uint256 first = bound(x,1,5000 * U); uint256 second = bound(y,1,5000 * U); uint256 surplus = bound(donation,0,1000 * U);
        vm.prank(a); vault.deposit(first); vm.prank(c); vault.deposit(second); vm.prank(b); token.transfer(address(vault),surplus);
        vm.prank(a); vault.beginUnderwriting(); uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.No,1)); uint256 p = issue(e,1,1,b); resolve(e); manager.settlePolicy(p);
        vm.prank(a); vault.endIssuance(); vault.closeEpoch(); uint256 before = vault.accountedAssets(); vm.prank(a); uint256 r1 = vault.redeem(first); vm.prank(c); uint256 r2 = vault.redeem(second);
        assertEq(r1+r2,before); assertEq(vault.accountedAssets(),0); assertEq(token.balanceOf(address(vault)),surplus); reconcile(vault);
    }
    function testNearCompleteCapitalLossPreservesFinalMicroUnit() public {
        fund(200 * U); uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.Yes,1)); uint256 p = issue(e,200 * U,1,b); resolve(e); manager.settlePolicy(p);
        vm.prank(a); vault.endIssuance(); vault.closeEpoch(); vm.prank(a); assertEq(vault.redeem(200 * U),1); reconcile(vault);
    }
    function testZeroValueSmallSharesFinalHolderAndEmptyCapital() public {
        vm.prank(a); vault.deposit(1); vm.prank(c); vault.deposit(200 * U - 1);
        vm.prank(a); vault.beginUnderwriting();
        uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.Yes,1));
        uint256 p = issue(e,200 * U,1,b); resolve(e); manager.settlePolicy(p);
        vm.prank(a); vault.endIssuance(); vault.closeEpoch();
        vm.prank(a); assertEq(vault.redeem(1),0);
        vm.prank(c); assertEq(vault.redeem(200 * U - 1),1);
        assertEq(vault.totalSupply(),0); assertEq(vault.accountedAssets(),0);
        assertEq(vault.previewRedeem(1),0); reconcile(vault);
    }
    function testQuoteMaximumLifetimeAndModeIsolation() public {
        fund(1000 * U); uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.No,1));
        vm.prank(a); vm.expectRevert(Manager.PurchaseClosed.selector);
        manager.publishQuote(e,1,U,U,uint64(block.timestamp+1 days+1));
        vm.prank(a); manager.publishQuote(e,1,U,U,uint64(block.timestamp+1 days));
        uint256 live = manager.registerEvent(terms(T.Mode.Live,T.Outcome.None,2));
        vm.prank(a); vm.expectRevert(Manager.InvalidQuote.selector);
        manager.publishQuote(live,1,U,U,uint64(block.timestamp+1 days));
    }
    function testEventCannotRaiseProtocolExposureCeilings() public {
        T.EventTerms memory t=terms(T.Mode.Live,T.Outcome.None,1);t.maxBuyerCoverage=200 * U+1;
        vm.expectRevert(Manager.InvalidTerms.selector);manager.registerEvent(t);
        t.maxBuyerCoverage=200 * U;t.maxEventCoverage=1000 * U+1;
        vm.expectRevert(Manager.InvalidTerms.selector);manager.registerEvent(t);
    }
    function testCompetingVaultCannotUseOtherVaultCapital() public {
        fund(1000 * U); address[] memory invited = new address[](1); invited[0] = c; manager.createVault(c,uint64(block.timestamp+3 days),invited,T.Mode.Synthetic); Vault other = manager.vaults(2);
        vm.startPrank(c); token.approve(address(other),type(uint256).max); other.deposit(1000 * U); other.beginUnderwriting(); vm.stopPrank();
        uint256 e = manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.Yes,1)); uint256 p1 = issue(e,200 * U,25 * U,b);
        vm.prank(c); uint256 q = manager.publishQuote(e,2,200 * U,30 * U,uint64(block.timestamp+1 days)); vm.prank(a); uint256 p2 = manager.purchase(q);
        assertEq(vault.reservedCoverage(),200 * U); assertEq(other.reservedCoverage(),200 * U);
        resolve(e); manager.settlePolicy(p2); assertEq(vault.accountedAssets(),1000 * U); assertEq(other.accountedAssets(),830 * U); manager.settlePolicy(p1);
        assertEq(vault.accountedAssets(),825 * U); reconcile(vault); reconcile(other);
    }
    function testIncorrectDecimalsAndMainnetRejected() public {
        WrongDecimals wrong = new WrongDecimals(); vm.expectRevert(Manager.InvalidTerms.selector); new Manager(IERC20(address(wrong)),a);
        vm.chainId(143); vm.expectRevert(MockUSDC.TestnetOnly.selector); new MockUSDC();
    }
    function testFuzzSettlementPermutationsAndPostRedemptionSurplus(uint8 orderIn) public {
        fund(1000 * U); uint256[3] memory policies;
        for(uint256 i;i<3;++i){uint256 e=manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome(i+1),i+1));policies[i]=issue(e,200 * U,25 * U,b);resolve(e);}
        uint256 order=bound(orderIn,0,5); uint256 first=order/2;
        uint256 second=(first+1+order%2)%3; uint256 third=3-first-second;
        uint256[3] memory sequence=[first,second,third];
        for(uint256 i;i<3;++i){manager.settlePolicy(policies[sequence[i]]);vm.prank(c);token.transfer(address(vault),1);vm.prank(c);token.transfer(address(manager),2);reconcile(vault);}
        assertEq(vault.accountedAssets(),850 * U);
        vm.prank(a);vault.endIssuance();vault.closeEpoch();vm.prank(a);vault.redeem(1000 * U);
        vm.prank(c);token.transfer(address(vault),4);vm.prank(c);token.transfer(address(manager),5);
        assertEq(vault.unassignedSurplus(),7);assertEq(manager.unassignedSurplus(),11);reconcile(vault);
    }
    function testTokenCallbacksCannotReenterFinancialOperations() public {
        CallbackToken hook=new CallbackToken(); Manager m=new Manager(IERC20(address(hook)),address(this));
        Resolver r=new Resolver(address(m),a); m.initializeAdapter(r);
        address[] memory invited=new address[](1);invited[0]=a;
        m.createVault(a,uint64(block.timestamp+3 days),invited,T.Mode.Synthetic);Vault v=m.vaults(1);
        hook.mint(a,1000 * U);hook.mint(b,1000 * U);
        vm.prank(a);hook.approve(address(v),type(uint256).max);vm.prank(b);hook.approve(address(m),type(uint256).max);
        hook.arm(address(v),abi.encodeCall(v.deposit,(1)));vm.prank(a);v.deposit(1000 * U);
        assertTrue(hook.attempted());assertFalse(hook.succeeded());assertEq(hook.failure(),ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(a);v.beginUnderwriting();T.EventTerms memory t=terms(T.Mode.Synthetic,T.Outcome.No,99);uint256 e=m.registerEvent(t);
        vm.prank(a);uint256 q=m.publishQuote(e,1,200 * U,25 * U,uint64(block.timestamp+1 days));
        hook.arm(address(m),abi.encodeCall(m.purchase,(q)));vm.prank(b);uint256 p=m.purchase(q);
        assertTrue(hook.attempted());assertFalse(hook.succeeded());assertEq(hook.failure(),ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        bytes32 id=m.requestIds(e);vm.prank(a);r.commitEvidence(id,t.specHash,t.sourceConfigHash,t.fixtureManifestHash,t.fixtureResponseHash,t.fixtureRainfallMilliMm,uint64(block.timestamp),1,"https://fixture/no");r.finalize(id);
        hook.arm(address(m),abi.encodeCall(m.settlePolicy,(p)));m.settlePolicy(p);
        assertFalse(hook.succeeded());assertEq(hook.failure(),ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        vm.prank(a);v.endIssuance();v.closeEpoch();hook.arm(address(v),abi.encodeCall(v.redeem,(1)));vm.prank(a);v.redeem(1000 * U);
        assertTrue(hook.attempted());assertFalse(hook.succeeded());assertEq(hook.failure(),ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(v.accountedAssets(),0);assertEq(v.totalSupply(),0);assertEq(m.premiumEscrow(),0);
    }
    function testUnexpectedDepositsToBothVaultsAcrossEveryPhase() public {
        address[] memory invited=new address[](1);invited[0]=c;
        manager.createVault(c,uint64(block.timestamp+3 days),invited,T.Mode.Synthetic);Vault other=manager.vaults(2);
        vm.startPrank(c);token.approve(address(other),type(uint256).max);token.transfer(address(vault),1);token.transfer(address(other),2);token.transfer(address(manager),3);vm.stopPrank();
        fund(1000 * U);vm.startPrank(c);other.deposit(1000 * U);other.beginUnderwriting();vm.stopPrank();reconcile(vault);reconcile(other);
        uint256 e=manager.registerEvent(terms(T.Mode.Synthetic,T.Outcome.No,111));uint256 p1=issue(e,200 * U,25 * U,b);
        vm.prank(c);uint256 q=manager.publishQuote(e,2,200 * U,30 * U,uint64(block.timestamp+1 days));vm.prank(a);uint256 p2=manager.purchase(q);
        vm.startPrank(c);token.transfer(address(vault),4);token.transfer(address(other),5);token.transfer(address(manager),6);vm.stopPrank();reconcile(vault);reconcile(other);
        resolve(e);manager.settlePolicy(p2);manager.settlePolicy(p1);
        vm.startPrank(c);token.transfer(address(vault),7);token.transfer(address(other),8);token.transfer(address(manager),9);vm.stopPrank();reconcile(vault);reconcile(other);
        assertEq(vault.accountedAssets(),1025 * U);assertEq(other.accountedAssets(),1030 * U);
        vm.prank(a);vault.endIssuance();vm.prank(c);other.endIssuance();vault.closeEpoch();other.closeEpoch();
        vm.prank(a);assertEq(vault.redeem(1000 * U),1025 * U);vm.prank(c);assertEq(other.redeem(1000 * U),1030 * U);
        vm.startPrank(c);token.transfer(address(vault),10);token.transfer(address(other),11);token.transfer(address(manager),12);vm.stopPrank();
        assertEq(vault.unassignedSurplus(),22);assertEq(other.unassignedSurplus(),26);assertEq(manager.unassignedSurplus(),30);reconcile(vault);reconcile(other);
    }
}
