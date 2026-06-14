// Cashier service for the Stake-style flow: the games never touch the chain —
// they play against this ledger. The chain is only used for money in
// (VoltVault deposits, credited here) and money out (EIP-712 vouchers signed
// here, redeemed against the vault by the player).
//
//   npx hardhat run scripts/cashier.js --network localhost
//
// State: chain/ledger.json — { lastBlock, balances: { address: wei } }.
// In production this is the house database; treat it accordingly.
//
// HTTP API (port 8484, CORS open for the casino frontend):
//   GET  /balance/0x...               -> { balance }
//   POST /settle   { player, delta }  -> { balance }   credit/debit game results
//   POST /withdraw { player, amount } -> { amount, nonce, deadline, signature }
//
// DEMO TRUST NOTE: /settle believes whatever result the client reports,
// because the demo games run in the browser. In a real deployment the games
// run server-side and /settle does not exist as a public endpoint.

const fs = require("fs");
const path = require("path");
const http = require("http");
const { ethers } = require("hardhat");

const PORT = 8484;
const LEDGER_FILE = path.join(__dirname, "..", "ledger.json");
const VOUCHER_TTL_SECONDS = 3600;

function loadLedger() {
  if (!fs.existsSync(LEDGER_FILE)) return { lastBlock: 0, balances: {} };
  return JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
}

function saveLedger(ledger) {
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
  });
}

async function main() {
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8")
  );
  const [signer] = await ethers.getSigners(); // the vault's cashierSigner
  const vault = await ethers.getContractAt("VoltVault", deployment.vault);
  const ledger = loadLedger();

  const domain = {
    name: "VoltVault",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: deployment.vault,
  };
  const voucherTypes = {
    Withdrawal: [
      { name: "player", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  function balanceOf(addr) {
    return BigInt(ledger.balances[addr.toLowerCase()] || "0");
  }

  function setBalance(addr, value) {
    ledger.balances[addr.toLowerCase()] = value.toString();
    saveLedger(ledger);
  }

  function credit(player, amount, blockNumber) {
    setBalance(player, balanceOf(player) + amount);
    if (blockNumber) {
      ledger.lastBlock = Math.max(ledger.lastBlock, blockNumber);
      saveLedger(ledger);
    }
    console.log(
      `deposit: ${player} +${ethers.formatEther(amount)} ETH -> ${ethers.formatEther(balanceOf(player))} ETH`
    );
  }

  // Credit deposits that happened while the cashier was down, then live ones.
  const past = await vault.queryFilter(vault.filters.Deposited(), ledger.lastBlock + 1);
  for (const ev of past) credit(ev.args.player, ev.args.amount, ev.blockNumber);
  vault.on(vault.filters.Deposited(), (ev) =>
    credit(ev.args.player, ev.args.amount, ev.blockNumber)
  );

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") return res.end();

    const fail = (code, message) => {
      res.statusCode = code;
      res.end(JSON.stringify({ error: message }));
    };

    try {
      const balanceMatch = req.url.match(/^\/balance\/(0x[0-9a-fA-F]{40})$/);
      if (req.method === "GET" && balanceMatch) {
        return res.end(JSON.stringify({ balance: balanceOf(balanceMatch[1]).toString() }));
      }

      if (req.method === "POST" && req.url === "/settle") {
        const { player, delta } = await readBody(req);
        if (!ethers.isAddress(player)) return fail(400, "bad player address");
        const change = BigInt(delta);
        const next = balanceOf(player) + change;
        if (next < 0n) return fail(400, "insufficient balance");
        setBalance(player, next);
        console.log(
          `settle: ${player} ${change >= 0n ? "+" : ""}${ethers.formatEther(change)} ETH -> ${ethers.formatEther(next)} ETH`
        );
        return res.end(JSON.stringify({ balance: next.toString() }));
      }

      if (req.method === "POST" && req.url === "/withdraw") {
        const { player, amount } = await readBody(req);
        if (!ethers.isAddress(player)) return fail(400, "bad player address");
        const value = BigInt(amount);
        if (value <= 0n) return fail(400, "bad amount");
        if (balanceOf(player) < value) return fail(400, "insufficient balance");

        // Debit first, then sign: a voucher is a claim on real funds, so it
        // must never coexist with the balance that produced it.
        setBalance(player, balanceOf(player) - value);
        const voucher = {
          player,
          amount: value,
          nonce: BigInt(ethers.hexlify(ethers.randomBytes(16))),
          deadline: Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS,
        };
        const signature = await signer.signTypedData(domain, voucherTypes, voucher);
        console.log(`withdraw: ${player} -${ethers.formatEther(value)} ETH (voucher issued)`);
        return res.end(
          JSON.stringify({
            amount: voucher.amount.toString(),
            nonce: voucher.nonce.toString(),
            deadline: voucher.deadline,
            signature,
          })
        );
      }

      fail(404, "not found");
    } catch (err) {
      fail(400, err.message);
    }
  });

  server.listen(PORT, () => {
    console.log(`cashier running on http://localhost:${PORT} — vault ${deployment.vault}`);
  });
  await new Promise(() => {}); // keep alive for the event listener
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
