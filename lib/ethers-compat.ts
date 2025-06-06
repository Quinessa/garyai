/**
 * Ethers.js compatibility layer
 * This file provides a consistent API regardless of whether we're using ethers v5 or v6
 */

import { ethers } from "ethers"

// Check if we're using ethers v5 or v6
const isEthersV5 = !!(ethers as any).providers && !!(ethers as any).utils

// Export a consistent API
export const providers = isEthersV5
  ? (ethers as any).providers
  : {
      JsonRpcProvider: ethers.JsonRpcProvider,
      Provider: ethers.Provider,
      getDefaultProvider: ethers.getDefaultProvider,
    }

export const utils = isEthersV5
  ? (ethers as any).utils
  : {
      parseEther: ethers.parseEther,
      formatEther: ethers.formatEther,
      parseUnits: ethers.parseUnits,
      formatUnits: ethers.formatUnits,
    }

// Re-export the rest of ethers
export { ethers }

// Helper functions that work with both v5 and v6
export function parseEther(value: string): any {
  return isEthersV5 ? (ethers as any).utils.parseEther(value) : ethers.parseEther(value)
}

export function formatEther(value: any): string {
  return isEthersV5 ? (ethers as any).utils.formatEther(value) : ethers.formatEther(value)
}

export function parseUnits(value: string, decimals: number): any {
  return isEthersV5 ? (ethers as any).utils.parseUnits(value, decimals) : ethers.parseUnits(value, decimals)
}

export function formatUnits(value: any, decimals: number): string {
  return isEthersV5 ? (ethers as any).utils.formatUnits(value, decimals) : ethers.formatUnits(value, decimals)
}

export function getJsonRpcProvider(url: string): any {
  return isEthersV5 ? new (ethers as any).providers.JsonRpcProvider(url) : new ethers.JsonRpcProvider(url)
}

export function getDefaultProvider(network: string): any {
  return isEthersV5 ? (ethers as any).getDefaultProvider(network) : ethers.getDefaultProvider(network)
}

export function createBigNumber(value: string | number): any {
  return isEthersV5 ? (ethers as any).BigNumber.from(value) : ethers.getBigInt(value.toString())
}

export function mulBigNumber(a: any, b: number): any {
  return isEthersV5 ? a.mul(b) : a * BigInt(b)
}

export function divBigNumber(a: any, b: number): any {
  return isEthersV5 ? a.div(b) : a / BigInt(b)
}
