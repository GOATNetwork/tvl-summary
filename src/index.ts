import 'dotenv/config';
import axios from 'axios';
import NodeCache from 'node-cache';
import express from 'express';
import BigNumber from 'bignumber.js';
import { tokens, type Token, type BridgeInfo, nativeToken } from './tokens';

const CACHE_TTL = process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 600; // 10 minutes
const cache = new NodeCache({ stdTTL: CACHE_TTL });
const EXPLORER_URL = process.env.EXPLORER_URL || 'https://explorer.goat.network';
const GRAPH_API_URL = process.env.GRAPH_API_URL || 'https://api.goat.0xgraph.xyz/api/public/e5bfe339-4592-4920-a210-815c653c6796/subgraphs/goat-bridge/v0.0.1/gn';

// Add function to fetch Native Token data from subgraph
const fetchNativeTokenData = async (): Promise<BridgeInfo | null> => {
  const cacheKey = 'nativeTokenData';
  let nativeData = cache.get(cacheKey);
  
  if (!nativeData) {
    try {
      const response = await axios.post(GRAPH_API_URL, {
        query: `query BridgeAggregationData {
          bridgeAggregationDatas {
            id
            totalDepositUser
            totalBtcDepositTx
            totalBtcDepositAmount
            totalBtcWithdrawAmount
          }
        }`,
        operationName: "BridgeAggregationData",
        extensions: {}
      }, {
        headers: {
          'accept': 'application/graphql-response+json, application/json, multipart/mixed',
          'content-type': 'application/json',
        }
      });
      
      nativeData = response.data.data.bridgeAggregationDatas[0];
      cache.set(cacheKey, nativeData, CACHE_TTL);
    } catch (error) {
      console.error('Error fetching Native Token data:', error);
      return null;
    }
  }
  
  return nativeData as BridgeInfo | null;
};

const fetchTokenData = async (token: Token) => {
  try {
    const response = await axios.get(`${EXPLORER_URL}/api/v2/tokens/${token.address}`);
    token.totalSupply = response.data.total_supply;
    token.decimals = response.data.decimals;
  } catch (error) {
    console.error(`Error fetching data for token ${token.symbol}:`, error);
  }
};

const fetchTokenDataWithCache = async (token: Token) => {
  const cacheKey = `tokenData-${token.address}`;
  let tokenData = cache.get<{ totalSupply: string; decimals: number }>(cacheKey);
  if (!tokenData) {
    await fetchTokenData(token);
    cache.set(cacheKey, { totalSupply: token.totalSupply, decimals: token.decimals });
  } else {
    token.totalSupply = tokenData.totalSupply;
    token.decimals = tokenData.decimals;
  }
};

const fetchAllTokenPricesWithCache = async () => {
  const cacheKey = 'allTokenPrices';
  let prices = cache.get<{ [key: string]: { usd: number } }>(cacheKey);
  if (!prices) {
    try {
      const symbols = tokens.map(token => token.coingeckoId.toUpperCase()).join(',');
      const response = await axios.get(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbols}&tsyms=USD`);
      
      const transformedPrices: { [key: string]: { usd: number } } = {};
      for (const symbol in response.data) {
        transformedPrices[symbol.toLowerCase()] = { usd: response.data[symbol].USD.toString() };
      }
      
      prices = transformedPrices;
      cache.set(cacheKey, prices, 600); // Cache for 10 minutes
    } catch (error) {
      console.error('Error fetching prices:', error);
      return {};
    }
  }
  return prices;
};

const calculateTVLWithBatchPrice = async () => {
  let totalTVL = new BigNumber(0);
  const prices = await fetchAllTokenPricesWithCache();
  
  if (!prices) {
    console.error('Failed to fetch prices.');
    return "0";
  }

  // Fetch Native Token data
  const nativeTokenData = await fetchNativeTokenData();

  if (nativeTokenData) {
    try {
      // Add Native Token specific data to the token object
      nativeToken.totalDepositUser = nativeTokenData.totalDepositUser;
      nativeToken.totalBtcDepositTx = nativeTokenData.totalBtcDepositTx;
      nativeToken.totalBtcDepositAmount = nativeTokenData.totalBtcDepositAmount;
      nativeToken.totalBtcWithdrawAmount = nativeTokenData.totalBtcWithdrawAmount;
      nativeToken.totalBtcBurnAmount = "0";

      const nativeTokenPrice = prices['btc']?.usd ?? 0;
      nativeToken.price = nativeTokenPrice;
      
      const depositAmount = new BigNumber(nativeToken.totalBtcDepositAmount).dividedBy(new BigNumber(10).pow(18));
      const withdrawAmount = new BigNumber(nativeToken.totalBtcWithdrawAmount).dividedBy(new BigNumber(10).pow(18));
      const burnAmount = new BigNumber(nativeToken.totalBtcBurnAmount).dividedBy(new BigNumber(10).pow(18));
      const preDeposit = new BigNumber(1.5); // 1.5 BTC pre-deposit
      
      const baseAmountDecimals = depositAmount.minus(withdrawAmount).minus(burnAmount).plus(preDeposit);
      nativeToken.totalSupplyDecimals = baseAmountDecimals.toString();

      const amount = baseAmountDecimals.times(nativeTokenPrice);
      nativeToken.amount = amount.toString();
      totalTVL = totalTVL.plus(amount);
    } catch (error) {
      console.error('Error calculating TVL for Native Token:', error);
    }
  }
  
  for (const token of tokens) {
    await fetchTokenDataWithCache(token);
    const tokenPrice = prices[token.coingeckoId.toLowerCase()]?.usd ?? 0;
    token.price = tokenPrice;

    if (token.totalSupply && token.decimals) {
      try {
        const baseAmount = new BigNumber(token.totalSupply).dividedBy(new BigNumber(10).pow(token.decimals));
        token.totalSupplyDecimals = baseAmount.toString();
        
        const amount = baseAmount.times(tokenPrice);
        token.amount = amount.toString();
        totalTVL = totalTVL.plus(amount);
      } catch (error) {
        console.error(`Error calculating TVL for ${token.symbol}:`, error);
        token.amount = "0";
      }
    } else {
      token.amount = "0";
    }
  }
  
  return totalTVL.toString();
};

const app = express();
const PORT = process.env.PORT || 3000;
cache.del('allTokenPrices');

app.get('/tvl', async (req, res) => {
  try {
    const totalTVL = await calculateTVLWithBatchPrice();
    res.json({ totalTVL, nativeToken, tokens });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate TVL' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
