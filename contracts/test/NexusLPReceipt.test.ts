import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("NexusLPReceipt (ERC-721 Liquidity Position Claim)", () => {
  let receipt: any;
  let fakeAmm: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    [fakeAmm, user1, user2] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("NexusLPReceipt");
    receipt = await Factory.deploy(fakeAmm.address);
    await receipt.waitForDeployment();
  });

  it("sets the authorized AMM address as immutable authority", async () => {
    expect(await receipt.amm()).to.equal(fakeAmm.address);
  });

  it("allows only the authorized AMM to mint receipts", async () => {
    const shares = 100_000n;
    const amount0 = 50_000n;
    const amount1 = 200_000n;

    await expect(
      receipt.connect(fakeAmm).mintReceipt(user1.address, shares, amount0, amount1)
    )
      .to.emit(receipt, "ReceiptMinted")
      .withArgs(1n, user1.address, shares, amount0, amount1);

    expect(await receipt.ownerOf(1n)).to.equal(user1.address);
  });

  it("reverts if a non-AMM account attempts to mint a receipt", async () => {
    await expect(
      receipt.connect(user1).mintReceipt(user1.address, 100n, 100n, 100n)
    ).to.be.revertedWithCustomError(receipt, "OnlyAMM");
  });

  it("records exact position metadata and returns via getPosition()", async () => {
    await receipt.connect(fakeAmm).mintReceipt(user1.address, 500n, 100n, 200n);
    const pos = await receipt.getPosition(1n);

    expect(pos.pool).to.equal(fakeAmm.address);
    expect(pos.shares).to.equal(500n);
    expect(pos.token0Deposited).to.equal(100n);
    expect(pos.token1Deposited).to.equal(200n);
  });

  it("allows only the authorized AMM to burn a receipt upon redemption", async () => {
    await receipt.connect(fakeAmm).mintReceipt(user1.address, 500n, 100n, 200n);

    await expect(receipt.connect(fakeAmm).burnReceipt(1n))
      .to.emit(receipt, "ReceiptBurned")
      .withArgs(1n, user1.address, 500n);

    await expect(receipt.ownerOf(1n)).to.be.revertedWithCustomError(
      receipt,
      "ERC721NonexistentToken"
    );
  });

  it("reverts if a non-AMM account attempts to burn a receipt", async () => {
    await receipt.connect(fakeAmm).mintReceipt(user1.address, 500n, 100n, 200n);

    await expect(receipt.connect(user1).burnReceipt(1n)).to.be.revertedWithCustomError(
      receipt,
      "OnlyAMM"
    );
  });

  it("transferring the receipt updates ownership of the underlying claim", async () => {
    await receipt.connect(fakeAmm).mintReceipt(user1.address, 500n, 100n, 200n);

    await receipt.connect(user1).transferFrom(user1.address, user2.address, 1n);
    expect(await receipt.ownerOf(1n)).to.equal(user2.address);
  });
});
