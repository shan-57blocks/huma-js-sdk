import { BigNumber, BigNumberish, Overrides, ethers } from 'ethers'
import {
  POOL_NAME,
  v2Contracts,
  RECEIVABLE_V2_ABI,
  getPoolConfigContractV2,
  getPoolCreditContractV2,
} from '@huma-finance/shared'

import {
  JsonRpcProvider,
  TransactionResponse,
  Web3Provider,
} from '@ethersproject/providers'
import { getContract } from '../../utils'

/**
 * Returns an ethers contract instance for the V2 Receivable contract
 * associated with the given pool name on the current chain.
 *
 * @param {ethers.providers.Provider | ethers.Signer} signerOrProvider The provider or signer instance to use for the contract.
 * @param {number} chainId The chain id where the contract instance exists
 * @returns {Contract | null} A contract instance for the Receivable contract or null if it could not be found.
 */
export async function getReceivableContractV2(
  poolName: POOL_NAME,
  signerOrProvider: JsonRpcProvider | Web3Provider | ethers.Signer,
): Promise<v2Contracts.Receivable | null> {
  let provider
  if (signerOrProvider instanceof ethers.Signer) {
    provider = signerOrProvider.provider as JsonRpcProvider | Web3Provider
  } else {
    provider = signerOrProvider
  }

  const poolConfigContract = await getPoolConfigContractV2(poolName, provider)

  if (!poolConfigContract) {
    throw new Error('Could not find PoolConfig contract')
  }
  const receivableAsset = await poolConfigContract.receivableAsset()

  return getContract<v2Contracts.Receivable>(
    receivableAsset,
    RECEIVABLE_V2_ABI,
    signerOrProvider,
  )
}

export async function getReceivableTokenIdFromReferenceId(
  referenceId: string,
  creator: string,
  poolName: POOL_NAME,
  provider: JsonRpcProvider | Web3Provider,
): Promise<BigNumber> {
  const contract = await getReceivableContractV2(poolName, provider)
  if (!contract) {
    throw new Error('Could not find Receivable contract')
  }

  const referenceIdHash = await contract.getReferenceIdHash(
    referenceId,
    creator,
  )

  return contract.referenceIdHashToTokenId(referenceIdHash)
}

export async function getReceivableReferenceAlreadyExists(
  referenceId: string,
  signerAddress: string,
  poolName: POOL_NAME,
  provider: JsonRpcProvider | Web3Provider,
): Promise<boolean> {
  const tokenId = await getReceivableTokenIdFromReferenceId(
    referenceId,
    signerAddress,
    poolName,
    provider,
  )

  return !tokenId.isZero()
}

export async function approveReceivableTransferIfNeeded(
  signer: ethers.Signer,
  poolName: POOL_NAME,
  receivableId: BigNumberish,
  gasOpts: Overrides = {},
): Promise<TransactionResponse | null> {
  const receivableContract = await getReceivableContractV2(poolName, signer)

  if (!receivableContract) {
    throw new Error('Could not find Receivable contract')
  }

  // Check if the pool is already approved to transfer the receivable
  const provider = signer.provider as JsonRpcProvider | Web3Provider
  const poolCreditContract = await getPoolCreditContractV2(poolName, provider)

  if (!poolCreditContract) {
    throw new Error('Could not find pool credit contract')
  }

  const approvedAddress = await receivableContract.getApproved(receivableId)
  if (
    poolCreditContract.address &&
    approvedAddress === poolCreditContract.address
  ) {
    return null
  }

  return receivableContract.approve(
    poolCreditContract.address,
    receivableId,
    gasOpts,
  )
}
