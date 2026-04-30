// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockPriceFeed} from "../src/MockPriceFeed.sol";

contract PriceFeedTest is Test {
    MockPriceFeed internal feed;
    address internal owner = address(0xBEEF);
    address internal other = address(0xCAFE);

    uint256 internal constant INITIAL = 70_000 * 1e18;

    function setUp() public {
        vm.prank(owner);
        feed = new MockPriceFeed(owner, "BTC-USD", INITIAL);
    }

    function test_InitialPriceSet() public view {
        assertEq(feed.latestPrice(), INITIAL);
        assertEq(feed.symbol(), "BTC-USD");
    }

    function test_SetPrice_UpdatesPrice() public {
        vm.prank(owner);
        feed.setPrice(80_000 * 1e18);
        assertEq(feed.latestPrice(), 80_000 * 1e18);
    }

    function test_SetPrice_EmitsEvent() public {
        uint256 newPrice = 80_000 * 1e18;
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit MockPriceFeed.PriceUpdated(newPrice, uint64(block.timestamp));
        feed.setPrice(newPrice);
    }

    function test_SetPrice_UpdatesTimestamp() public {
        vm.warp(1_700_000_000);
        vm.prank(owner);
        feed.setPrice(75_000 * 1e18);
        assertEq(feed.latestTimestamp(), 1_700_000_000);
    }

    function test_SetPrice_AllowsAnyone() public {
        vm.prank(other);
        feed.setPrice(80_000 * 1e18);
        assertEq(feed.latestPrice(), 80_000 * 1e18);
    }

    function test_SetPrice_RevertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert("PriceFeed: zero price");
        feed.setPrice(0);
    }

    function test_Constructor_RevertsOnZeroPrice() public {
        vm.prank(owner);
        vm.expectRevert("PriceFeed: zero price");
        new MockPriceFeed(owner, "BTC-USD", 0);
    }
}
