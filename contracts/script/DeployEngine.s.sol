// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PerpEngine} from "../src/PerpEngine.sol";

/// @notice Deploys only PerpEngine, reusing already-deployed MockUSDC and MockPriceFeed.
///         Requires USDC_ADDRESS and PRICE_FEED_ADDRESS to be set in the environment.
contract DeployEngine is Script {
    uint256 constant INSURANCE_FUND_SEED = 10_000 * 1e6; // 10,000 mUSDC

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);
        address usdc        = vm.envAddress("USDC_ADDRESS");
        address priceFeed   = vm.envAddress("PRICE_FEED_ADDRESS");

        vm.startBroadcast(deployerKey);

        PerpEngine engine = new PerpEngine(usdc, priceFeed, deployer);

        MockUSDC(usdc).mint(deployer, INSURANCE_FUND_SEED);
        MockUSDC(usdc).approve(address(engine), INSURANCE_FUND_SEED);
        engine.seedInsuranceFund(INSURANCE_FUND_SEED);

        vm.stopBroadcast();

        console.log("Deployer:     ", deployer);
        console.log("MockUSDC:     ", usdc);
        console.log("MockPriceFeed:", priceFeed);
        console.log("PerpEngine:   ", address(engine));
        console.log("");
        console.log("Update .env:");
        console.log("PERP_ADDRESS=", address(engine));
    }
}
