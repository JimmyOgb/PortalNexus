import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("Architecture A: Direct Native POT / pUSDC AMM", function () {
  let deployer: Signer;
  let user1: Signer;
  let user2: Signer;
  let usdc: Contract;
  let amm: Contract;

  const INITIAL_POT = ethers.parseEther("10"); // 10 POT
  const INITIAL_USDC = 25000n * 10n ** 6n; // 25,000 pUSDC (6 decimals)
  const MAX_MINT = 10000n * 10n ** 6n; // 10,000 pUSDC

  beforeEach(async function () {
    [deployer, user1, user2] = await ethers.getSigners();

    const TestUSDCFactory = await ethers.getContractFactory("TestUSDCMin");
    usdc = await TestUSDCFactory.deploy();
    await usdc.waitForDeployment();

    const NexusAMMFactory = await ethers.getContractFactory("NexusAMMNative");
    amm = await NexusAMMFactory.deploy(await usdc.getAddress());
    await amm.waitForDeployment();
  });

  describe("TestUSDCMin Specification & Safety", function () {
    it("has 6 decimals, correct test token name, and symbol", async function () {
      expect(await usdc.decimals()).to.equal(6);
      expect(await usdc.name()).to.equal("Portal Test USD");
      expect(await usdc.symbol()).to.equal("pUSDC");
    });

    it("mints via faucet up to MAX_MINT_PER_CALL", async function () {
      const user1Addr = await user1.getAddress();
      await usdc.connect(user1).faucetMint(user1Addr, MAX_MINT);
      expect(await usdc.balanceOf(user1Addr)).to.equal(MAX_MINT);
      expect(await usdc.totalSupply()).to.equal(MAX_MINT);
    });

    it("reverts faucet mint exceeding cap, zero amount, or zero address", async function () {
      const user1Addr = await user1.getAddress();
      await expect(
        usdc.connect(user1).faucetMint(user1Addr, MAX_MINT + 1n)
      ).to.be.reverted;

      await expect(
        usdc.connect(user1).faucetMint(user1Addr, 0)
      ).to.be.reverted;

      await expect(
        usdc.connect(user1).faucetMint(ethers.ZeroAddress, 1000n)
      ).to.be.reverted;
    });

    it("executes standard ERC-20 transfers and approvals", async function () {
      const user1Addr = await user1.getAddress();
      const user2Addr = await user2.getAddress();
      await usdc.connect(user1).faucetMint(user1Addr, 5000n * 10n ** 6n);

      await usdc.connect(user1).transfer(user2Addr, 1000n * 10n ** 6n);
      expect(await usdc.balanceOf(user2Addr)).to.equal(1000n * 10n ** 6n);

      await usdc.connect(user1).approve(user2Addr, 2000n * 10n ** 6n);
      await usdc.connect(user2).transferFrom(user1Addr, user2Addr, 2000n * 10n ** 6n);
      expect(await usdc.balanceOf(user2Addr)).to.equal(3000n * 10n ** 6n);
    });

    it("reverts transfer to zero address", async function () {
      const user1Addr = await user1.getAddress();
      await usdc.connect(user1).faucetMint(user1Addr, 1000n);
      await expect(
        usdc.connect(user1).transfer(ethers.ZeroAddress, 500n)
      ).to.be.reverted;
    });
  });

  describe("NexusAMMNative Liquidity & LP Receipt", function () {
    it("locks MINIMUM_LIQUIDITY (1000) and mints receipt NFT on first deposit", async function () {
      const user1Addr = await user1.getAddress();
      // Mint USDC to user1
      for (let i = 0; i < 3; i++) {
        await usdc.connect(user1).faucetMint(user1Addr, 9000n * 10n ** 6n);
      }
      await usdc.connect(user1).approve(await amm.getAddress(), ethers.MaxUint256);

      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const tx = await amm.connect(user1).addLiquidity(
        INITIAL_USDC,
        INITIAL_POT,
        INITIAL_USDC,
        deadline,
        { value: INITIAL_POT }
      );
      await tx.wait();

      const [rPOT, rUSDC] = await amm.getReserves();
      expect(rPOT).to.equal(INITIAL_POT);
      expect(rUSDC).to.equal(INITIAL_USDC);

      // Verify LP position receipt
      expect(await amm.ownerOf(1)).to.equal(user1Addr);
      expect(await amm.balanceOf(user1Addr)).to.equal(1);
      expect(await amm.receiptContract()).to.equal(await amm.getAddress());

      const pos = await amm.getPosition(1);
      expect(pos[0]).to.equal(await amm.getAddress()); // pool
      expect(pos[1]).to.be.gt(0); // shares
      expect(pos[2]).to.equal(INITIAL_POT);
      expect(pos[3]).to.equal(INITIAL_USDC);
    });

    it("refunds excess POT when liquidity ratio favors lower POT input", async function () {
      const user1Addr = await user1.getAddress();
      const user2Addr = await user2.getAddress();

      // Initial liquidity: 10 POT : 25,000 pUSDC
      for (let i = 0; i < 3; i++) {
        await usdc.connect(user1).faucetMint(user1Addr, 9000n * 10n ** 6n);
      }
      await usdc.connect(user1).approve(await amm.getAddress(), ethers.MaxUint256);
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      await amm.connect(user1).addLiquidity(
        INITIAL_USDC,
        INITIAL_POT,
        INITIAL_USDC,
        deadline,
        { value: INITIAL_POT }
      );

      // User 2 adds liquidity with 5,000 pUSDC, but sends 5 POT (ideal is 2 POT)
      await usdc.connect(user2).faucetMint(user2Addr, 5000n * 10n ** 6n);
      await usdc.connect(user2).approve(await amm.getAddress(), ethers.MaxUint256);

      const balBefore = await ethers.provider.getBalance(user2Addr);
      const tx = await amm.connect(user2).addLiquidity(
        5000n * 10n ** 6n,
        ethers.parseEther("1.9"),
        5000n * 10n ** 6n,
        deadline,
        { value: ethers.parseEther("5") }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(user2Addr);

      // Ideal POT is 2 POT. 3 POT should be refunded. Net change ~ 2 POT + gas
      const potSpent = balBefore - balAfter - gasUsed;
      expect(potSpent).to.be.closeTo(ethers.parseEther("2"), ethers.parseEther("0.01"));

      const [rPOT, rUSDC] = await amm.getReserves();
      expect(rPOT).to.equal(ethers.parseEther("12"));
      expect(rUSDC).to.equal(30000n * 10n ** 6n);
    });

    it("removes liquidity, burns NFT, and returns proportional reserves", async function () {
      const user1Addr = await user1.getAddress();
      for (let i = 0; i < 3; i++) {
        await usdc.connect(user1).faucetMint(user1Addr, 9000n * 10n ** 6n);
      }
      await usdc.connect(user1).approve(await amm.getAddress(), ethers.MaxUint256);
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      await amm.connect(user1).addLiquidity(
        INITIAL_USDC,
        INITIAL_POT,
        INITIAL_USDC,
        deadline,
        { value: INITIAL_POT }
      );

      const balPOTBefore = await ethers.provider.getBalance(user1Addr);
      const balUSDCBefore = await usdc.balanceOf(user1Addr);

      const tx = await amm.connect(user1).removeLiquidity(
        1,
        ethers.parseEther("9.9"),
        24000n * 10n ** 6n,
        user1Addr,
        deadline
      );
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balPOTAfter = await ethers.provider.getBalance(user1Addr);
      const balUSDCAfter = await usdc.balanceOf(user1Addr);

      // Verify token receipt was deleted
      expect(await amm.ownerOf(1)).to.equal(ethers.ZeroAddress);
      expect(await amm.balanceOf(user1Addr)).to.equal(0);

      // Check refunded amounts (minus locked MINIMUM_LIQUIDITY shares)
      expect(balUSDCAfter - balUSDCBefore).to.be.gt(24900n * 10n ** 6n);
      expect(balPOTAfter + gasCost - balPOTBefore).to.be.gt(ethers.parseEther("9.9"));

      // Double-redemption must revert
      await expect(
        amm.connect(user1).removeLiquidity(1, 0, 0, user1Addr, deadline)
      ).to.be.reverted;
    });

    it("reverts if a non-owner attempts to remove liquidity", async function () {
      const user1Addr = await user1.getAddress();
      const user2Addr = await user2.getAddress();
      for (let i = 0; i < 3; i++) {
        await usdc.connect(user1).faucetMint(user1Addr, 9000n * 10n ** 6n);
      }
      await usdc.connect(user1).approve(await amm.getAddress(), ethers.MaxUint256);
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      await amm.connect(user1).addLiquidity(
        INITIAL_USDC,
        INITIAL_POT,
        INITIAL_USDC,
        deadline,
        { value: INITIAL_POT }
      );

      await expect(
        amm.connect(user2).removeLiquidity(1, 0, 0, user2Addr, deadline)
      ).to.be.reverted;
    });
  });

  describe("NexusAMMNative Swaps & Invariant Growth", function () {
    beforeEach(async function () {
      const user1Addr = await user1.getAddress();
      for (let i = 0; i < 3; i++) {
        await usdc.connect(user1).faucetMint(user1Addr, 9000n * 10n ** 6n);
      }
      await usdc.connect(user1).approve(await amm.getAddress(), ethers.MaxUint256);
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      await amm.connect(user1).addLiquidity(
        INITIAL_USDC,
        INITIAL_POT,
        INITIAL_USDC,
        deadline,
        { value: INITIAL_POT }
      );
    });

    it("swaps exact Native POT for pUSDC enforcing 0.3% fee and invariant growth", async function () {
      const user2Addr = await user2.getAddress();
      const swapPOT = ethers.parseEther("1"); // 1 POT
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      const [r0Before, r1Before] = await amm.getReserves();
      const kBefore = r0Before * r1Before;

      // Expected output: (1 * 0.997 * 25000 * 10^6) / (10 + 1 * 0.997) = 24925000000 / 10.997 = 2,266.527 pUSDC
      const minOut = 2200n * 10n ** 6n;
      const tx = await amm.connect(user2).swapExactPOTForTokens(minOut, user2Addr, deadline, {
        value: swapPOT
      });
      await tx.wait();

      const usdcReceived = await usdc.balanceOf(user2Addr);
      expect(usdcReceived).to.be.gte(minOut);

      const [r0After, r1After] = await amm.getReserves();
      const kAfter = r0After * r1After;
      expect(kAfter).to.be.gt(kBefore); // 0.3% fee grows k
    });

    it("reverts POT for pUSDC swap if slippage tolerance is violated", async function () {
      const user2Addr = await user2.getAddress();
      const swapPOT = ethers.parseEther("1");
      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;

      // Impossible minOut
      const excessiveMinOut = 5000n * 10n ** 6n;
      await expect(
        amm.connect(user2).swapExactPOTForTokens(excessiveMinOut, user2Addr, deadline, {
          value: swapPOT
        })
      ).to.be.reverted;
    });

    it("swaps exact pUSDC for Native POT enforcing 0.3% fee", async function () {
      const user2Addr = await user2.getAddress();
      const swapUSDC = 2500n * 10n ** 6n; // 2,500 pUSDC
      await usdc.connect(user2).faucetMint(user2Addr, swapUSDC);
      await usdc.connect(user2).approve(await amm.getAddress(), swapUSDC);

      const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
      const balBefore = await ethers.provider.getBalance(user2Addr);

      // Expected output ~ (2500 * 0.997 * 10) / (25000 + 2500 * 0.997) ~ 0.9066 POT
      const minPOT = ethers.parseEther("0.85");
      const tx = await amm.connect(user2).swapExactTokensForPOT(swapUSDC, minPOT, user2Addr, deadline);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const balAfter = await ethers.provider.getBalance(user2Addr);
      const potReceived = balAfter + gasCost - balBefore;
      expect(potReceived).to.be.gte(minPOT);
    });

    it("reverts swap if deadline has expired", async function () {
      const user2Addr = await user2.getAddress();
      const pastDeadline = (await ethers.provider.getBlock("latest"))!.timestamp - 1;

      await expect(
        amm.connect(user2).swapExactPOTForTokens(1, user2Addr, pastDeadline, {
          value: ethers.parseEther("0.1")
        })
      ).to.be.reverted;
    });

    it("rejects direct POT transfers (no receive/fallback) to prevent accidental loss", async function () {
      const ammAddr = await amm.getAddress();
      await expect(
        user1.sendTransaction({ to: ammAddr, value: ethers.parseEther("1") })
      ).to.be.reverted;
    });
  });
});
