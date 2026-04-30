// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {PerpEngine} from "../src/PerpEngine.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockPriceFeed} from "../src/MockPriceFeed.sol";

contract PerpEngineTest is Test {
    MockUSDC     internal usdc;
    MockPriceFeed internal feed;
    PerpEngine   internal engine;

    address internal deployer = address(0xDEAD);
    address internal alice    = address(0xA11CE);
    address internal bob      = address(0xB0B);

    uint256 internal constant INITIAL_PRICE = 70_000 * 1e18; // $70k BTC
    uint256 internal constant COLLATERAL    = 100 * 1e6;     // 100 mUSDC

    function setUp() public {
        vm.startPrank(deployer);
        usdc   = new MockUSDC(deployer);
        feed   = new MockPriceFeed(deployer, "BTC-USD", INITIAL_PRICE);
        engine = new PerpEngine(address(usdc), address(feed), deployer);

        // fund alice and bob
        usdc.mint(alice, 10_000 * 1e6);
        usdc.mint(bob,   10_000 * 1e6);

        // seed insurance fund
        usdc.mint(deployer, 10_000 * 1e6);
        usdc.approve(address(engine), 10_000 * 1e6);
        engine.seedInsuranceFund(10_000 * 1e6);
        vm.stopPrank();

        vm.prank(alice);
        usdc.approve(address(engine), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(engine), type(uint256).max);
    }

    // ── Open position ──────────────────────────────────────────────────────

    function test_OpenLong_CorrectFields() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 10, true);

        PerpEngine.Position memory p = engine.getPosition(pid);
        assertEq(p.trader,   alice);
        assertTrue(p.isLong);
        assertEq(p.leverage, 10);
        assertTrue(p.isOpen);
        assertEq(p.entryPrice, INITIAL_PRICE);
        assertGt(p.sizeTokens, 0);
        assertGt(p.notional, 0);

        // liquidation price for 10x LONG at $70k → $66,500
        uint256 expectedLiq = 70_000 * 1e18 * 95 / 100; // 5% below
        assertEq(p.liquidationPrice, expectedLiq);
    }

    function test_OpenShort_CorrectFields() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 10, false);

        PerpEngine.Position memory p = engine.getPosition(pid);
        assertTrue(!p.isLong);
        assertTrue(p.isOpen);

        // liquidation price for 10x SHORT at $70k → $73,500
        uint256 expectedLiq = 70_000 * 1e18 * 105 / 100; // 5% above
        assertEq(p.liquidationPrice, expectedLiq);
    }

    function test_OpenPosition_ChargesOpenFee() public {
        uint256 fundBefore = engine.insuranceFund();
        vm.prank(alice);
        engine.openPosition(COLLATERAL, 5, true);
        uint256 fundAfter = engine.insuranceFund();

        // fee = 0.10% of (100 * 5) = 0.05 mUSDC * 1e6 → 50_000 units
        uint256 expectedFee = (COLLATERAL * 5 * 10) / 10_000;
        assertEq(fundAfter - fundBefore, expectedFee);
    }

    function test_OpenPosition_RevertsOnZeroCollateral() public {
        vm.prank(alice);
        vm.expectRevert("PerpEngine: collateral too low");
        engine.openPosition(0, 5, true);
    }

    function test_OpenPosition_RevertsOnLeverageTooLow() public {
        vm.prank(alice);
        vm.expectRevert("PerpEngine: bad leverage");
        engine.openPosition(COLLATERAL, 0, true);
    }

    function test_OpenPosition_RevertsOnLeverageTooHigh() public {
        vm.prank(alice);
        vm.expectRevert("PerpEngine: bad leverage");
        engine.openPosition(COLLATERAL, 11, true);
    }

    function test_TraderPositionsTracked() public {
        vm.startPrank(alice);
        uint256 p1 = engine.openPosition(COLLATERAL, 5, true);
        uint256 p2 = engine.openPosition(COLLATERAL, 3, false);
        vm.stopPrank();

        uint256[] memory ids = engine.getTraderPositions(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], p1);
        assertEq(ids[1], p2);
    }

    // ── Close position ─────────────────────────────────────────────────────

    function test_ClosePosition_ProfitLong() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, true);

        // Move price up 10%
        uint256 newPrice = INITIAL_PRICE * 110 / 100;
        vm.prank(deployer);
        feed.setPrice(newPrice);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.closePosition(pid);
        uint256 balAfter = usdc.balanceOf(alice);

        assertGt(balAfter, balBefore, "alice should profit");

        PerpEngine.Position memory p = engine.getPosition(pid);
        assertFalse(p.isOpen);
    }

    function test_ClosePosition_LossLong() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, true);

        // Move price down 5% (but not past liq threshold for 5x: ~15% down)
        uint256 newPrice = INITIAL_PRICE * 95 / 100;
        vm.prank(deployer);
        feed.setPrice(newPrice);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.closePosition(pid);
        uint256 balAfter = usdc.balanceOf(alice);

        assertLt(balAfter, balBefore + COLLATERAL, "alice should lose some collateral");
    }

    function test_ClosePosition_ProfitShort() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, false);

        // Move price down 10% → short profits
        uint256 newPrice = INITIAL_PRICE * 90 / 100;
        vm.prank(deployer);
        feed.setPrice(newPrice);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.closePosition(pid);
        uint256 balAfter = usdc.balanceOf(alice);

        assertGt(balAfter, balBefore, "alice should profit on short");
    }

    function test_ClosePosition_LossShort() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, false);

        // Move price up 5% → short loses
        uint256 newPrice = INITIAL_PRICE * 105 / 100;
        vm.prank(deployer);
        feed.setPrice(newPrice);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.closePosition(pid);
        uint256 balAfter = usdc.balanceOf(alice);

        assertLt(balAfter, balBefore + COLLATERAL, "alice should lose on short");
    }

    function test_ClosePosition_RevertsIfNotOwner() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, true);

        vm.prank(bob);
        vm.expectRevert("PerpEngine: not owner");
        engine.closePosition(pid);
    }

    function test_ClosePosition_ChargesCloseFee() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 1, true); // 1x leverage, no PnL risk

        uint256 fundBefore = engine.insuranceFund();

        vm.prank(alice);
        engine.closePosition(pid);

        uint256 fundAfter = engine.insuranceFund();
        // fund should increase from close fee (even though open fee already collected)
        assertGt(fundAfter, fundBefore);
    }

    function test_ClosePosition_RevertsOnAlreadyClosed() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, true);
        vm.prank(alice);
        engine.closePosition(pid);

        vm.prank(alice);
        vm.expectRevert("PerpEngine: not open");
        engine.closePosition(pid);
    }

    // ── LiquidationPrice formula ───────────────────────────────────────────

    function test_LiqPriceFormula_L10_Long() public view {
        uint256 liq = engine.calcLiquidationPrice(true, INITIAL_PRICE, 10);
        // factor = 1/10 - 5/100 = 10% - 5% = 5%
        // liq = 70_000 * (1 - 0.05) = 66_500e18
        assertEq(liq, 66_500 * 1e18);
    }

    function test_LiqPriceFormula_L10_Short() public view {
        uint256 liq = engine.calcLiquidationPrice(false, INITIAL_PRICE, 10);
        assertEq(liq, 73_500 * 1e18);
    }

    function test_LiqPriceFormula_L5_Long() public view {
        uint256 liq = engine.calcLiquidationPrice(true, INITIAL_PRICE, 5);
        // factor = 1/5 - 5/100 = 20% - 5% = 15%
        // liq = 70_000 * 0.85 = 59_500e18
        assertEq(liq, 59_500 * 1e18);
    }

    function test_LiqPriceFormula_L5_Short() public view {
        uint256 liq = engine.calcLiquidationPrice(false, INITIAL_PRICE, 5);
        assertEq(liq, 80_500 * 1e18);
    }

    function test_LiqPriceFormula_L1_Long() public view {
        uint256 liq = engine.calcLiquidationPrice(true, INITIAL_PRICE, 1);
        // factor = 1/1 - 5% = 95%
        // liq = 70_000 * 0.05 = 3_500e18
        assertEq(liq, 3_500 * 1e18);
    }

    // ── calcPnl view ───────────────────────────────────────────────────────

    function test_CalcPnl_LongProfit() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 10, true);

        uint256 exitPrice = INITIAL_PRICE * 110 / 100;
        int256 pnl = engine.calcPnl(pid, exitPrice);
        assertGt(pnl, 0, "long pnl should be positive when price up");
    }

    function test_CalcPnl_LongLoss() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 10, true);

        uint256 exitPrice = INITIAL_PRICE * 90 / 100;
        int256 pnl = engine.calcPnl(pid, exitPrice);
        assertLt(pnl, 0, "long pnl should be negative when price down");
    }

    // ── Open position set ──────────────────────────────────────────────────

    function test_OpenPositionSet_AddedOnOpen() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, true);

        (uint256[] memory ids, uint256 total) = engine.getOpenPositionIds(0, 100);
        assertEq(total, 1);
        assertEq(ids[0], pid);
    }

    function test_OpenPositionSet_RemovedOnClose() public {
        vm.prank(alice);
        uint256 pid = engine.openPosition(COLLATERAL, 5, true);
        vm.prank(alice);
        engine.closePosition(pid);

        (, uint256 total) = engine.getOpenPositionIds(0, 100);
        assertEq(total, 0);
    }

    // ── Fuzz ───────────────────────────────────────────────────────────────

    function testFuzz_OpenClose_CollateralConserved(uint8 lev, uint256 col) public {
        lev = uint8(bound(lev, 1, 10));
        col = bound(col, MIN_COLLATERAL(), 1_000 * 1e6);

        usdc.mint(alice, col);
        vm.prank(alice);
        uint256 pid = engine.openPosition(col, lev, true);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        engine.closePosition(pid);
        uint256 balAfter = usdc.balanceOf(alice);

        // At same price (no price change), payout = collateral - open_fee - close_fee
        // Payout should be positive (fees < collateral)
        assertGe(balAfter, balBefore, "should not lose more than deposited at same price");
    }

    function testFuzz_LiqPriceBetweenEntryAndRuin(bool isLong, uint8 lev) public view {
        lev = uint8(bound(lev, 1, 10));
        uint256 entry = INITIAL_PRICE;
        uint256 liq   = engine.calcLiquidationPrice(isLong, entry, lev);

        if (isLong) {
            assertLt(liq, entry, "long liq < entry");
            assertGt(liq, 0,     "long liq > 0");
        } else {
            assertGt(liq, entry, "short liq > entry");
        }
    }

    function MIN_COLLATERAL() internal view returns (uint256) {
        return engine.MIN_COLLATERAL();
    }
}
