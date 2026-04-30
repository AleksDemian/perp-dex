// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PerpEngine} from "../src/PerpEngine.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockPriceFeed} from "../src/MockPriceFeed.sol";

contract LiquidationTest is Test {
    MockUSDC      internal usdc;
    MockPriceFeed internal feed;
    PerpEngine    internal engine;

    address internal deployer  = address(0xDEAD);
    address internal alice     = address(0xA11CE);
    address internal keeper    = address(0xDEF1); // liquidation bot

    uint256 internal constant INIT_PRICE = 70_000 * 1e18;
    uint256 internal constant COLLATERAL = 100 * 1e6;

    function setUp() public {
        vm.startPrank(deployer);
        usdc   = new MockUSDC(deployer);
        feed   = new MockPriceFeed(deployer, "BTC-USD", INIT_PRICE);
        engine = new PerpEngine(address(usdc), address(feed), deployer);

        usdc.mint(alice,   50_000 * 1e6);
        usdc.mint(deployer, 20_000 * 1e6);
        usdc.approve(address(engine), 20_000 * 1e6);
        engine.seedInsuranceFund(10_000 * 1e6);
        vm.stopPrank();

        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    function _openLong(uint8 lev) internal returns (uint256) {
        vm.prank(alice);
        return engine.openPosition(COLLATERAL, lev, true);
    }

    function _openShort(uint8 lev) internal returns (uint256) {
        vm.prank(alice);
        return engine.openPosition(COLLATERAL, lev, false);
    }

    // ── Liquidation triggers ───────────────────────────────────────────────

    function test_Liquidate_LongAtThreshold() public {
        uint256 pid = _openLong(10);
        // liqPrice for 10x long = 70_000 * 0.95 = 66_500e18
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;

        vm.prank(deployer);
        feed.setPrice(liqPrice); // exactly at threshold

        assertTrue(engine.isLiquidatable(pid), "should be liquidatable at threshold");

        vm.prank(keeper);
        engine.liquidate(pid);

        assertFalse(engine.getPosition(pid).isOpen);
    }

    function test_Liquidate_LongBelowThreshold() public {
        uint256 pid = _openLong(10);
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;

        // Move 1% below liquidation price
        vm.prank(deployer);
        feed.setPrice(liqPrice - liqPrice / 100);

        assertTrue(engine.isLiquidatable(pid));
        vm.prank(keeper);
        engine.liquidate(pid);
        assertFalse(engine.getPosition(pid).isOpen);
    }

    function test_Liquidate_ShortAtThreshold() public {
        uint256 pid = _openShort(10);
        // liqPrice for 10x short = 70_000 * 1.05 = 73_500e18
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;

        vm.prank(deployer);
        feed.setPrice(liqPrice);

        assertTrue(engine.isLiquidatable(pid));
        vm.prank(keeper);
        engine.liquidate(pid);
        assertFalse(engine.getPosition(pid).isOpen);
    }

    function test_Liquidate_ShortAboveThreshold() public {
        uint256 pid = _openShort(10);
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;

        vm.prank(deployer);
        feed.setPrice(liqPrice + liqPrice / 100);

        assertTrue(engine.isLiquidatable(pid));
        vm.prank(keeper);
        engine.liquidate(pid);
        assertFalse(engine.getPosition(pid).isOpen);
    }

    function test_Liquidate_RevertsWhenHealthy() public {
        uint256 pid = _openLong(10);
        // Price moves down 2% — above liq threshold (5%)
        vm.prank(deployer);
        feed.setPrice(INIT_PRICE * 98 / 100);

        assertFalse(engine.isLiquidatable(pid));
        vm.prank(keeper);
        vm.expectRevert("PerpEngine: not liquidatable");
        engine.liquidate(pid);
    }

    function test_Close_RevertsWhenLiquidatable() public {
        uint256 pid = _openLong(10);
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;

        vm.prank(deployer);
        feed.setPrice(liqPrice);

        vm.prank(alice);
        vm.expectRevert("PerpEngine: liquidatable");
        engine.closePosition(pid);
    }

    function test_Liquidate_RevertsOnAlreadyLiquidated() public {
        uint256 pid = _openLong(10);
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;
        vm.prank(deployer);
        feed.setPrice(liqPrice);
        vm.prank(keeper);
        engine.liquidate(pid);

        vm.prank(keeper);
        vm.expectRevert("PerpEngine: not open");
        engine.liquidate(pid);
    }

    // ── Bonus & payout ─────────────────────────────────────────────────────

    function test_Liquidate_PaysBonusToCaller() public {
        uint256 pid = _openLong(10);
        PerpEngine.Position memory p = engine.getPosition(pid);
        uint256 liqPrice = p.liquidationPrice;

        vm.prank(deployer);
        feed.setPrice(liqPrice);

        uint256 keeperBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        engine.liquidate(pid);
        uint256 keeperAfter = usdc.balanceOf(keeper);

        uint256 expectedBonus = (uint256(p.notional) * engine.LIQUIDATION_BONUS_BPS()) / engine.BPS_DENOM();
        assertEq(keeperAfter - keeperBefore, expectedBonus);
    }

    function test_Liquidate_ReturnsRemainderToTrader() public {
        uint256 pid = _openLong(10);
        PerpEngine.Position memory p = engine.getPosition(pid);
        uint256 liqPrice = p.liquidationPrice;

        vm.prank(deployer);
        feed.setPrice(liqPrice);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(keeper);
        engine.liquidate(pid);
        uint256 aliceAfter = usdc.balanceOf(alice);

        // At liq price, equity = collateral * maintenanceMarginRate = 5% of notional
        // = 5% of (collateral * 10) = 50% of collateral = 50 mUSDC
        // bonus = 0.5% of notional = 0.5% of 1000 = 5 mUSDC
        // remaining = ~45 mUSDC should go back to alice
        assertGt(aliceAfter, aliceBefore, "trader should receive remainder");
    }

    function test_Liquidate_BadDebt_DebitsInsuranceFund() public {
        uint256 pid = _openLong(10);
        // Crash price 10% below liquidation price → large bad debt
        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;
        vm.prank(deployer);
        feed.setPrice(liqPrice * 90 / 100);

        uint256 fundBefore = engine.insuranceFund();
        vm.prank(keeper);
        engine.liquidate(pid);
        uint256 fundAfter = engine.insuranceFund();

        // Insurance fund should be debited due to bad debt
        assertLt(fundAfter, fundBefore);
    }

    function test_Liquidate_RemovesFromOpenSet() public {
        uint256 pid = _openLong(10);
        (, uint256 totalBefore) = engine.getOpenPositionIds(0, 100);
        assertEq(totalBefore, 1);

        uint256 liqPrice = engine.getPosition(pid).liquidationPrice;
        vm.prank(deployer);
        feed.setPrice(liqPrice);
        vm.prank(keeper);
        engine.liquidate(pid);

        (, uint256 totalAfter) = engine.getOpenPositionIds(0, 100);
        assertEq(totalAfter, 0);
    }

    // ── Insurance fund ─────────────────────────────────────────────────────

    function test_IsLiquidatable_ReturnsFalseForClosed() public {
        uint256 pid = _openLong(10);
        vm.prank(alice);
        engine.closePosition(pid);

        assertFalse(engine.isLiquidatable(pid));
    }

    function test_Donate_IncreasesInsuranceFund() public {
        address donor = address(0xD0);
        usdc.mint(donor, 1_000 * 1e6);
        vm.startPrank(donor);
        usdc.approve(address(engine), 1_000 * 1e6);
        uint256 fundBefore = engine.insuranceFund();
        engine.donate(500 * 1e6);
        vm.stopPrank();
        assertEq(engine.insuranceFund(), fundBefore + 500 * 1e6);
    }
}
