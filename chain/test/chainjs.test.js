// Verifies the hand-rolled ABI helpers in js/chain.js (the browser has no
// ethers, so the frontend encodes VoltVault.withdraw calldata itself). The
// file is a classic browser script under an ESM root, so it's evaluated via
// new Function with a fake `module` rather than require()d.

const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

function loadChainJs() {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "chain.js"), "utf8");
  const module = { exports: {} };
  new Function("module", src)(module);
  return module.exports;
}

describe("js/chain.js ABI helpers", () => {
  const chain = loadChainJs();
  const iface = new ethers.Interface([
    "function withdraw(uint256 amount, uint256 nonce, uint256 deadline, bytes signature)",
  ]);

  it("exports its helpers when loaded under Node", () => {
    expect(chain).to.have.keys(["pad32", "encodeWithdraw", "ethToWei", "weiToEth", "WITHDRAW_SELECTOR"]);
  });

  it("hardcodes the correct withdraw selector", () => {
    expect(chain.WITHDRAW_SELECTOR).to.equal(iface.getFunction("withdraw").selector);
  });

  it("encodes withdraw calldata identically to ethers", () => {
    const amount = ethers.parseEther("1.5");
    const nonce = BigInt("0x9f8e7d6c5b4a39281706f5e4d3c2b1a0");
    const deadline = 1780000000n;
    const signature = "0x" + "ab".repeat(64) + "1b"; // 65-byte r||s||v shape

    const expected = iface.encodeFunctionData("withdraw", [amount, nonce, deadline, signature]);
    const actual = chain.encodeWithdraw(amount.toString(), nonce.toString(), Number(deadline), signature);
    expect(actual).to.equal(expected);
  });

  it("round-trips eth/wei conversions", () => {
    expect(chain.ethToWei(1.5)).to.equal(ethers.parseEther("1.5"));
    expect(chain.weiToEth(ethers.parseEther("0.198").toString())).to.equal(0.198);
  });
});
