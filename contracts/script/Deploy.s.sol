// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {Script} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {AegisPolicyManager} from "../src/AegisPolicyManager.sol";
import {DemoWeatherResolver} from "../src/DemoWeatherResolver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract Deploy is Script {
    function run() external returns(MockUSDC token,AegisPolicyManager manager,DemoWeatherResolver resolver){
        require(block.chainid==10143,"MONAD TESTNET ONLY");address admin=vm.envAddress("UNDERWRITER_A");
        vm.startBroadcast(admin);token=new MockUSDC();manager=new AegisPolicyManager(IERC20(address(token)),admin);
        resolver=new DemoWeatherResolver(address(manager),admin);manager.initializeAdapter(resolver);vm.stopBroadcast();
    }
}
