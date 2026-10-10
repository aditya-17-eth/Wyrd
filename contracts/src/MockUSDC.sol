// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Educational token with no backing, monetary value, or Circle affiliation.
contract MockUSDC is ERC20 {
    error TestnetOnly();
    error FaucetCooldown();
    mapping(address => uint256) public lastClaim;
    constructor() ERC20("AEGIS Mock USDC", "mUSDC") {
        if (block.chainid != 10143 && block.chainid != 31337) revert TestnetOnly();
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function faucet() external {
        if (lastClaim[msg.sender] != 0 && block.timestamp < lastClaim[msg.sender] + 1 days) revert FaucetCooldown();
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, 10_000 * 1e6);
    }
}
