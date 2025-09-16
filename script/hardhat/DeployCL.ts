import { Contract } from '@ethersproject/contracts';
import { ethers, network } from 'hardhat';
import { Libraries } from 'hardhat/types';
import { createWriteStream, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  CLFactory,
  CLPool,
  NonfungibleTokenPositionDescriptor,
  NonfungiblePositionManager,
  CLGauge,
  CLGaugeFactory,
  CustomSwapFeeModule,
  CustomUnstakedFeeModule,
  MixedRouteQuoterV1,
  QuoterV2,
  SwapRouter,
} from '../../artifacts/types';
import Values from '../constants/values.json';

async function deployLibrary(typeName: string, ...args: any[]): Promise<Contract> {
  const ctrFactory = await ethers.getContractFactory(typeName);

  const ctr = ((await ctrFactory.deploy(...args)) as unknown) as Contract;
  await ctr.deployed();
  return ctr;
}

async function deploy<Type>(typeName: string, libraries?: Libraries, ...args: any[]): Promise<Type> {
  const ctrFactory = await ethers.getContractFactory(typeName, { libraries });

  const ctr = ((await ctrFactory.deploy(...args)) as unknown) as Type;
  await ((ctr as unknown) as Contract).deployed();
  return ctr;
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
  // deployment
  const poolImplementation = await deploy<CLPool>('CLPool');
  const poolFactory = await deploy<CLFactory>('CLFactory', undefined, CONSTANTS.Voter, poolImplementation.address);

  const gaugeImplementation = await deploy<CLGauge>('CLGauge');
  const gaugeFactory = await deploy<CLGaugeFactory>(
    'CLGaugeFactory',
    undefined,
    CONSTANTS.Voter,
    gaugeImplementation.address
  );

  const nftDescriptorLibrary = await deployLibrary('NFTDescriptor');
  const nftSvgLibrary = await deployLibrary('NFTSVG');
  const nftDescriptor = await deploy<NonfungibleTokenPositionDescriptor>(
    'NonfungibleTokenPositionDescriptor',
    { NFTDescriptor: nftDescriptorLibrary.address, NFTSVG: nftSvgLibrary.address },
    CONSTANTS.WETH,
    CONSTANTS.nftFungibleTokenPositionDescriptorTokens.DAI,
    CONSTANTS.nftFungibleTokenPositionDescriptorTokens.USDC,
    CONSTANTS.nftFungibleTokenPositionDescriptorTokens.USDT,
    CONSTANTS.nftFungibleTokenPositionDescriptorTokens.WBTC,
    CONSTANTS.nftFungibleTokenPositionDescriptorTokens.ETH,
    CONSTANTS.chainNameBytes
  );
  const nft = await deploy<NonfungiblePositionManager>(
    'NonfungiblePositionManager',
    undefined,
    poolFactory.address,
    CONSTANTS.WETH,
    nftDescriptor.address,
    CONSTANTS.nftName,
    CONSTANTS.nftSymbol
  );

  await gaugeFactory.setNonfungiblePositionManager(nft.address);

  const swapFeeModule = await deploy<CustomSwapFeeModule>('CustomSwapFeeModule', undefined, poolFactory.address);
  const unstakedFeeModule = await deploy<CustomUnstakedFeeModule>(
    'CustomUnstakedFeeModule',
    undefined,
    poolFactory.address
  );

  const router = await deploy<SwapRouter>('SwapRouter', undefined, poolFactory.address, CONSTANTS.WETH);

  // permissions
  await nft.setOwner(CONSTANTS.team);
  await poolFactory.setOwner(CONSTANTS.poolFactoryOwner);
  await poolFactory.setSwapFeeManager(CONSTANTS.feeManager);
  await poolFactory.setUnstakedFeeManager(CONSTANTS.feeManager);

  const mixedQuoter = await deploy<MixedRouteQuoterV1>(
    'MixedRouteQuoterV1',
    undefined,
    poolFactory.address,
    CONSTANTS.factoryV2,
    CONSTANTS.WETH
  );
  const quoter = await deploy<QuoterV2>('QuoterV2', undefined, CONSTANTS.factoryV2, CONSTANTS.WETH);

  console.log(`Pool Implementation deployed to: ${poolImplementation.address}`);
  console.log(`Pool Factory deployed to: ${poolFactory.address}`);
  console.log(`NFT Position Descriptor deployed to: ${nftDescriptor.address}`);
  console.log(`NFT deployed to: ${nft.address}`);
  console.log(`Gauge Implementation deployed to: ${gaugeImplementation.address}`);
  console.log(`Gauge Factory deployed to: ${gaugeFactory.address}`);
  console.log(`Swap Fee Module deployed to: ${swapFeeModule.address}`);
  console.log(`Unstaked Fee Module deployed to: ${unstakedFeeModule.address}`);
  console.log(`Mixed Quoter deployed to: ${mixedQuoter.address}`);
  console.log(`Quoter deployed to: ${quoter.address}`);

  const outputDirectory = 'script/constants/output';
  const outputFile = join(process.cwd(), outputDirectory, `CoreOutput-${String(networkId)}.json`);

  const output: CoreOutput = {
    poolFactory: poolFactory.address,
    gaugeFactory: gaugeFactory.address,
    nftDescriptor: nftDescriptor.address,
    nft: nft.address,
    swapFeeModule: swapFeeModule.address,
    unstakedFeeModule: unstakedFeeModule.address,
    mixedQuoter: mixedQuoter.address,
    quoter: quoter.address,
    swapRouter: router.address,
  };

  try {
    if (!existsSync(outputFile)) {
      const ws = createWriteStream(outputFile);
      ws.write(JSON.stringify(output, null, 2));
      ws.end();
    } else {
      await writeFile(outputFile, JSON.stringify(output, null, 2));
    }
  } catch (err) {
    console.error(`Error writing output file: ${err}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
