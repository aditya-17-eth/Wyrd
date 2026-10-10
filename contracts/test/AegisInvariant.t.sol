// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AegisPolicyManager as Manager} from "../src/AegisPolicyManager.sol";
import {AegisUnderwritingVault as Vault} from "../src/AegisUnderwritingVault.sol";
import {DemoWeatherResolver as Resolver} from "../src/DemoWeatherResolver.sol";
import {AegisTypes as T} from "../src/AegisTypes.sol";

contract AegisHandler is Test {
    MockUSDC public token; Manager public manager; Resolver public resolver; Vault public vault;
    uint256[] public events; uint256[] public policyIds;
    bool private configured;
    constructor(MockUSDC token_, Manager manager_, Resolver resolver_) { token=token_; manager=manager_; resolver=resolver_; }
    function configure(Vault vault_, uint256[] memory events_) external { require(!configured); configured=true; vault=vault_; events=events_; token.faucet(); token.approve(address(vault),type(uint256).max); token.approve(address(manager),type(uint256).max); vault.deposit(1000e6); }
    function deposit(uint64 input) external { uint256 amount=bound(input,1,1000e6); if(token.balanceOf(address(this))>=amount) { try vault.deposit(amount) {} catch {} } }
    function begin() external { try vault.beginUnderwriting() {} catch {} }
    function donate(uint64 input, bool toManager) external { uint256 amount=bound(input,0,token.balanceOf(address(this))); token.transfer(toManager ? address(manager) : address(vault),amount); }
    function purchase(uint8 eventIndex, uint64 amountIn, uint64 premiumIn) external {
        uint256 coverage=bound(amountIn,1,200e6); uint256 premium=bound(premiumIn,1,25e6);
        uint256 eventId=events[eventIndex % events.length];
        try manager.publishQuote(eventId,1,coverage,premium,uint64(block.timestamp+1 hours)) returns(uint256 quote) {
            try manager.purchase(quote) returns(uint256 policy) { policyIds.push(policy); } catch {}
        } catch {}
    }
    function resolve(uint8 eventIndex) external {
        uint256 eventId=events[eventIndex % events.length]; T.EventTerms memory t=manager.getEvent(eventId); bytes32 request=manager.requestIds(eventId);
        if (t.fixtureOutcome==T.Outcome.Invalid) { try resolver.finalizeSyntheticInvalid(request,"https://fixture/invalid") {} catch {} }
        else {
            try resolver.commitEvidence(request,t.specHash,t.sourceConfigHash,t.fixtureManifestHash,t.fixtureResponseHash,t.fixtureRainfallMilliMm,uint64(block.timestamp),1,"https://fixture/valid") {} catch {}
            try resolver.finalize(request) {} catch {}
        }
    }
    function settle(uint8 index) external { if(policyIds.length!=0) { try manager.settlePolicy(policyIds[index % policyIds.length]) {} catch {} } }
    function endAndClose() external { try vault.endIssuance() {} catch {} try vault.closeEpoch() {} catch {} }
    function redeem(uint64 input) external { uint256 shares=vault.balanceOf(address(this)); if(shares!=0) { try vault.redeem(bound(input,1,shares)) {} catch {} } }
    function advance(uint32 input) external { vm.warp(block.timestamp + bound(input,1,2 days)); }
}

contract AegisInvariantTest is Test {
    MockUSDC token; Manager manager; Resolver resolver; Vault vault; AegisHandler handler;
    function setUp() public {
        vm.chainId(31337); vm.warp(1_900_000_000); token=new MockUSDC(); manager=new Manager(IERC20(address(token)),address(this));
        // Handler owns both demo authority and underwriting wallet; all calls still pass access controls.
        address predicted=vm.computeCreateAddress(address(this),vm.getNonce(address(this))+1);
        resolver=new Resolver(address(manager),predicted); handler=new AegisHandler(token,manager,resolver); assertEq(address(handler),predicted);
        manager.initializeAdapter(resolver); address[] memory invited=new address[](1); invited[0]=address(handler);
        manager.createVault(address(handler),uint64(block.timestamp+30 days),invited,T.Mode.Synthetic); vault=manager.vaults(1);
        uint256[] memory ids=new uint256[](3);
        for(uint256 i; i<3; ++i) {
            T.EventTerms memory t; t.specHash=keccak256(abi.encode(i)); t.sourceConfigHash=keccak256("ERA5");
            t.observationStart=uint64(block.timestamp+20 days); t.observationEnd=t.observationStart+1 days;
            t.purchaseCutoff=t.observationStart-1 days; t.minimumLeadTime=1 days; t.captureEligibleAt=t.observationEnd+5 days; t.resolutionDeadline=t.observationEnd+14 days;
            t.thresholdMilliMm=50_000; t.maxEventCoverage=1000e6; t.maxBuyerCoverage=200e6; t.mode=T.Mode.Synthetic;
            t.fixtureManifestHash=keccak256(abi.encode("fixture",i)); t.fixtureResponseHash=keccak256(abi.encode("raw",i));
            t.fixtureOutcome=T.Outcome(i+1); t.fixtureRainfallMilliMm=i==0 ? 60_000 : 10_000; t.specificationURI="https://fixture/spec";
            ids[i]=manager.registerEvent(t);
        }
        handler.configure(vault,ids);
        bytes4[] memory selectors=new bytes4[](9);
        selectors[0]=handler.deposit.selector; selectors[1]=handler.begin.selector;
        selectors[2]=handler.donate.selector; selectors[3]=handler.purchase.selector;
        selectors[4]=handler.resolve.selector; selectors[5]=handler.settle.selector;
        selectors[6]=handler.endAndClose.selector; selectors[7]=handler.redeem.selector;
        selectors[8]=handler.advance.selector;
        targetSelector(FuzzSelector({addr:address(handler),selectors:selectors}));
        targetContract(address(handler));
    }
    function invariantSolvencyReservationsAndEscrow() public view {
        uint256 obligations; uint256 escrow; uint256 active;
        for(uint256 i=1; i<=manager.policyCount(); ++i) {
            Manager.Policy memory p=manager.getPolicy(i);
            if(!p.settled) { obligations+=p.coverage; escrow+=p.premium; ++active; assertEq(vault.policyReservations(i),p.coverage); }
            else assertEq(vault.policyReservations(i),0);
        }
        assertEq(vault.reservedCoverage(),obligations); assertEq(vault.activePolicies(),active); assertGe(vault.accountedAssets(),obligations);
        assertEq(manager.premiumEscrow(),escrow);
    }
    function invariantAssetConservationAndSurplus() public view {
        assertEq(token.balanceOf(address(vault)),vault.accountedAssets()+vault.unassignedSurplus());
        assertEq(token.balanceOf(address(manager)),manager.premiumEscrow()+manager.unassignedSurplus());
        assertEq(vault.accountedAssets()+vault.settledPayouts()+vault.totalRedeemed(),vault.totalDeposited()+vault.realizedPremiums());
        assertEq(manager.totalPremiumsReceived(),manager.premiumEscrow()+manager.totalPremiumsEarned()+manager.totalPremiumsRefunded());
        assertEq(token.totalSupply(),token.balanceOf(address(handler))+token.balanceOf(address(vault))+token.balanceOf(address(manager)));
        if(vault.phase()==Vault.Phase.Closed) { assertEq(vault.reservedCoverage(),0); assertEq(vault.activePolicies(),0); }
    }
}
