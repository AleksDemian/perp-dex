// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Mint demo mUSDC to the deployer and some test addresses.
contract Seed is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);
        address usdc        = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast(deployerKey);
        MockUSDC(usdc).mint(deployer, 100_000 * 1e6);
        vm.stopBroadcast();

        console.log("Minted 100,000 mUSDC to deployer:", deployer);
    }
}
