import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("TestUSDC (Portal Test USD Simulation Token)", () => {
  let usdc: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TestUSDC");
    usdc = await Factory.deploy();
    await usdc.waitForDeployment();
  });

  it("has correct token metadata and 6 decimals matching real USDC format", async () => {
    expect(await usdc.name()).to.equal("Portal Test USD");
    expect(await usdc.symbol()).to.equal("pUSDC");
    expect(await usdc.decimals()).to.equal(6);
  });

  it("allows testnet faucet minting up to MAX_MINT_PER_CALL (10,000 pUSDC)", async () => {
    const mintAmount = 5_000n * 10n ** 6n; // 5,000 pUSDC
    await expect(usdc.connect(user1).faucetMint(user1.address, mintAmount))
      .to.emit(usdc, "FaucetMinted")
      .withArgs(user1.address, mintAmount);

    expect(await usdc.balanceOf(user1.address)).to.equal(mintAmount);
    expect(await usdc.totalSupply()).to.equal(mintAmount);
  });

  it("reverts if faucet mint requested exceeds per-call cap", async () => {
    const excessiveAmount = 10_001n * 10n ** 6n; // 10,001 pUSDC
    const cap = await usdc.MAX_MINT_PER_CALL();

    await expect(usdc.connect(user1).faucetMint(user1.address, excessiveAmount))
      .to.be.revertedWithCustomError(usdc, "ExceedsMaxMint")
      .withArgs(excessiveAmount, cap);
  });

  it("reverts if faucet mint amount is zero", async () => {
    await expect(usdc.connect(user1).faucetMint(user1.address, 0)).to.be.revertedWithCustomError(
      usdc,
      "ZeroAmount"
    );
  });

  it("reverts if recipient address is zero address", async () => {
    await expect(
      usdc.connect(user1).faucetMint(ethers.ZeroAddress, 1_000n * 10n ** 6n)
    ).to.be.revertedWithCustomError(usdc, "ZeroAddress");
  });

  it("supports standard ERC-20 transfers and approvals", async () => {
    const amount = 2_000n * 10n ** 6n;
    await usdc.connect(user1).faucetMint(user1.address, amount);

    await usdc.connect(user1).transfer(user2.address, 500n * 10n ** 6n);
    expect(await usdc.balanceOf(user2.address)).to.equal(500n * 10n ** 6n);
    expect(await usdc.balanceOf(user1.address)).to.equal(1_500n * 10n ** 6n);

    await usdc.connect(user1).approve(user2.address, 300n * 10n ** 6n);
    expect(await usdc.allowance(user1.address, user2.address)).to.equal(300n * 10n ** 6n);

    await usdc.connect(user2).transferFrom(user1.address, user2.address, 300n * 10n ** 6n);
    expect(await usdc.balanceOf(user2.address)).to.equal(800n * 10n ** 6n);
  });
});
