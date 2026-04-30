// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Demo ERC-20 collateral token with a public faucet. NOT for production.
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    mapping(address => uint256) public lastFaucet;

    event Minted(address indexed to, uint256 amount);
    event FaucetUsed(address indexed by, uint256 amount);

    constructor(address initialOwner)
        ERC20("Mock USDC", "mUSDC")
        Ownable(initialOwner)
    {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice Self-service faucet: 1 000 mUSDC, once every 24 hours per address.
    function faucet() external {
        require(block.timestamp >= lastFaucet[msg.sender] + 1 days, "Faucet: too soon");
        lastFaucet[msg.sender] = block.timestamp;
        uint256 amount = 1_000 * 10 ** DECIMALS;
        _mint(msg.sender, amount);
        emit FaucetUsed(msg.sender, amount);
    }
}
