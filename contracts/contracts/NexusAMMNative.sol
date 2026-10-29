// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title NexusAMMNative
 * @notice Constant-Product AMM (x * y = k, 0.3% fee) pairing Native POT directly with pUSDC.
 * @dev Enforces 0.30% swap fees, slippage and deadline protections, reentrancy guards,
 * and unified ERC-721 position receipt tracking.
 * Eliminates WPotToken to achieve low deployment costs on Portaldot V3.
 */
contract NexusAMMNative {
    struct Position {
        address pool;
        uint256 shares;
        uint256 potDeposited;
        uint256 usdcDeposited;
        uint256 timestamp;
    }

    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    address public immutable usdc;

    uint256 public reservePOT;
    uint256 public reserveUSDC;
    uint256 public totalLiquidityShares;

    uint256 private _nextTokenId = 1;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => Position) private _positions;

    uint256 private _locked = 1;

    event LiquidityAdded(address indexed provider, uint256 indexed tokenId, uint256 shares, uint256 amountPOT, uint256 amountUSDC);
    event LiquidityRemoved(address indexed provider, uint256 indexed tokenId, uint256 shares, uint256 amountPOT, uint256 amountUSDC, address indexed recipient);
    event Swap(address indexed sender, address indexed tokenIn, uint256 amountIn, uint256 amountOut, address indexed to);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier nonReentrant() {
        require(_locked == 1);
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline);
        _;
    }

    constructor(address _usdc) {
        require(_usdc != address(0));
        usdc = _usdc;
    }

    function receiptContract() external view returns (address) {
        return address(this);
    }

    function addLiquidity(
        uint256 amountUSDCDesired,
        uint256 minAmountPOT,
        uint256 minAmountUSDC,
        uint256 deadline
    ) external payable nonReentrant checkDeadline(deadline) returns (uint256 tokenId, uint256 shares, uint256 amountPOT, uint256 amountUSDC) {
        amountPOT = msg.value;
        require(amountPOT > 0 && amountUSDCDesired > 0);

        uint256 refund = 0;
        if (totalLiquidityShares == 0) {
            amountUSDC = amountUSDCDesired;
            shares = _sqrt(amountPOT * amountUSDC) - MINIMUM_LIQUIDITY;
            totalLiquidityShares = shares + MINIMUM_LIQUIDITY;
        } else {
            uint256 optimalUSDC = (amountPOT * reserveUSDC) / reservePOT;
            if (optimalUSDC <= amountUSDCDesired) {
                require(optimalUSDC >= minAmountUSDC);
                amountUSDC = optimalUSDC;
            } else {
                uint256 optimalPOT = (amountUSDCDesired * reservePOT) / reserveUSDC;
                require(optimalPOT <= amountPOT && optimalPOT >= minAmountPOT);
                refund = amountPOT - optimalPOT;
                amountPOT = optimalPOT;
                amountUSDC = amountUSDCDesired;
            }

            uint256 s0 = (amountPOT * totalLiquidityShares) / reservePOT;
            uint256 s1 = (amountUSDC * totalLiquidityShares) / reserveUSDC;
            shares = s0 < s1 ? s0 : s1;
            totalLiquidityShares += shares;
        }
        require(shares > 0);

        reservePOT += amountPOT;
        reserveUSDC += amountUSDC;

        tokenId = _nextTokenId++;
        ownerOf[tokenId] = msg.sender;
        balanceOf[msg.sender]++;
        _positions[tokenId] = Position(address(this), shares, amountPOT, amountUSDC, block.timestamp);

        _transferFrom(usdc, msg.sender, address(this), amountUSDC);
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok);
        }

        emit Transfer(address(0), msg.sender, tokenId);
        emit LiquidityAdded(msg.sender, tokenId, shares, amountPOT, amountUSDC);
    }

    function removeLiquidity(
        uint256 tokenId,
        uint256 minAmountPOT,
        uint256 minAmountUSDC,
        address to,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 amountPOT, uint256 amountUSDC) {
        require(ownerOf[tokenId] == msg.sender && to != address(0));

        uint256 shares = _positions[tokenId].shares;
        amountPOT = (shares * reservePOT) / totalLiquidityShares;
        amountUSDC = (shares * reserveUSDC) / totalLiquidityShares;
        require(amountPOT >= minAmountPOT && amountUSDC >= minAmountUSDC && amountPOT > 0 && amountUSDC > 0);

        reservePOT -= amountPOT;
        reserveUSDC -= amountUSDC;
        totalLiquidityShares -= shares;

        delete _positions[tokenId];
        delete ownerOf[tokenId];
        balanceOf[msg.sender]--;

        emit Transfer(msg.sender, address(0), tokenId);

        (bool ok, ) = to.call{value: amountPOT}("");
        require(ok);
        _transfer(usdc, to, amountUSDC);

        emit LiquidityRemoved(msg.sender, tokenId, shares, amountPOT, amountUSDC, to);
    }

    function swapExactPOTForTokens(uint256 minAmountOut, address to, uint256 deadline) external payable nonReentrant checkDeadline(deadline) returns (uint256 amountOut) {
        uint256 amountIn = msg.value;
        require(amountIn > 0 && to != address(0) && reservePOT > 0 && reserveUSDC > 0);

        uint256 inWithFee = amountIn * 997;
        amountOut = (inWithFee * reserveUSDC) / ((reservePOT * 1000) + inWithFee);
        require(amountOut >= minAmountOut && amountOut < reserveUSDC);

        reservePOT += amountIn;
        reserveUSDC -= amountOut;
        _transfer(usdc, to, amountOut);

        emit Swap(msg.sender, address(0), amountIn, amountOut, to);
    }

    function swapExactTokensForPOT(uint256 amountIn, uint256 minAmountOut, address to, uint256 deadline) external nonReentrant checkDeadline(deadline) returns (uint256 amountOut) {
        require(amountIn > 0 && to != address(0) && reservePOT > 0 && reserveUSDC > 0);

        uint256 inWithFee = amountIn * 997;
        amountOut = (inWithFee * reservePOT) / ((reserveUSDC * 1000) + inWithFee);
        require(amountOut >= minAmountOut && amountOut < reservePOT);

        _transferFrom(usdc, msg.sender, address(this), amountIn);

        reserveUSDC += amountIn;
        reservePOT -= amountOut;
        (bool ok, ) = to.call{value: amountOut}("");
        require(ok);

        emit Swap(msg.sender, usdc, amountIn, amountOut, to);
    }

    function getPosition(uint256 tokenId) external view returns (address, uint256, uint256, uint256, uint256) {
        Position memory p = _positions[tokenId];
        return (p.pool, p.shares, p.potDeposited, p.usdcDeposited, p.timestamp);
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reservePOT, reserveUSDC);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _transfer(address token, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))));
    }

    function _transferFrom(address token, address from, address to, uint256 value) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))));
    }
}
