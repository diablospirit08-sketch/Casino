require("@nomicfoundation/hardhat-ethers");

// Testnet deploys read credentials from the environment, e.g. in PowerShell:
//   $env:SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"
//   $env:SEPOLIA_PRIVATE_KEY = "0x<funded test key — NEVER a real-money key>"
const { SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY } = process.env;

module.exports = {
  solidity: "0.8.24",
  paths: {
    // junction to ../contracts — the canonical sources live at the repo root
    sources: "./contracts",
    tests: "./test",
  },
  networks: {
    ...(SEPOLIA_RPC_URL && SEPOLIA_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [SEPOLIA_PRIVATE_KEY] } }
      : {}),
  },
};
