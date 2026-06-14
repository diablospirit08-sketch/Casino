// House operator: keeps the dice contract stocked with committed seed hashes,
// listens for bets, and reveals the seed to resolve each one. Without this
// process running, every bet resolves via the 1-hour timeout — at full payout.
//
//   npx hardhat run scripts/operator.js --network localhost
//
// State files (in chain/):
//   operator-seeds.json — SECRET seed preimages. Losing this file means the
//                         house pays max on every unresolved bet. Seeds are
//                         written to disk BEFORE their hashes go on-chain.
//   seed-hashes.json    — public list of available (committed, unused) hashes
//                         for the frontend to pick from when placing a bet.

const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

const SEED_FILE = path.join(__dirname, "..", "operator-seeds.json");
const PUBLIC_HASHES_FILE = path.join(__dirname, "..", "seed-hashes.json");
const BATCH_SIZE = 20; // seeds committed per top-up
const LOW_WATER = 5; // top up when fewer than this many are available

const SeedState = { None: 0n, Committed: 1n, Used: 2n };

function loadSeeds() {
  if (!fs.existsSync(SEED_FILE)) return [];
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
}

function saveSeeds(seeds) {
  fs.writeFileSync(SEED_FILE, JSON.stringify(seeds, null, 2));
}

function publishAvailableHashes(seeds) {
  const available = seeds.filter((s) => s.committed && !s.used).map((s) => s.hash);
  fs.writeFileSync(PUBLIC_HASHES_FILE, JSON.stringify(available, null, 2));
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8")
  );
  const dice = await ethers.getContractAt("VoltDice", deployment.dice);
  const seeds = loadSeeds();

  // Reconcile local "used" flags with the chain (we may have missed reveals).
  for (const s of seeds) {
    if (s.committed && !s.used) {
      s.used = (await dice.seedHashes(s.hash)) === SeedState.Used;
    }
  }

  async function reveal(betId, seedHash) {
    const entry = seeds.find((s) => s.hash === seedHash);
    if (!entry) {
      console.error(`bet ${betId}: NO SEED ON FILE for ${seedHash} — player will claim timeout`);
      return;
    }
    const tx = await dice.reveal(betId, entry.seed);
    const receipt = await tx.wait();
    entry.used = true;
    saveSeeds(seeds);
    publishAvailableHashes(seeds);
    const resolved = receipt.logs
      .map((log) => { try { return dice.interface.parseLog(log); } catch { return null; } })
      .find((e) => e && e.name === "BetResolved");
    const { roll, payout } = resolved.args;
    console.log(
      `bet ${betId}: rolled ${roll} -> ${payout === 0n ? "house wins" : `paid ${ethers.formatEther(payout)} ETH`}`
    );
  }

  async function topUpPool() {
    const availableCount = seeds.filter((s) => s.committed && !s.used).length;
    if (availableCount >= LOW_WATER) return;
    const fresh = Array.from({ length: BATCH_SIZE }, () => {
      const seed = ethers.hexlify(ethers.randomBytes(32));
      return { seed, hash: ethers.keccak256(seed), committed: false, used: false };
    });
    seeds.push(...fresh);
    saveSeeds(seeds); // persist preimages BEFORE committing hashes on-chain
    await (await dice.commitSeeds(fresh.map((s) => s.hash))).wait();
    fresh.forEach((s) => (s.committed = true));
    saveSeeds(seeds);
    publishAvailableHashes(seeds);
    console.log(`committed ${BATCH_SIZE} fresh seed hashes (${availableCount} were left)`);
  }

  // Catch up on bets placed while the operator was down.
  await topUpPool();
  const past = await dice.queryFilter(dice.filters.BetPlaced(), 0);
  for (const ev of past) {
    const betId = ev.args.betId;
    if (!(await dice.bets(betId)).settled) {
      console.log(`catching up on unresolved bet ${betId}`);
      await reveal(betId, ev.args.seedHash);
    }
  }

  dice.on(dice.filters.BetPlaced(), async (ev) => {
    const { betId, player, wager, rollUnder, seedHash } = ev.args;
    console.log(
      `bet ${betId}: ${player} wagered ${ethers.formatEther(wager)} ETH on roll < ${rollUnder}`
    );
    try {
      await reveal(betId, seedHash);
      await topUpPool();
    } catch (err) {
      console.error(`bet ${betId}: reveal failed —`, err.message);
    }
  });

  console.log(`operator running — watching ${deployment.dice} for bets (ctrl-c to stop)`);
  await new Promise(() => {}); // keep the process alive for the listener
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
