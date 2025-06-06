// A simple map for common token symbols to CoinGecko API IDs
// This can be expanded as needed.
const COINGECKO_IDS: { [symbol: string]: string } = {
  ETH: "ethereum",
  WETH: "weth", // Wrapped Ether often has its own ID
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  LINK: "chainlink",
  MATIC: "matic-network", // Polygon's MATIC
  // Add more common tokens your users might use
}

/**
 * Fetches the current price of a token in a specified fiat currency.
 * @param tokenSymbol The symbol of the token (e.g., "ETH", "USDC").
 * @param currency The fiat currency to get the price in (e.g., "usd", "eur"). Defaults to "usd".
 * @returns The price of one unit of the token in the specified fiat currency.
 * @throws If the token symbol is not supported or if the API request fails.
 */
export async function getTokenPrice(tokenSymbol: string, currency = "usd"): Promise<number> {
  const tokenId = COINGECKO_IDS[tokenSymbol.toUpperCase()]
  if (!tokenId) {
    console.error(
      `Token ID not found for symbol: ${tokenSymbol}. Supported symbols: ${Object.keys(COINGECKO_IDS).join(", ")}`,
    )
    throw new Error(`Price information for ${tokenSymbol} is not available at the moment.`)
  }

  const currencyCode = currency.toLowerCase()
  const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=${currencyCode}`

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) {
      const errorBody = await response.text()
      console.error(`CoinGecko API request failed: ${response.status} ${response.statusText}`, errorBody)
      throw new Error(`Unable to fetch price for ${tokenSymbol}. The price service might be temporarily unavailable.`)
    }

    const data = await response.json()

    if (!data[tokenId] || typeof data[tokenId][currencyCode] === "undefined") {
      console.error(`Price data not found in CoinGecko response for ${tokenId} in ${currencyCode}`, data)
      throw new Error(`Price data for ${tokenSymbol} in ${currency.toUpperCase()} could not be retrieved.`)
    }

    return data[tokenId][currencyCode]
  } catch (error) {
    console.error(`Error fetching token price for ${tokenSymbol} in ${currencyCode}:`, error)
    if (error instanceof Error && error.message.startsWith("Price information for")) {
      throw error // Re-throw specific known errors
    }
    throw new Error(`An issue occurred while trying to get the price for ${tokenSymbol}. Please try again later.`)
  }
}
