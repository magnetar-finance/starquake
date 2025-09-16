import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-preprocessor';
import '@typechain/hardhat';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

function getRemappings() {
  return fs
    .readFileSync('remappings.txt', 'utf8')
    .split('\n')
    .filter(Boolean) // remove empty lines
    .map((line) => line.trim().split('='));
}

export default {
  networks: {
    monadTestnet: {
      url: 'https://testnet-rpc.monad.xyz',
      chainId: 10143,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 'auto',
      gas: 'auto',
      gasMultiplier: 1,
    },
    fluentTestnet: {
      url: 'https://burned-muddy-butterfly.fluent-testnet.quiknode.pro/fa1e4509eebd04205834dc1a9cc2f8db4016822d/',
      chainId: 20994,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 'auto',
      gas: 'auto',
      gasMultiplier: 1,
    },
  },
  typechain: {
    target: 'ethers-v5',
    outDir: './artifacts/types',
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  solidity: {
    compilers: [
      {
        version: '0.5.0',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.8.21',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.7.0',
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    metadata: {
      // do not include the metadata hash, since this is machine dependent
      // and we want all generated code to be deterministic
      // https://docs.soliditylang.org/en/v0.7.6/metadata.html
      bytecodeHash: 'none',
    },
  },
  preprocess: {
    eachLine: () => ({
      transform: (line: string) => {
        if (line.match(/^\s*import /i)) {
          getRemappings().forEach(([find, replace]) => {
            if (line.match(find)) {
              line = line.replace(find, replace);
            }
          });
        }
        return line;
      },
    }),
  },
  paths: {
    sources: './contracts',
    cache: './cache_hardhat',
  },
};
