// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {AegisTypes} from "../AegisTypes.sol";

interface IResolutionAdapter {
    function policyManager() external view returns (address);
    function authority() external view returns (address);
    function registerRequest(uint256 eventId, AegisTypes.EventTerms calldata terms) external returns (bytes32);
    function getResolution(bytes32 requestId) external view returns (AegisTypes.Resolution memory);
}
