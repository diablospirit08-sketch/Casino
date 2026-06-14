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

// Mirrors VoltDice's roll derivation so tests can pick targets deterministically.
function rollFor(seed, betId, player, clientSeed) {
  const hash = ethers.solidityPackedKeccak256(
    ["bytes32", "uint256", "address", "uint256"],
    [seed, betId, player, clientSeed]
  );
  return Number(BigInt(hash) % 100n);
}

// Finds a clientSeed whose roll satisfies `want(roll)`.
function findClientSeed(seed, betId, player, want) {
  for (let cs = 0; cs < 10_000; cs++) {
    if (want(rollFor(seed, betId, player, cs))) return cs;
  }
  throw new Error("no suitable clientSeed found");
}

function seedOf(label) {
  const seed = ethers.id(label); // bytes32 secret
  return { seed, hash: ethers.keccak256(seed) };
}

describe("VoltBankroll", () => {
  let owner, game, player, outsider, bankroll;

  beforeEach(async () => {
    [owner, game, player, outsider] = await ethers.getSigners();
    bankroll = await ethers.deployContract("VoltBankroll");
    await bankroll.deposit({ value: 100n * ONE });
    await bankroll.setGame(game.address, true);
  });

  it("tracks available funds and caps single-bet payout at maxPayoutBps", async () => {
    expect(await bankroll.available()).to.equal(100n * ONE);
    expect(await bankroll.maxPayout()).to.equal(ONE); // 1% default
    await bankroll.setMaxPayoutBps(500);
    expect(await bankroll.maxPayout()).to.equal(5n * ONE);
  });

  it("rejects escrow and settle from non-whitelisted callers", async () => {
    await expectRevert(
      bankroll.connect(outsider).escrowBet(ONE, { value: ONE }),
      "NotGame"
    );
    await expectRevert(
      bankroll.connect(outsider).settle(player.address, 0, 0),
      "NotGame"
    );
  });

  it("escrows bets, reserves payouts, and rejects oversize payouts", async () => {
    // wager backs itself plus 1% of the pre-bet bankroll: 2 + 1 = 3 allowed
    await expectRevert(
      bankroll.connect(game).escrowBet(ethers.parseEther("3.01"), { value: 2n * ONE }),
      "ExceedsMaxPayout"
    );
    await bankroll.connect(game).escrowBet(3n * ONE, { value: 2n * ONE });
    expect(await bankroll.totalReserved()).to.equal(3n * ONE);
    expect(await bankroll.available()).to.equal(99n * ONE); // 102 held - 3 reserved
  });

  it("settle pays the winner from the reservation", async () => {
    await bankroll.connect(game).escrowBet(2n * ONE, { value: ONE });
    const before = await ethers.provider.getBalance(player.address);
    await bankroll.connect(game).settle(player.address, 2n * ONE, 2n * ONE);
    const after = await ethers.provider.getBalance(player.address);
    expect(after - before).to.equal(2n * ONE);
    expect(await bankroll.totalReserved()).to.equal(0n);
    expect(await bankroll.available()).to.equal(99n * ONE); // house lost 1
  });

  it("settle keeps the wager on a loss and rejects overpayment", async () => {
    await bankroll.connect(game).escrowBet(2n * ONE, { value: ONE });
    await expectRevert(
      bankroll.connect(game).settle(player.address, 2n * ONE, 3n * ONE),
      "ExceedsReservation"
    );
    await bankroll.connect(game).settle(player.address, 2n * ONE, 0);
    expect(await bankroll.available()).to.equal(101n * ONE); // house won 1
  });

  it("owner withdrawals cannot touch reserved funds", async () => {
    await bankroll.connect(game).escrowBet(2n * ONE, { value: ONE });
    await expectRevert(
      bankroll.withdrawHouseFunds(owner.address, 100n * ONE),
      "InsufficientUnreservedFunds"
    );
    await bankroll.withdrawHouseFunds(owner.address, 99n * ONE);
    expect(await bankroll.available()).to.equal(0n);
    expect(await bankroll.totalReserved()).to.equal(2n * ONE);
  });

  it("clears stuck reservations only after de-whitelisting the game", async () => {
    await bankroll.connect(game).escrowBet(2n * ONE, { value: ONE });
    await expectRevert(bankroll.clearReservations(game.address), "GameStillWhitelisted");
    await bankroll.setGame(game.address, false);
    await bankroll.clearReservations(game.address);
    expect(await bankroll.totalReserved()).to.equal(0n);
  });

  it("restricts governance to the owner", async () => {
    await expectRevert(bankroll.connect(outsider).setGame(outsider.address, true), "NotOwner");
    await expectRevert(bankroll.connect(outsider).setMaxPayoutBps(50), "NotOwner");
    await expectRevert(
      bankroll.connect(outsider).withdrawHouseFunds(outsider.address, 1n),
      "NotOwner"
    );
    await expectRevert(bankroll.setMaxPayoutBps(1001), "InvalidBps"); // 10% hard cap
  });
});

