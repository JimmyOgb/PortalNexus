import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NexusAMM (Constant Product AMM & Enforceable LP Receipts)", () => {
  let amm: any;
  let receipt: any;
  let wpot: any;
  let usdc: any;
  let token0Addr: string;
  let token1Addr: string;

  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  beforeEach(async () => {
    [owner, alice, bob, charlie] = await ethers.getSigners();

    // Deploy tokens
    const WPotFactory = await ethers.getContractFactory("WPotToken");
    wpot = await WPotFactory.deploy();
    await wpot.waitForDeployment();

    const UsdcFactory = await ethers.getContractFactory("TestUSDC");
    usdc = await UsdcFactory.deploy();
    await usdc.waitForDeployment();

    // Fund accounts
    await wpot.connect(alice).deposit({ value: ethers.parseEther("100") });
    await wpot.connect(bob).deposit({ value: ethers.parseEther("50") });
    await wpot.connect(charlie).deposit({ value: ethers.parseEther("50") });

    await usdc.connect(alice).faucetMint(alice.address, 10_000n * 10n ** 6n);
    await usdc.connect(bob).faucetMint(bob.address, 10_000n * 10n ** 6n);
    await usdc.connect(charlie).faucetMint(charlie.address, 10_000n * 10n ** 6n);

    // Deploy AMM
    const AmmFactory = await ethers.getContractFactory("NexusAMM");
    amm = await AmmFactory.deploy(await wpot.getAddress(), await usdc.getAddress());
    await amm.waitForDeployment();

    token0Addr = await amm.token0();
    token1Addr = await amm.token1();

    const receiptAddr = await amm.receiptContract();
    receipt = await ethers.getContractAt("NexusLPReceipt", receiptAddr);

    // Approve tokens for AMM
    await wpot.connect(alice).approve(await amm.getAddress(), ethers.MaxUint256);
    await usdc.connect(alice).approve(await amm.getAddress(), ethers.MaxUint256);

    await wpot.connect(bob).approve(await amm.getAddress(), ethers.MaxUint256);
    await usdc.connect(bob).approve(await amm.getAddress(), ethers.MaxUint256);

    await wpot.connect(charlie).approve(await amm.getAddress(), ethers.MaxUint256);
    await usdc.connect(charlie).approve(await amm.getAddress(), ethers.MaxUint256);
  });

  describe("Initial Liquidity & Invariants", () => {
    it("locks MINIMUM_LIQUIDITY (1000 shares) and mints position receipt to first LP", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Provide 10 WPOT and 2000 pUSDC
      const isWpot0 = (await wpot.getAddress()).toLowerCase() === token0Addr.toLowerCase();
      const amount0 = isWpot0 ? ethers.parseEther("10") : 2_000n * 10n ** 6n;
      const amount1 = isWpot0 ? 2_000n * 10n ** 6n : ethers.parseEther("10");

      const tx = await amm.connect(alice).addLiquidity(amount0, amount1, 0, 0, deadline);
      await expect(tx).to.emit(amm, "LiquidityAdded");

      const [res0, res1] = await amm.getReserves();
      expect(res0).to.equal(amount0);
      expect(res1).to.equal(amount1);

      // Verify LP receipt was minted
      expect(await receipt.ownerOf(1n)).to.equal(alice.address);

      const totalShares = await amm.totalLiquidityShares();
      const pos = await receipt.getPosition(1n);

      expect(pos.shares).to.equal(totalShares - 1000n);
      expect(await amm.MINIMUM_LIQUIDITY()).to.equal(1000n);
    });

    it("reverts initial liquidity provision if minted shares are <= MINIMUM_LIQUIDITY", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Tiny amounts (1 wei * 1 wei = 1 <= 1000)
      await expect(
        amm.connect(alice).addLiquidity(100, 100, 0, 0, deadline)
      ).to.be.revertedWithCustomError(amm, "InsufficientLiquidityMinted");
    });
  });

  describe("Subsequent Liquidity Provision", () => {
    beforeEach(async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const isWpot0 = (await wpot.getAddress()).toLowerCase() === token0Addr.toLowerCase();
      const amount0 = isWpot0 ? ethers.parseEther("10") : 2_000n * 10n ** 6n;
      const amount1 = isWpot0 ? 2_000n * 10n ** 6n : ethers.parseEther("10");
      await amm.connect(alice).addLiquidity(amount0, amount1, 0, 0, deadline);
    });

    it("mints proportional shares for subsequent liquidity addition", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const [res0, res1] = await amm.getReserves();
      const halfAmount0 = res0 / 2n;
      const halfAmount1 = res1 / 2n;

      const totalSharesBefore = await amm.totalLiquidityShares();

      await expect(amm.connect(bob).addLiquidity(halfAmount0, halfAmount1, 0, 0, deadline))
        .to.emit(amm, "LiquidityAdded")
        .withArgs(bob.address, 2n, totalSharesBefore / 2n, halfAmount0, halfAmount1);

      expect(await receipt.ownerOf(2n)).to.equal(bob.address);
      expect(await amm.totalLiquidityShares()).to.equal(totalSharesBefore + (totalSharesBefore / 2n));
    });
  });

  describe("Swaps & Invariants", () => {
    beforeEach(async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const isWpot0 = (await wpot.getAddress()).toLowerCase() === token0Addr.toLowerCase();
      const amount0 = isWpot0 ? ethers.parseEther("10") : 2_000n * 10n ** 6n;
      const amount1 = isWpot0 ? 2_000n * 10n ** 6n : ethers.parseEther("10");
      await amm.connect(alice).addLiquidity(amount0, amount1, 0, 0, deadline);
    });

    it("executes exact token0 swap for token1 and verifies k growth from 0.3% fee", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const [res0Before, res1Before] = await amm.getReserves();
      const kBefore = res0Before * res1Before;

      const swapIn = res0Before / 10n; // Swap 10% of reserve0
      const quote = await amm.getAmountOut(swapIn, token0Addr);

      const bal1Before = await ethers.getContractAt("IERC20", token1Addr).then(c => c.balanceOf(charlie.address));

      await expect(
        amm.connect(charlie).swapExactTokensForTokens(token0Addr, swapIn, quote, charlie.address, deadline)
      )
        .to.emit(amm, "Swap")
        .withArgs(charlie.address, token0Addr, swapIn, quote, charlie.address);

      const bal1After = await ethers.getContractAt("IERC20", token1Addr).then(c => c.balanceOf(charlie.address));
      expect(bal1After - bal1Before).to.equal(quote);

      const [res0After, res1After] = await amm.getReserves();
      const kAfter = res0After * res1After;

      // Invariant: Because 0.3% fee is retained in reserves, k MUST increase
      expect(kAfter).to.be.greaterThan(kBefore);
    });

    it("reverts swap if output is less than minAmountOut (slippage protection)", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const [res0] = await amm.getReserves();
      const swapIn = res0 / 10n;
      const quote = await amm.getAmountOut(swapIn, token0Addr);

      const excessiveMinOut = quote + 1000n;

      await expect(
        amm.connect(charlie).swapExactTokensForTokens(token0Addr, swapIn, excessiveMinOut, charlie.address, deadline)
      ).to.be.revertedWithCustomError(amm, "SlippageExceeded");
    });

    it("reverts swap if deadline has expired", async () => {
      const expiredDeadline = (await ethers.provider.getBlock("latest"))!.timestamp - 1;
      const [res0] = await amm.getReserves();

      await expect(
        amm.connect(charlie).swapExactTokensForTokens(token0Addr, res0 / 10n, 1, charlie.address, expiredDeadline)
      ).to.be.revertedWithCustomError(amm, "DeadlineExpired");
    });

    it("reverts swap if input amount is zero", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      await expect(
        amm.connect(charlie).swapExactTokensForTokens(token0Addr, 0, 0, charlie.address, deadline)
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });
  });

  describe("Enforceable LP Receipts & Liquidity Removal", () => {
    let tokenId: bigint;
    let initialAmount0: bigint;
    let initialAmount1: bigint;

    beforeEach(async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const isWpot0 = (await wpot.getAddress()).toLowerCase() === token0Addr.toLowerCase();
      initialAmount0 = isWpot0 ? ethers.parseEther("10") : 2_000n * 10n ** 6n;
      initialAmount1 = isWpot0 ? 2_000n * 10n ** 6n : ethers.parseEther("10");

      const tx = await amm.connect(alice).addLiquidity(initialAmount0, initialAmount1, 0, 0, deadline);
      const rec = await tx.wait();
      tokenId = 1n;
    });

    it("burns the receipt NFT and returns proportional reserves to owner", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      const bal0Before = await ethers.getContractAt("IERC20", token0Addr).then(c => c.balanceOf(alice.address));
      const bal1Before = await ethers.getContractAt("IERC20", token1Addr).then(c => c.balanceOf(alice.address));

      await expect(
        amm.connect(alice).removeLiquidity(tokenId, 0, 0, alice.address, deadline)
      )
        .to.emit(amm, "LiquidityRemoved")
        .to.emit(receipt, "ReceiptBurned");

      const bal0After = await ethers.getContractAt("IERC20", token0Addr).then(c => c.balanceOf(alice.address));
      const bal1After = await ethers.getContractAt("IERC20", token1Addr).then(c => c.balanceOf(alice.address));

      expect(bal0After).to.be.greaterThan(bal0Before);
      expect(bal1After).to.be.greaterThan(bal1Before);

      // Receipt must be burned permanently
      await expect(receipt.ownerOf(tokenId)).to.be.revertedWithCustomError(
        receipt,
        "ERC721NonexistentToken"
      );
    });

    it("reverts if a non-owner attempts to remove liquidity with someone else's receipt", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Bob tries to redeem Alice's tokenId 1
      await expect(
        amm.connect(bob).removeLiquidity(tokenId, 0, 0, bob.address, deadline)
      )
        .to.be.revertedWithCustomError(amm, "NotReceiptOwner")
        .withArgs(bob.address, tokenId);
    });

    it("permanently prevents replay or double-withdrawal after receipt is burned", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // First withdrawal succeeds
      await amm.connect(alice).removeLiquidity(tokenId, 0, 0, alice.address, deadline);

      // Second withdrawal attempt with same tokenId must fail
      await expect(
        amm.connect(alice).removeLiquidity(tokenId, 0, 0, alice.address, deadline)
      ).to.be.revertedWithCustomError(receipt, "ERC721NonexistentToken");
    });

    it("transferring the receipt NFT legally transfers the underlying liquidity claim", async () => {
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Alice transfers receipt NFT to Bob
      await receipt.connect(alice).transferFrom(alice.address, bob.address, tokenId);
      expect(await receipt.ownerOf(tokenId)).to.equal(bob.address);

      // Alice can no longer redeem
      await expect(
        amm.connect(alice).removeLiquidity(tokenId, 0, 0, alice.address, deadline)
      ).to.be.revertedWithCustomError(amm, "NotReceiptOwner");

      // Bob can redeem Alice's former liquidity
      const bobBal0Before = await ethers.getContractAt("IERC20", token0Addr).then(c => c.balanceOf(bob.address));
      await expect(
        amm.connect(bob).removeLiquidity(tokenId, 0, 0, bob.address, deadline)
      ).to.emit(amm, "LiquidityRemoved");

      const bobBal0After = await ethers.getContractAt("IERC20", token0Addr).then(c => c.balanceOf(bob.address));
      expect(bobBal0After).to.be.greaterThan(bobBal0Before);
    });
  });
});
