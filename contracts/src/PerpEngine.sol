// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockPriceFeed} from "./MockPriceFeed.sol";

contract PerpEngine is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Precision ──────────────────────────────────────────────────────────
    uint256 public constant PRICE_PRECISION = 1e18;
    // sizeTokens(1e18) * price(1e18) / TOKEN_TO_USDC → USDC(1e6)
    uint256 public constant TOKEN_TO_USDC   = 1e30;

    uint256 public constant BPS_DENOM                = 10_000;
    uint256 public constant INITIAL_MARGIN_BPS       = 1_000; // 10% → max 10x leverage
    uint256 public constant MAINTENANCE_MARGIN_BPS   = 500;   // 5%  → liquidation threshold
    uint256 public constant OPEN_CLOSE_FEE_BPS       = 10;    // 0.10%
    uint256 public constant LIQUIDATION_BONUS_BPS    = 50;    // 0.50%
    uint8   public constant MAX_LEVERAGE             = 10;
    uint8   public constant MIN_LEVERAGE             = 1;
    uint256 public constant MIN_COLLATERAL           = 10 * 1e6; // 10 mUSDC

    // ── Types ──────────────────────────────────────────────────────────────
    struct Position {
        address trader;
        bool    isLong;
        uint128 collateral;       // mUSDC 1e6 (after open fee deducted)
        uint8   leverage;
        uint128 notional;         // mUSDC 1e6 = collateral * leverage
        uint256 sizeTokens;       // 1e18 base-token units
        uint256 entryPrice;       // 1e18
        uint256 liquidationPrice; // 1e18 (cached at open)
        uint64  openedAt;
        bool    isOpen;
    }

    // ── Storage ────────────────────────────────────────────────────────────
    IERC20       public immutable collateralToken;
    MockPriceFeed public immutable priceFeed;

    uint256 public nextPositionId;
    uint256 public insuranceFund; // mUSDC 1e6

    mapping(uint256 => Position)   public positions;
    mapping(address => uint256[])  private _traderPositions;

    // ordered list of open position ids for pagination
    uint256[] private _openPositionIds;
    mapping(uint256 => uint256) private _openPositionIndex; // id → index+1 (0=not present)

    // ── Events ─────────────────────────────────────────────────────────────
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        bool    isLong,
        uint256 collateral,
        uint8   leverage,
        uint256 notional,
        uint256 sizeTokens,
        uint256 entryPrice,
        uint256 liquidationPrice,
        uint256 fee
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 exitPrice,
        int256  pnl,
        uint256 payout,
        uint256 fee
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed trader,
        address indexed liquidator,
        uint256 markPrice,
        uint256 bonus,
        uint256 remaining
    );
    event InsuranceFundChanged(int256 delta, uint256 newBalance);

    // ── Constructor ────────────────────────────────────────────────────────
    constructor(address _collateralToken, address _priceFeed, address _owner)
        Ownable(_owner)
    {
        require(_collateralToken != address(0), "PerpEngine: zero collateral");
        require(_priceFeed != address(0),       "PerpEngine: zero priceFeed");
        collateralToken = IERC20(_collateralToken);
        priceFeed       = MockPriceFeed(_priceFeed);
    }

    // ── Owner helpers ──────────────────────────────────────────────────────

    /// @notice Seed the insurance fund (deployer deposits mUSDC as backstop).
    function seedInsuranceFund(uint256 amount) external onlyOwner {
        require(amount > 0, "PerpEngine: zero amount");
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        insuranceFund += amount;
        emit InsuranceFundChanged(int256(amount), insuranceFund);
    }

    /// @notice Allow anyone to donate to the insurance fund.
    function donate(uint256 amount) external {
        require(amount > 0, "PerpEngine: zero amount");
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        insuranceFund += amount;
        emit InsuranceFundChanged(int256(amount), insuranceFund);
    }

    // ── Core write API ─────────────────────────────────────────────────────

    /// @notice Open a long or short position.
    /// @param collateralAmount  mUSDC to deposit (fee deducted from this)
    /// @param leverage          1..10
    /// @param isLong            true = long, false = short
    function openPosition(uint256 collateralAmount, uint8 leverage, bool isLong)
        external nonReentrant returns (uint256 positionId)
    {
        require(leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE, "PerpEngine: bad leverage");
        require(collateralAmount >= MIN_COLLATERAL, "PerpEngine: collateral too low");

        uint256 price = priceFeed.latestPrice();
        require(price > 0, "PerpEngine: price is zero");

        // fee = 0.10% of (collateral * leverage)
        uint256 grossNotional = collateralAmount * uint256(leverage);
        uint256 fee = (grossNotional * OPEN_CLOSE_FEE_BPS) / BPS_DENOM;
        require(collateralAmount > fee, "PerpEngine: fee exceeds collateral");

        uint256 netCollateral = collateralAmount - fee;
        uint256 netNotional   = netCollateral * uint256(leverage);
        uint256 sizeTokens    = _notionalToSize(netNotional, price);
        require(sizeTokens > 0, "PerpEngine: size is zero");

        uint256 liqPrice = _calcLiquidationPrice(isLong, price, leverage);

        positionId = ++nextPositionId;
        positions[positionId] = Position({
            trader:           msg.sender,
            isLong:           isLong,
            collateral:       uint128(netCollateral),
            leverage:         leverage,
            notional:         uint128(netNotional),
            sizeTokens:       sizeTokens,
            entryPrice:       price,
            liquidationPrice: liqPrice,
            openedAt:         uint64(block.timestamp),
            isOpen:           true
        });
        _traderPositions[msg.sender].push(positionId);
        _openPositionIds.push(positionId);
        _openPositionIndex[positionId] = _openPositionIds.length; // 1-indexed

        insuranceFund += fee;
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);

        emit PositionOpened(
            positionId, msg.sender, isLong,
            netCollateral, leverage, netNotional,
            sizeTokens, price, liqPrice, fee
        );
        emit InsuranceFundChanged(int256(fee), insuranceFund);
    }

    /// @notice Close an open position. Caller must be the position owner.
    function closePosition(uint256 positionId) external nonReentrant {
        Position storage p = positions[positionId];
        require(p.isOpen,               "PerpEngine: not open");
        require(p.trader == msg.sender, "PerpEngine: not owner");

        uint256 exitPrice = priceFeed.latestPrice();
        require(!_isLiquidatableAt(p, exitPrice), "PerpEngine: liquidatable");
        int256  pnl       = _calcPnl(p, exitPrice);

        // close fee: 0.10% of exit notional
        uint256 exitNotional = _sizeToNotional(p.sizeTokens, exitPrice);
        uint256 fee = (exitNotional * OPEN_CLOSE_FEE_BPS) / BPS_DENOM;

        int256 equity = int256(uint256(p.collateral)) + pnl - int256(fee);
        uint256 payout = equity > 0 ? uint256(equity) : 0;

        if (equity < 0) {
            uint256 shortfall = uint256(-equity);
            if (shortfall <= insuranceFund) {
                insuranceFund -= shortfall;
            } else {
                insuranceFund = 0;
            }
            emit InsuranceFundChanged(-int256(shortfall), insuranceFund);
        } else {
            insuranceFund += fee;
            emit InsuranceFundChanged(int256(fee), insuranceFund);
        }

        _removeOpenPosition(positionId);
        p.isOpen = false;

        if (payout > 0) collateralToken.safeTransfer(msg.sender, payout);

        emit PositionClosed(positionId, msg.sender, exitPrice, pnl, payout, fee);
    }

    /// @notice Liquidate an under-margined position. Permissionless — caller receives bonus.
    function liquidate(uint256 positionId) external nonReentrant {
        Position storage p = positions[positionId];
        require(p.isOpen, "PerpEngine: not open");

        uint256 mark = priceFeed.latestPrice();
        require(_isLiquidatableAt(p, mark), "PerpEngine: not liquidatable");

        int256  pnl    = _calcPnl(p, mark);
        // bonus = 0.50% of opening notional
        uint256 bonus  = (uint256(p.notional) * LIQUIDATION_BONUS_BPS) / BPS_DENOM;
        int256  equity = int256(uint256(p.collateral)) + pnl;

        uint256 actualBonus;
        uint256 remaining;

        if (equity <= 0) {
            // Position is fully insolvent; insurance fund covers shortfall
            actualBonus = 0;
            remaining   = 0;
            uint256 shortfall = uint256(-equity);
            if (shortfall <= insuranceFund) {
                insuranceFund -= shortfall;
            } else {
                insuranceFund = 0;
            }
            emit InsuranceFundChanged(-int256(shortfall), insuranceFund);
        } else if (uint256(equity) <= bonus) {
            // Equity exists but less than full bonus; liquidator gets all of it
            actualBonus = uint256(equity);
            remaining   = 0;
        } else {
            actualBonus = bonus;
            remaining   = uint256(equity) - bonus;
        }

        _removeOpenPosition(positionId);
        p.isOpen = false;

        if (actualBonus > 0) collateralToken.safeTransfer(msg.sender, actualBonus);
        if (remaining   > 0) collateralToken.safeTransfer(p.trader,   remaining);

        emit PositionLiquidated(positionId, p.trader, msg.sender, mark, actualBonus, remaining);
    }

    // ── View API ───────────────────────────────────────────────────────────

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function getTraderPositions(address trader) external view returns (uint256[] memory) {
        return _traderPositions[trader];
    }

    /// @notice Returns a paginated slice of currently-open position IDs.
    function getOpenPositionIds(uint256 offset, uint256 limit)
        external view returns (uint256[] memory ids, uint256 total)
    {
        total = _openPositionIds.length;
        uint256 end = offset + limit > total ? total : offset + limit;
        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _openPositionIds[i];
        }
    }

    function isLiquidatable(uint256 positionId) external view returns (bool) {
        Position storage p = positions[positionId];
        if (!p.isOpen) return false;
        return _isLiquidatableAt(p, priceFeed.latestPrice());
    }

    function calcPnl(uint256 positionId, uint256 atPrice) external view returns (int256) {
        return _calcPnl(positions[positionId], atPrice);
    }

    function calcLiquidationPrice(bool isLong, uint256 entryPrice, uint8 leverage)
        external pure returns (uint256)
    {
        return _calcLiquidationPrice(isLong, entryPrice, leverage);
    }

    // ── Internal math ──────────────────────────────────────────────────────

    /// @dev notional (mUSDC 1e6) → size (tokens 1e18) given price (1e18)
    function _notionalToSize(uint256 notionalUsdc, uint256 price) internal pure returns (uint256) {
        return (notionalUsdc * TOKEN_TO_USDC) / price;
    }

    /// @dev size (tokens 1e18) * price (1e18) → notional (mUSDC 1e6)
    function _sizeToNotional(uint256 sizeTokens, uint256 price) internal pure returns (uint256) {
        return (sizeTokens * price) / TOKEN_TO_USDC;
    }

    /// @dev Liquidation price formula:
    ///   factor18 = (1/L − MM%) in 1e18
    ///   LONG:  liqPrice = entry − entry*factor18/1e18
    ///   SHORT: liqPrice = entry + entry*factor18/1e18
    function _calcLiquidationPrice(bool isLong, uint256 entryPrice, uint8 leverage)
        internal pure returns (uint256)
    {
        uint256 invLev18 = PRICE_PRECISION / uint256(leverage);
        uint256 mm18     = (MAINTENANCE_MARGIN_BPS * PRICE_PRECISION) / BPS_DENOM;
        uint256 factor18 = invLev18 - mm18; // always positive for leverage ≤ 10 and MM=5%
        uint256 delta    = (entryPrice * factor18) / PRICE_PRECISION;
        return isLong ? entryPrice - delta : entryPrice + delta;
    }

    /// @dev Returns signed PnL in mUSDC 1e6.
    function _calcPnl(Position storage p, uint256 markPrice)
        internal view returns (int256)
    {
        bool    priceUp  = markPrice >= p.entryPrice;
        uint256 absDelta = priceUp
            ? markPrice - p.entryPrice
            : p.entryPrice - markPrice;
        // absPnl = sizeTokens * absDelta / TOKEN_TO_USDC
        uint256 absPnl = (p.sizeTokens * absDelta) / TOKEN_TO_USDC;
        bool    positive = p.isLong ? priceUp : !priceUp;
        return positive ? int256(absPnl) : -int256(absPnl);
    }

    function _isLiquidatableAt(Position storage p, uint256 mark)
        internal view returns (bool)
    {
        return p.isLong
            ? mark <= p.liquidationPrice
            : mark >= p.liquidationPrice;
    }

    // ── Internal position set management ──────────────────────────────────

    function _removeOpenPosition(uint256 positionId) internal {
        uint256 idx = _openPositionIndex[positionId];
        if (idx == 0) return; // not in set
        uint256 last = _openPositionIds[_openPositionIds.length - 1];
        _openPositionIds[idx - 1] = last;
        _openPositionIndex[last] = idx;
        _openPositionIds.pop();
        delete _openPositionIndex[positionId];
    }
}