describe("VoltDice", () => {
  let owner, player, bankroll, dice;

  beforeEach(async () => {
    [owner, player] = await ethers.getSigners();
    bankroll = await ethers.deployContract("VoltBankroll");
    await bankroll.deposit({ value: 1000n * ONE });
    dice = await ethers.deployContract("VoltDice", [await bankroll.getAddress()]);
    await bankroll.setGame(await dice.getAddress(), true);
  });

  async function placeBet(label, rollUnder, wager, want) {
    const { seed, hash } = seedOf(label);
    await dice.commitSeeds([hash]);
    const betId = await dice.nextBetId();
    const clientSeed = findClientSeed(seed, betId, player.address, want);
    await dice.connect(player).placeBet(rollUnder, hash, clientSeed, { value: wager });
    return { seed, hash, betId };
  }

  it("pays 99/T on a winning roll", async () => {
    const wager = ONE;
    const rollUnder = 50;
    const { seed, betId } = await placeBet("win-seed", rollUnder, wager, (r) => r < rollUnder);

    const expectedPayout = (wager * 99n) / BigInt(rollUnder); // 1.98 ETH
    const before = await ethers.provider.getBalance(player.address);
    await dice.reveal(betId, seed); // house reveals, pays player from vault
    const after = await ethers.provider.getBalance(player.address);

    expect(after - before).to.equal(expectedPayout);
    expect(await bankroll.totalReserved()).to.equal(0n);
  });

  it("keeps the wager on a losing roll", async () => {
    const rollUnder = 50;
    const { seed, betId } = await placeBet("lose-seed", rollUnder, ONE, (r) => r >= rollUnder);

    const before = await ethers.provider.getBalance(player.address);
    await dice.reveal(betId, seed);
    const after = await ethers.provider.getBalance(player.address);

    expect(after - before).to.equal(0n);
    expect(await bankroll.available()).to.equal(1001n * ONE); // house keeps the wager
  });

  it("rejects bad bets: unknown seed, tiny wager, out-of-range target, oversize wager", async () => {
    const { hash } = seedOf("never-committed");
    await expectRevert(dice.connect(player).placeBet(50, hash, 1, { value: ONE }), "SeedNotAvailable");

    const { hash: committed } = seedOf("committed");
    await dice.commitSeeds([committed]);
    await expectRevert(
      dice.connect(player).placeBet(50, committed, 1, { value: ethers.parseEther("0.0001") }),
      "WagerTooSmall"
    );
    await expectRevert(dice.connect(player).placeBet(0, committed, 1, { value: ONE }), "RollUnderOutOfRange");
    await expectRevert(dice.connect(player).placeBet(99, committed, 1, { value: ONE }), "RollUnderOutOfRange");

    // maxPayout is 10 ETH (1% of 1000); rollUnder=1 pays 99x, so 1 ETH wager wants 99 ETH
    await expectRevert(
      dice.connect(player).placeBet(1, committed, 1, { value: ONE }),
      "ExceedsMaxPayout"
    );
    // maxPayout (10 ETH) * 50 / 99
    expect(await dice.maxWager(50)).to.equal((10n * ONE * 50n) / 99n);
  });

  it("rejects wrong seeds, double reveals, and reuse of a seed hash", async () => {
    const { seed, hash, betId } = await placeBet("reveal-rules", 50, ONE, () => true);
    await expectRevert(dice.reveal(betId, ethers.id("wrong")), "WrongSeed");
    await expectRevert(dice.connect(player).placeBet(50, hash, 1, { value: ONE }), "SeedNotAvailable");
    await dice.reveal(betId, seed);
    await expectRevert(dice.reveal(betId, seed), "AlreadySettled");
  });

  it("pays the full potential payout if the house stalls past the timeout", async () => {
    const wager = ONE;
    const rollUnder = 50;
    // pick a LOSING roll: the timeout penalty must pay out anyway
    const { betId } = await placeBet("stalled-seed", rollUnder, wager, (r) => r >= rollUnder);

    await expectRevert(dice.connect(player).claimTimeout(betId), "RevealNotOverdue");
    await network.provider.send("evm_increaseTime", [3601]);
    await network.provider.send("evm_mine");

    const expectedPayout = (wager * 99n) / BigInt(rollUnder);
    const before = await ethers.provider.getBalance(player.address);
    const tx = await dice.connect(player).claimTimeout(betId);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(player.address);

    expect(after - before + gas).to.equal(expectedPayout);
    await expectRevert(dice.connect(player).claimTimeout(betId), "AlreadySettled");
  });

  it("only the bettor can claim a timeout, only the owner commits seeds", async () => {
    const { betId, seed } = await placeBet("perm-seed", 50, ONE, () => true);
    await network.provider.send("evm_increaseTime", [3601]);
    await network.provider.send("evm_mine");
    await expectRevert(dice.claimTimeout(betId), "NotPlayer"); // owner is not the bettor

    const { hash } = seedOf("outsider-seed");
    await expectRevert(dice.connect(player).commitSeeds([hash]), "NotOwner");
    await expectRevert(dice.commitSeeds([ethers.keccak256(seed)]), "SeedAlreadyKnown");
  });
});
