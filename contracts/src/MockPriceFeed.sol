// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockPriceFeed
/// @notice Admin-controlled price oracle for demo use. NOT for production.
contract MockPriceFeed is Ownable {
    string public symbol;
    uint256 public latestPrice;     // 1e18 precision (e.g. $70k → 70_000e18)
    uint64  public latestTimestamp;

    event PriceUpdated(uint256 newPrice, uint64 timestamp);

    constructor(address initialOwner, string memory _symbol, uint256 initialPrice)
        Ownable(initialOwner)
    {
        require(initialPrice > 0, "PriceFeed: zero price");
        symbol           = _symbol;
        latestPrice      = initialPrice;
        latestTimestamp  = uint64(block.timestamp);
        emit PriceUpdated(initialPrice, uint64(block.timestamp));
    }

    /// @notice Update the mark price. Permissionless for demo simplicity:
    /// any wallet may push a new price so the UI doesn't require a privileged key.
    function setPrice(uint256 newPrice) external {
        require(newPrice > 0, "PriceFeed: zero price");
        latestPrice     = newPrice;
        latestTimestamp = uint64(block.timestamp);
        emit PriceUpdated(newPrice, uint64(block.timestamp));
    }
}
