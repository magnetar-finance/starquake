import { ContractTransaction } from '@ethersproject/contracts';
import { ethers, network } from 'hardhat';
import { join } from 'path';
import { CLFactory, IERC20Metadata } from '../../artifacts/types';
import Values from '../constants/values.json';
import erc20ABI from '../abis/IERC20Metadata.json';
import fs from 'fs';

// async function deployLibrary(typeName: string, ...args: any[]): Promise<Contract> {
//   const ctrFactory = await ethers.getContractFactory(typeName);

//   const ctr = ((await ctrFactory.deploy(...args)) as unknown) as Contract;
//   await ctr.deployed();
//   return ctr;
// }

// async function deploy<Type>(typeName: string, libraries?: Libraries, ...args: any[]): Promise<Type> {
//   const ctrFactory = await ethers.getContractFactory(typeName, { libraries });

//   const ctr = ((await ctrFactory.deploy(...args)) as unknown) as Type;
//   await ((ctr as unknown) as Contract).deployed();
//   return ctr;
// }

async function getContractAtAddress<Type>(typeName: string | any[], address: string): Promise<Type> {
  const ctr = await ethers.getContractAt(typeName, address);
  return ctr as Type;
}

interface CoreOutput {
  poolFactory: string;
  gaugeFactory: string;
  nftDescriptor: string;
  nft: string;
  swapFeeModule: string;
  unstakedFeeModule: string;
  mixedQuoter: string;
  quoter: string;
  swapRouter: string;
}

async function main() {
  // Network ID
  const networkId = network.config.chainId as number;
  // Constants
  const CONSTANTS = Values[(networkId as unknown) as keyof typeof Values];
  // Deployments
  const deploymentDirectory = 'script/constants/output';
  const deploymentFile = join(process.cwd(), deploymentDirectory, `CoreOutput-${String(networkId)}.json`);
  const content = fs.readFileSync(deploymentFile);
  const json: CoreOutput = JSON.parse(content.toString());

  // Factory
  const clFactory = await getContractAtAddress<CLFactory>('CLFactory', json.poolFactory);
  const values = Values[(networkId as unknown) as keyof typeof Values];

  const promises: Promise<ContractTransaction>[] = [];
  const signers = await ethers.getSigners();
  let nonce = await signers[0].getTransactionCount();

  for (let i = 0; i < values.tickSpacings.length; i++) {
    const tickSpacing = values.tickSpacings[i];
    for (let j = 0; j < values.tokenA.length; j++) {
      const tokenA = await getContractAtAddress<IERC20Metadata>(erc20ABI, values.tokenA[j]);
      const tokenB = await getContractAtAddress<IERC20Metadata>(erc20ABI, values.tokenB[j]);
      const decimals0 = await tokenA.decimals();
      const decimals1 = await tokenB.decimals();
      const sqrtPricex96 = Math.sqrt(values.sqrtPriceX96[j] * Math.pow(10, decimals1 - decimals0)) * Math.pow(2, 96);
      const poolExists = await clFactory.getPool(values.tokenA[j], values.tokenB[j], tickSpacing);
      console.log(tickSpacing, tokenA.address, tokenB.address, decimals0, decimals1, sqrtPricex96, poolExists);
      if (poolExists !== ethers.constants.AddressZero) continue;
      const promise = clFactory.createPool(values.tokenA[j], values.tokenB[j], tickSpacing, BigInt(sqrtPricex96), {
        gasLimit: 5000000,
        nonce,
      });
      promises.push(promise);
      nonce += 1;
    }
  }

  // Deploy promises
  await Promise.allSettled(promises);

  // const output: CoreOutput = {
  //   poolFactory: poolFactory.address,
  //   gaugeFactory: gaugeFactory.address,
  //   nftDescriptor: nftDescriptor.address,
  //   nft: nft.address,
  //   swapFeeModule: swapFeeModule.address,
  //   unstakedFeeModule: unstakedFeeModule.address,
  //   mixedQuoter: mixedQuoter.address,
  //   quoter: quoter.address,
  //   swapRouter: router.address,
  // };

  // try {
  //   if (!existsSync(deploymentFile)) {
  //     const ws = createWriteStream(deploymentFile);
  //     ws.write(JSON.stringify(output, null, 2));
  //     ws.end();
  //   } else {
  //     await writeFile(deploymentFile, JSON.stringify(output, null, 2));
  //   }
  // } catch (err) {
  //   console.error(`Error writing output file: ${err}`);
  // }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
