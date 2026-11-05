import { expect } from "chai";
import { ethers } from "hardhat";

describe("NexusAMMNativeV2 first-liquidity safety and economics", () => {
  let token: any;
  let amm: any;
  let lp: any;
  let trader: any;
  const pot = (n: string) => ethers.parseEther(n);
  const usdc = (n: bigint) => n * 10n ** 6n;

  async function deadline() {
    return (await ethers.provider.getBlock("latest"))!.timestamp + 600;
  }

  async function deploy() {
    [lp, trader] = await ethers.getSigners();
    token = await (await ethers.getContractFactory("TestUSDCMin")).deploy();
    await token.waitForDeployment();
    amm = await (await ethers.getContractFactory("NexusAMMNativeV2")).deploy(await token.getAddress());
    await amm.waitForDeployment();
    await token.faucetMint(lp.address, usdc(500n));
    await token.faucetMint(trader.address, usdc(10n));
    await token.approve(await amm.getAddress(), usdc(500n));
  }

  beforeEach(deploy);

  it("rejects zero minimums on the first deposit", async () => {
    await expect(amm.addLiquidity(usdc(100n), 0, usdc(99n), await deadline(), { value: pot("1") }))
      .to.be.revertedWithCustomError(amm, "InvalidMinimumAmounts");
    await expect(amm.addLiquidity(usdc(100n), pot("0.99"), 0, await deadline(), { value: pot("1") }))
      .to.be.revertedWithCustomError(amm, "InvalidMinimumAmounts");
  });

  it("enforces both initial contribution bounds and issues an LP receipt", async () => {
    await expect(amm.addLiquidity(usdc(100n), pot("1.01"), usdc(99n), await deadline(), { value: pot("1") }))
      .to.be.revertedWithCustomError(amm, "InvalidMinimumAmounts");
    await expect(amm.addLiquidity(usdc(100n), pot("0.99"), usdc(100_000_001n), await deadline(), { value: pot("1") }))
      .to.be.revertedWithCustomError(amm, "InvalidMinimumAmounts");

    await expect(amm.addLiquidity(usdc(100n), pot("0.99"), usdc(99n), await deadline(), { value: pot("1") }))
      .to.emit(amm, "LiquidityAdded")
      .withArgs(lp.address, 1n, 10n ** 13n - 1000n, pot("1"), usdc(100n));
    expect(await amm.ownerOf(1)).to.equal(lp.address);
    expect(await amm.balanceOf(lp.address)).to.equal(1n);
    expect(await amm.totalLiquidityShares()).to.equal(10n ** 13n);
  });

  it("rejects zero deposits, dust liquidity, and expired deadlines", async () => {
    const d = await deadline();
    await expect(amm.addLiquidity(usdc(100n), 1, 1, d, { value: 0 })).to.be.reverted;
    await expect(amm.addLiquidity(1, 1, 1, d, { value: 1 }))
      .to.be.revertedWithCustomError(amm, "InsufficientLiquidityMinted");
    await expect(amm.addLiquidity(usdc(100n), pot("0.99"), usdc(99n), 1, { value: pot("1") }))
      .to.be.reverted;
  });

  it("keeps subsequent liquidity within both minimums and the existing ratio", async () => {
    await amm.addLiquidity(usdc(100n), pot("0.99"), usdc(99n), await deadline(), { value: pot("1") });
    await token.connect(trader).approve(await amm.getAddress(), usdc(10n));
    await expect(amm.connect(trader).addLiquidity(usdc(10n), pot("0.101"), usdc(9n), await deadline(), { value: pot("0.1") }))
      .to.be.revertedWithCustomError(amm, "InvalidMinimumAmounts");
    await expect(amm.connect(trader).addLiquidity(usdc(10n), pot("0.099"), usdc(9n), await deadline(), { value: pot("0.1") }))
      .to.emit(amm, "LiquidityAdded");
    const [rPot, rUsdc] = await amm.getReserves();
    expect(rPot).to.equal(pot("1.1"));
    expect(rUsdc).to.equal(usdc(110n));
    expect(await amm.ownerOf(2)).to.equal(trader.address);
  });

  it("applies the 0.3% fee, updates reserves, and enforces output slippage", async () => {
    await amm.addLiquidity(usdc(100n), pot("0.99"), usdc(99n), await deadline(), { value: pot("1") });
    const amountIn = pot("0.01");
    const amountOut = (amountIn * 997n * usdc(100n)) / (pot("1") * 1000n + amountIn * 997n);
    const minOut = amountOut * 9950n / 10000n;
    const balanceBefore = await token.balanceOf(trader.address);
    await expect(amm.connect(trader).swapExactPOTForTokens(amountOut + 1n, trader.address, await deadline(), { value: amountIn }))
      .to.be.reverted;
    await expect(amm.connect(trader).swapExactPOTForTokens(minOut, trader.address, await deadline(), { value: amountIn }))
      .to.emit(amm, "Swap").withArgs(trader.address, ethers.ZeroAddress, amountIn, amountOut, trader.address);
    expect(await token.balanceOf(trader.address)).to.equal(balanceBefore + amountOut);
    const [rPot, rUsdc] = await amm.getReserves();
    expect(rPot).to.equal(pot("1") + amountIn);
    expect(rUsdc).to.equal(usdc(100n) - amountOut);
    expect(rPot * rUsdc).to.be.greaterThan(pot("1") * usdc(100n));
  });

  it("rejects swaps against an empty pool and burns the LP position on withdrawal", async () => {
    await expect(amm.connect(trader).swapExactPOTForTokens(1, trader.address, await deadline(), { value: 1 }))
      .to.be.reverted;
    await amm.addLiquidity(usdc(100n), pot("0.99"), usdc(99n), await deadline(), { value: pot("1") });
    await expect(amm.removeLiquidity(1, 1, 1, lp.address, await deadline()))
      .to.emit(amm, "LiquidityRemoved").and.to.emit(amm, "Transfer");
    expect(await amm.ownerOf(1)).to.equal(ethers.ZeroAddress);
    expect(await amm.balanceOf(lp.address)).to.equal(0n);
    expect(await amm.totalLiquidityShares()).to.equal(1000n);
  });
});
