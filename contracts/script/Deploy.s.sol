// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockPriceFeed} from "../src/MockPriceFeed.sol";
import {PerpEngine} from "../src/PerpEngine.sol";

contract Deploy is Script {
    uint256 constant INITIAL_BTC_PRICE   = 70_000 * 1e18;
    uint256 constant INSURANCE_FUND_SEED = 10_000 * 1e6;  // 10,000 mUSDC

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        MockUSDC      usdc   = new MockUSDC(deployer);
        MockPriceFeed feed   = new MockPriceFeed(deployer, "BTC-USD", INITIAL_BTC_PRICE);
        PerpEngine    engine = new PerpEngine(address(usdc), address(feed), deployer);

        // Seed insurance fund
        usdc.mint(deployer, INSURANCE_FUND_SEED);
        usdc.approve(address(engine), INSURANCE_FUND_SEED);
        engine.seedInsuranceFund(INSURANCE_FUND_SEED);

        vm.stopBroadcast();

        console.log("Deployer:       ", deployer);
        console.log("MockUSDC:       ", address(usdc));
        console.log("MockPriceFeed:  ", address(feed));
        console.log("PerpEngine:     ", address(engine));
        console.log("");
        console.log("Add to .env:");
        console.log("USDC_ADDRESS=", address(usdc));
        console.log("PRICE_FEED_ADDRESS=", address(feed));
        console.log("PERP_ADDRESS=", address(engine));
    }
}
