import { Contract } from '@ethersproject/contracts';
import { ethers, network } from 'hardhat';
import { Libraries } from 'hardhat/types';
import { createWriteStream, existsSync, WriteStream } from 'fs';
import { readFile, writeFile } from 'fs/promises';
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

  const ctr = (await ctrFactory.deploy(...args)) as unknown as Contract;
  await ctr.deployed();
  return ctr;
}

async function deploy<Type>(typeName: string, libraries?: Libraries, ...args: any[]): Promise<Type> {
  const ctrFactory = await ethers.getContractFactory(typeName, { libraries });

  const ctr = (await ctrFactory.deploy(...args)) as unknown as Type;
  await (ctr as unknown as Contract).deployed();
  return ctr;
}

export async function getContractAt<Type>(typeName: string, address: string): Promise<Type> {
  const ctr = (await ethers.getContractAt(typeName, address)) as unknown as Type;
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

function waitUntil(condition: () => boolean, timeoutMs = 10000) {
  return new Promise<void>((resolve, reject) => {
    const prev = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        console.info('Condition is true. Exiting [waitUntil] now');
        clearInterval(interval);
        resolve();
      } else if (Date.now() - prev >= timeoutMs) {
        clearInterval(interval);
        reject(new Error('Timed out'));
      }
    }, 50);
  });
}

