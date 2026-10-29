import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("WPotToken (Wrapped POT ERC-20)", () => {
  let wpot: any;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("WPotToken");
    wpot = await Factory.deploy();
    await wpot.waitForDeployment();
  });

  it("has correct name, symbol, and 18 decimals", async () => {
    expect(await wpot.name()).to.equal("Wrapped POT");
    expect(await wpot.symbol()).to.equal("WPOT");
    expect(await wpot.decimals()).to.equal(18);
  });

  it("mints WPOT 1:1 when native currency is deposited via deposit()", async () => {
    const depositAmount = ethers.parseEther("5.0");
    await expect(wpot.connect(user1).deposit({ value: depositAmount }))
      .to.emit(wpot, "Deposit")
      .withArgs(user1.address, depositAmount);

    expect(await wpot.balanceOf(user1.address)).to.equal(depositAmount);
    expect(await wpot.totalSupply()).to.equal(depositAmount);
    expect(await ethers.provider.getBalance(await wpot.getAddress())).to.equal(depositAmount);
  });

  it("mints WPOT 1:1 when native currency is sent directly to fallback receive()", async () => {
    const depositAmount = ethers.parseEther("2.5");
    await expect(
      user1.sendTransaction({
        to: await wpot.getAddress(),
        value: depositAmount,
      })
    )
      .to.emit(wpot, "Deposit")
      .withArgs(user1.address, depositAmount);

    expect(await wpot.balanceOf(user1.address)).to.equal(depositAmount);
  });

  it("reverts if deposit amount is zero", async () => {
    await expect(wpot.connect(user1).deposit({ value: 0 })).to.be.revertedWithCustomError(
      wpot,
      "ZeroAmount"
    );
  });

  it("burns WPOT and refunds native currency on withdraw()", async () => {
    const depositAmount = ethers.parseEther("3.0");
    await wpot.connect(user1).deposit({ value: depositAmount });

    const withdrawAmount = ethers.parseEther("1.0");
    const balBefore = await ethers.provider.getBalance(user1.address);

    const tx = await wpot.connect(user1).withdraw(withdrawAmount);
    const receipt = await tx.wait();
    const gasSpent = receipt!.gasUsed * receipt!.gasPrice;

    const balAfter = await ethers.provider.getBalance(user1.address);

    expect(await wpot.balanceOf(user1.address)).to.equal(depositAmount - withdrawAmount);
    expect(balAfter).to.equal(balBefore + withdrawAmount - gasSpent);
  });

  it("reverts on withdraw if requested amount exceeds balance", async () => {
    const depositAmount = ethers.parseEther("1.0");
    await wpot.connect(user1).deposit({ value: depositAmount });

    const excessive = ethers.parseEther("2.0");
    await expect(wpot.connect(user1).withdraw(excessive))
      .to.be.revertedWithCustomError(wpot, "InsufficientBalance")
      .withArgs(excessive, depositAmount);
  });

  it("reverts on withdraw if amount is zero", async () => {
    await expect(wpot.connect(user1).withdraw(0)).to.be.revertedWithCustomError(
      wpot,
      "ZeroAmount"
    );
  });

  it("strictly preserves the 1:1 backing invariant (contractBalance == totalSupply)", async () => {
    await wpot.connect(user1).deposit({ value: ethers.parseEther("10.0") });
    await wpot.connect(user2).deposit({ value: ethers.parseEther("4.5") });
    await wpot.connect(user1).withdraw(ethers.parseEther("3.0"));

    const contractBal = await ethers.provider.getBalance(await wpot.getAddress());
    const totalSup = await wpot.totalSupply();

    expect(contractBal).to.equal(totalSup);
    expect(totalSup).to.equal(ethers.parseEther("11.5"));
  });
});
