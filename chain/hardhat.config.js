require("@nomicfoundation/hardhat-ethers");

// Deploy to BSC in PowerShell:
//   $env:BSC_PRIVATE_KEY = "0x<funded key — NEVER a real-money key in source>"
//   npx hardhat run scripts/deploy.js --network bscTestnet
//   npx hardhat run scripts/deploy.js --network bsc
const { BSC_PRIVATE_KEY, SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY } = process.env;

module.exports = {
  solidity: "0.8.24",
  paths: {
    sources: "./contracts",
    tests: "./test",
  },
  networks: {
    // BNB Smart Chain mainnet (chain ID 56)
    ...(BSC_PRIVATE_KEY ? {
      bsc: {
        url: "https://bsc-dataseed.binance.org/",
        chainId: 56,
        accounts: [BSC_PRIVATE_KEY],
      },
    } : {}),
    // BNB Smart Chain testnet (chain ID 97)
    ...(BSC_PRIVATE_KEY ? {
      bscTestnet: {
        url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
        chainId: 97,
        accounts: [BSC_PRIVATE_KEY],
      },
    } : {}),
    // Sepolia kept for reference
    ...(SEPOLIA_RPC_URL && SEPOLIA_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [SEPOLIA_PRIVATE_KEY] } }
      : {}),
  },
};