async function main() {
  // Network ID
  const networkId = network.config.chainId as number;
  // Constants
  const CONSTANTS = Values[networkId as unknown as keyof typeof Values];
  const outputDirectory = 'script/constants/output';
  const outputFile = join(process.cwd(), outputDirectory, `CoreOutput-${String(networkId)}.json`);

  let ws: WriteStream | null = null;
  // Create file if it does not exist
  if (!existsSync(outputFile)) {
    ws = createWriteStream(outputFile);
    ws.write(JSON.stringify({}, null, 2));
    ws.end();
  }

  if (ws) {
    await waitUntil(() => {
      return ws.writableFinished;
    });
  }

  // Read file
  const fileContentBuffer = await readFile(outputFile);
  const output: CoreOutput = JSON.parse(fileContentBuffer.toString());

  let poolFactory: CLFactory;
  let gaugeFactory: CLGaugeFactory;
  let nftDescriptor: NonfungibleTokenPositionDescriptor;
  let nft: NonfungiblePositionManager;
  let swapFeeModule: CustomSwapFeeModule;
  let unstakedFeeModule: CustomUnstakedFeeModule;
  let mixedQuoter: MixedRouteQuoterV1;
  let quoter: QuoterV2;

  // deployment
  try {
    if (!output.poolFactory) {
      const poolImplementation = await deploy<CLPool>('CLPool');
      poolFactory = await deploy<CLFactory>('CLFactory', undefined, CONSTANTS.Voter, poolImplementation.address);
      output.poolFactory = poolFactory.address;
    } else {
      poolFactory = await getContractAt<CLFactory>('CLFactory', output.poolFactory);
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    if (!output.gaugeFactory) {
      const gaugeImplementation = await deploy<CLGauge>('CLGauge');
      gaugeFactory = await deploy<CLGaugeFactory>(
        'CLGaugeFactory',
        undefined,
        CONSTANTS.Voter,
        gaugeImplementation.address
      );
      output.gaugeFactory = gaugeFactory.address;
    } else {
      gaugeFactory = await getContractAt<CLGaugeFactory>('CLGaugeFactory', output.gaugeFactory);
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    if (!output.nftDescriptor) {
      const nftDescriptorLibrary = await deployLibrary('NFTDescriptor');
      const nftSvgLibrary = await deployLibrary('NFTSVG');
      nftDescriptor = await deploy<NonfungibleTokenPositionDescriptor>(
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
      output.nftDescriptor = nftDescriptor.address;
    } else {
      nftDescriptor = await getContractAt<NonfungibleTokenPositionDescriptor>(
        'NonfungibleTokenPositionDescriptor',
        output.nftDescriptor
      );
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    if (!output.nft) {
      nft = await deploy<NonfungiblePositionManager>(
        'NonfungiblePositionManager',
        undefined,
        poolFactory!.address,
        CONSTANTS.WETH,
        nftDescriptor!.address,
        CONSTANTS.nftName,
        CONSTANTS.nftSymbol
      );

      output.nft = nft.address;
    } else {
      nft = await getContractAt<NonfungiblePositionManager>('NonfungiblePositionManager', output.nft);
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    await gaugeFactory!.setNonfungiblePositionManager(nft!.address);
  } catch (err: any) {
    console.error(err.stack);
  }

  try {
    if (!output.swapFeeModule) {
      swapFeeModule = await deploy<CustomSwapFeeModule>('CustomSwapFeeModule', undefined, poolFactory!.address);
      output.swapFeeModule = swapFeeModule.address;
    } else {
      swapFeeModule = await getContractAt<CustomSwapFeeModule>('CustomSwapFeeModule', output.swapFeeModule);
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    if (!output.unstakedFeeModule) {
      unstakedFeeModule = await deploy<CustomUnstakedFeeModule>(
        'CustomUnstakedFeeModule',
        undefined,
        poolFactory!.address
      );
      output.unstakedFeeModule = unstakedFeeModule.address;
    } else {
      unstakedFeeModule = await getContractAt<CustomUnstakedFeeModule>(
        'CustomUnstakedFeeModule',
        output.unstakedFeeModule
      );
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    const router = await deploy<SwapRouter>('SwapRouter', undefined, poolFactory!.address, CONSTANTS.WETH);
    output.swapRouter = router.address;
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  // permissions
  try {
    await nft!.setOwner(CONSTANTS.team);
  } catch (err: any) {
    console.error(err.stack);
  }

  try {
    await poolFactory!.setOwner(CONSTANTS.poolFactoryOwner);
  } catch (err: any) {
    console.error(err.stack);
  }

  try {
    await poolFactory!.setSwapFeeManager(CONSTANTS.feeManager);
  } catch (err: any) {
    console.error(err.stack);
  }

  try {
    await poolFactory!.setUnstakedFeeManager(CONSTANTS.feeManager);
  } catch (err: any) {
    console.error(err.stack);
  }

  try {
    if (!output.mixedQuoter) {
      mixedQuoter = await deploy<MixedRouteQuoterV1>(
        'MixedRouteQuoterV1',
        undefined,
        poolFactory!.address,
        CONSTANTS.factoryV2,
        CONSTANTS.WETH
      );
      output.mixedQuoter = mixedQuoter.address;
    } else {
      mixedQuoter = await getContractAt<MixedRouteQuoterV1>('MixedRouteQuoterV1', output.mixedQuoter);
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  await writeFile(outputFile, JSON.stringify(output, null, 2));

  try {
    if (!output.quoter) {
      quoter = await deploy<QuoterV2>('QuoterV2', undefined, CONSTANTS.factoryV2, CONSTANTS.WETH);
      output.quoter = quoter.address;
    } else {
      quoter = await getContractAt<QuoterV2>('QuoterV2', output.quoter);
    }
  } catch (err: any) {
    console.error(err.stack);
  }

  console.log(`Pool Factory deployed to: ${poolFactory!.address}`);
  console.log(`NFT Position Descriptor deployed to: ${nftDescriptor!.address}`);
  console.log(`NFT deployed to: ${nft!.address}`);
  console.log(`Gauge Factory deployed to: ${gaugeFactory!.address}`);
  console.log(`Swap Fee Module deployed to: ${swapFeeModule!.address}`);
  console.log(`Unstaked Fee Module deployed to: ${unstakedFeeModule!.address}`);
  console.log(`Mixed Quoter deployed to: ${mixedQuoter!.address}`);
  console.log(`Quoter deployed to: ${quoter!.address}`);

  await writeFile(outputFile, JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
