// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./NexusLPReceipt.sol";

/**
 * @title NexusAMM
 * @notice Constant-Product Automated Market Maker (x * y = k) for PortalNexus.
 * @dev Enforces 0.30% swap fees, slippage and deadline protections, reentrancy guards,
 * and ERC-721 liquidity position receipts (NexusLPReceipt).
 * Every liquidity position is an enforceable claim on underlying pool reserves.
 */
contract NexusAMM is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public constant FEE_NUMERATOR = 997; // 0.3% fee

    IERC20 public immutable token0;
    IERC20 public immutable token1;
    NexusLPReceipt public immutable receiptContract;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalLiquidityShares;

    event LiquidityAdded(
        address indexed provider,
        uint256 indexed tokenId,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 indexed tokenId,
        uint256 shares,
        uint256 amount0,
        uint256 amount1,
        address indexed recipient
    );

    event Swap(
        address indexed sender,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );

    error DeadlineExpired(uint256 currentTimestamp, uint256 deadline);
    error IdenticalAddresses();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidity();
    error InsufficientLiquidityMinted();
    error SlippageExceeded(uint256 received, uint256 minimumExpected);
    error InvalidToken(address token);
    error NotReceiptOwner(address caller, uint256 tokenId);

    modifier checkDeadline(uint256 deadline) {
        if (block.timestamp > deadline) {
            revert DeadlineExpired(block.timestamp, deadline);
        }
        _;
    }

    constructor(address _tokenA, address _tokenB) {
        if (_tokenA == address(0) || _tokenB == address(0)) revert ZeroAddress();
        if (_tokenA == _tokenB) revert IdenticalAddresses();

        if (_tokenA < _tokenB) {
            token0 = IERC20(_tokenA);
            token1 = IERC20(_tokenB);
        } else {
            token0 = IERC20(_tokenB);
            token1 = IERC20(_tokenA);
        }

        // Deploy receipt contract with this AMM as exclusive authority
        receiptContract = new NexusLPReceipt(address(this));
    }

    /**
     * @notice Provide liquidity and receive an ERC-721 position receipt.
     */
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 minAmount0,
        uint256 minAmount1,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 tokenId, uint256 shares, uint256 amount0, uint256 amount1) {
        if (amount0Desired == 0 || amount1Desired == 0) revert ZeroAmount();

        if (totalLiquidityShares == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;

            uint256 initialShares = Math.sqrt(amount0 * amount1);
            if (initialShares <= MINIMUM_LIQUIDITY) revert InsufficientLiquidityMinted();

            shares = initialShares - MINIMUM_LIQUIDITY;
            totalLiquidityShares = initialShares; // MINIMUM_LIQUIDITY permanently locked
        } else {
            uint256 optimalAmount1 = (amount0Desired * reserve1) / reserve0;
            if (optimalAmount1 <= amount1Desired) {
                if (optimalAmount1 < minAmount1) revert SlippageExceeded(optimalAmount1, minAmount1);
                amount0 = amount0Desired;
                amount1 = optimalAmount1;
            } else {
                uint256 optimalAmount0 = (amount1Desired * reserve0) / reserve1;
                if (optimalAmount0 > amount0Desired) revert SlippageExceeded(optimalAmount0, amount0Desired);
                if (optimalAmount0 < minAmount0) revert SlippageExceeded(optimalAmount0, minAmount0);
                amount0 = optimalAmount0;
                amount1 = amount1Desired;
            }

            uint256 shares0 = (amount0 * totalLiquidityShares) / reserve0;
            uint256 shares1 = (amount1 * totalLiquidityShares) / reserve1;
            shares = Math.min(shares0, shares1);
            if (shares == 0) revert InsufficientLiquidityMinted();

            totalLiquidityShares += shares;
        }

        token0.safeTransferFrom(msg.sender, address(this), amount0);
        token1.safeTransferFrom(msg.sender, address(this), amount1);

        reserve0 += amount0;
        reserve1 += amount1;

        tokenId = receiptContract.mintReceipt(msg.sender, shares, amount0, amount1);

        emit LiquidityAdded(msg.sender, tokenId, shares, amount0, amount1);
    }

    /**
     * @notice Redeem an ERC-721 position receipt for underlying liquidity.
     */
    function removeLiquidity(
        uint256 tokenId,
        uint256 minAmount0,
        uint256 minAmount1,
        address to,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 amount0, uint256 amount1) {
        if (to == address(0)) revert ZeroAddress();
        if (receiptContract.ownerOf(tokenId) != msg.sender) {
            revert NotReceiptOwner(msg.sender, tokenId);
        }

        (, uint256 shares, , , ) = receiptContract.getPosition(tokenId);
        if (shares == 0) revert ZeroAmount();

        amount0 = (shares * reserve0) / totalLiquidityShares;
        amount1 = (shares * reserve1) / totalLiquidityShares;

        if (amount0 < minAmount0) revert SlippageExceeded(amount0, minAmount0);
        if (amount1 < minAmount1) revert SlippageExceeded(amount1, minAmount1);
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidity();

        reserve0 -= amount0;
        reserve1 -= amount1;
        totalLiquidityShares -= shares;

        // Burn receipt to permanently prevent double-redemption
        receiptContract.burnReceipt(tokenId);

        token0.safeTransfer(to, amount0);
        token1.safeTransfer(to, amount1);

        emit LiquidityRemoved(msg.sender, tokenId, shares, amount0, amount1, to);
    }

    /**
     * @notice Swap an exact amount of input tokens for output tokens with slippage protection.
     */
    function swapExactTokensForTokens(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address to,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 amountOut) {
        if (to == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();

        bool isToken0 = tokenIn == address(token0);
        if (!isToken0 && tokenIn != address(token1)) revert InvalidToken(tokenIn);

        {
            uint256 reserveIn = isToken0 ? reserve0 : reserve1;
            uint256 reserveOut = isToken0 ? reserve1 : reserve0;
            if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

            uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
            uint256 numerator = amountInWithFee * reserveOut;
            uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
            amountOut = numerator / denominator;

            if (amountOut < minAmountOut) revert SlippageExceeded(amountOut, minAmountOut);
            if (amountOut >= reserveOut) revert InsufficientLiquidity();
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        if (isToken0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
            token1.safeTransfer(to, amountOut);
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
            token0.safeTransfer(to, amountOut);
        }

        emit Swap(msg.sender, tokenIn, amountIn, amountOut, to);
    }

    /**
     * @notice View function to get current reserves.
     */
    function getReserves() external view returns (uint256 _reserve0, uint256 _reserve1) {
        return (reserve0, reserve1);
    }

    /**
     * @notice Quote the output amount for a given input.
     */
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        bool isToken0 = tokenIn == address(token0);
        if (!isToken0 && tokenIn != address(token1)) revert InvalidToken(tokenIn);

        (uint256 reserveIn, uint256 reserveOut) = isToken0 ? (reserve0, reserve1) : (reserve1, reserve0);
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        return numerator / denominator;
    }
}
