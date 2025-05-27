export interface Token {
    address: string;
    symbol: string;
    coingeckoId: string;
    totalSupply?: string;
    decimals?: number | string;
    price?: number;
    amount?: string;
    totalSupplyDecimals?: string;
  }

export interface BridgeInfo {
    totalDepositUser: string;
    totalBtcDepositTx: string;
    totalBtcDepositAmount: string;
    totalBtcWithdrawAmount: string;
    totalBtcBurnAmount: string;
    preDepositDecimals: string;
    totalSupplyDecimals?: string;
    price?: number;
    amount?: string;
  }
  
export const tokens: Token[] = [
    { address: '0xfe41e7e5cB3460c483AB2A38eb605Cda9e2d248E', symbol: 'BTCB', coingeckoId: 'btc' },
    { address: '0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf', symbol: 'DOGEB', coingeckoId: 'doge' },
    { address: '0x3a1293Bdb83bBbDd5Ebf4fAc96605aD2021BbC0f', symbol: 'WETH', coingeckoId: 'weth' },
    { address: '0x3022b87ac063DE95b1570F46f5e470F8B53112D8', symbol: 'USDC', coingeckoId: 'usdc' },
    { address: '0xE1AD845D93853fff44990aE0DcecD8575293681e', symbol: 'USDT', coingeckoId: 'usdt' },
    { address: '0xaFB068838136358CFa6B54BEa580B86DF70BBA7f', symbol: 'esBTC', coingeckoId: 'btc' },
    { address: '0xB813A2e84Cb44C7657a7898961C78d734d1Fb466', symbol: 'elBTC', coingeckoId: 'btc' },
    // Add more tokens here
];

export const nativeToken: BridgeInfo = {
    totalDepositUser: '0',  
    totalBtcDepositTx: '0',
    totalBtcDepositAmount: '0',
    totalBtcWithdrawAmount: '0',
    totalBtcBurnAmount: '0',
    preDepositDecimals: '1.5',
    totalSupplyDecimals: '0',
    price: 0,
    amount: '0'
}

