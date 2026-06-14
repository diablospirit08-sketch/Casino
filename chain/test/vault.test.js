const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const ONE = ethers.parseEther("1");

async function expectRevert(promise, errorName) {
  try {
    await promise;
  } catch (err) {
    if (errorName) {
      expect(String(err), `expected revert with ${errorName}`).to.include(errorName);
    }
    return;
  }
  expect.fail(`expected revert${errorName ? ` with ${errorName}` : ""}, but call succeeded`);
}

describe("VoltVault", () => {
  let owner, cashier, player, outsider, vault, domain;

  const types = {
    Withdrawal: [
      { name: "player", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  async function signVoucher(signer, voucher) {
    return signer.signTypedData(domain, types, voucher);
  }

  async function voucherFor(playerAddr, amount, overrides = {}) {
    const block = await ethers.provider.getBlock("latest");
    return {
      player: playerAddr,
      amount,
      nonce: BigInt(ethers.hexlify(ethers.randomBytes(8))),
      deadline: block.timestamp + 3600,
      ...overrides,
    };
  }

  beforeEach(async () => {
    [owner, cashier, player, outsider] = await ethers.getSigners();
    vault = await ethers.deployContract("VoltVault", [cashier.address]);
    domain = {
      name: "VoltVault",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await vault.getAddress(),
    };
  });

  it("emits Deposited for deposit() and plain transfers", async () => {
    const tx = await vault.connect(player).deposit({ value: ONE });
    const receipt = await tx.wait();
    const ev = receipt.logs.map((l) => vault.interface.parseLog(l)).find((e) => e.name === "Deposited");
    expect(ev.args.player).to.equal(player.address);
    expect(ev.args.amount).to.equal(ONE);

    const tx2 = await player.sendTransaction({ to: await vault.getAddress(), value: ONE });
    const receipt2 = await tx2.wait();
    expect(receipt2.status).to.equal(1);
    await expectRevert(vault.connect(player).deposit({ value: 0 }), "ZeroAmount");
  });

  it("pays out a valid cashier-signed voucher exactly once", async () => {
    await vault.connect(player).deposit({ value: 5n * ONE });
    const voucher = await voucherFor(player.address, 2n * ONE);
    const sig = await signVoucher(cashier, voucher);

    const before = await ethers.provider.getBalance(player.address);
    const tx = await vault
      .connect(player)
      .withdraw(voucher.amount, voucher.nonce, voucher.deadline, sig);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(player.address);
    expect(after - before + gas).to.equal(2n * ONE);

    // replay rejected
    await expectRevert(
      vault.connect(player).withdraw(voucher.amount, voucher.nonce, voucher.deadline, sig),
      "VoucherAlreadyUsed"
    );
  });

  it("rejects vouchers not signed by the cashier key", async () => {
    await vault.connect(player).deposit({ value: 5n * ONE });
    const voucher = await voucherFor(player.address, ONE);
    const sig = await signVoucher(outsider, voucher); // wrong key
    await expectRevert(
      vault.connect(player).withdraw(voucher.amount, voucher.nonce, voucher.deadline, sig),
      "BadSignature"
    );
  });

  it("binds a voucher to the named player", async () => {
    await vault.connect(player).deposit({ value: 5n * ONE });
    const voucher = await voucherFor(player.address, ONE);
    const sig = await signVoucher(cashier, voucher);
    // outsider redeeming player's voucher: digest is computed over msg.sender,
    // so the signature no longer matches
    await expectRevert(
      vault.connect(outsider).withdraw(voucher.amount, voucher.nonce, voucher.deadline, sig),
      "BadSignature"
    );
  });

  it("rejects expired vouchers and tampered amounts", async () => {
    await vault.connect(player).deposit({ value: 5n * ONE });
    const voucher = await voucherFor(player.address, ONE);
    const sig = await signVoucher(cashier, voucher);

    await expectRevert(
      vault.connect(player).withdraw(2n * ONE, voucher.nonce, voucher.deadline, sig),
      "BadSignature" // amount not covered by the signature
    );

    await network.provider.send("evm_increaseTime", [3601]);
    await network.provider.send("evm_mine");
    await expectRevert(
      vault.connect(player).withdraw(voucher.amount, voucher.nonce, voucher.deadline, sig),
      "VoucherExpired"
    );
  });

  it("restricts house ops to the owner and rotates the cashier key", async () => {
    await vault.connect(player).deposit({ value: 5n * ONE });
    await expectRevert(vault.connect(outsider).houseWithdraw(outsider.address, ONE), "NotOwner");
    await expectRevert(vault.connect(outsider).setCashierSigner(outsider.address), "NotOwner");

    await vault.houseWithdraw(owner.address, ONE);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(4n * ONE);

    // rotate signer: old key's vouchers stop verifying, new key's work
    await vault.setCashierSigner(outsider.address);
    const voucher = await voucherFor(player.address, ONE);
    const oldSig = await signVoucher(cashier, voucher);
    await expectRevert(
      vault.connect(player).withdraw(voucher.amount, voucher.nonce, voucher.deadline, oldSig),
      "BadSignature"
    );
    const newSig = await signVoucher(outsider, voucher);
    await vault.connect(player).withdraw(voucher.amount, voucher.nonce, voucher.deadline, newSig);
  });
});
