const axios = require('axios');
const { getLtcAddress, getBtcAddress, getEthAddress, getSolAddress, getUsdtAddress } = require('./settings');

const COINGECKO_IDS = {
  BTC:           'bitcoin',
  ETH:           'ethereum',
  LTC:           'litecoin',
  SOL:           'solana',
  'USDT [ERC-20]': 'tether',
};

async function getCryptoPrice(coin) {
  try {
    const id = COINGECKO_IDS[coin];
    if (!id) return 1;
    const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`, { timeout: 8000 });
    return resp.data?.[id]?.usd || 1;
  } catch (e) {
    const fallbacks = { BTC: 65000, ETH: 3500, LTC: 85, SOL: 180, 'USDT [ERC-20]': 1 };
    return fallbacks[coin] || 1;
  }
}

function calculateFee(usdAmount) {
  if (usdAmount < 10) return 0;
  if (usdAmount < 50) return 0.50;
  if (usdAmount < 250) return 2;
  return usdAmount * 0.01;
}

const SETUP_COMMANDS = {
  LTC: '/setltcaddy',
  BTC: '/setbtcaddy',
  ETH: '/setethaddy',
  SOL: '/setsoladdy',
  'USDT [ERC-20]': '/setusdtaddy',
};

function getCryptoAddress(coin) {
  if (coin === 'LTC') return getLtcAddress() || null;
  if (coin === 'BTC') return getBtcAddress() || null;
  if (coin === 'ETH') return getEthAddress() || null;
  if (coin === 'SOL') return getSolAddress() || null;
  if (coin === 'USDT [ERC-20]') return getUsdtAddress() || null;
  return null;
}

function getSetupCommand(coin) {
  return SETUP_COMMANDS[coin] || null;
}

async function convertUsdToCrypto(usdAmount, coin) {
  const price = await getCryptoPrice(coin);
  let fee = calculateFee(usdAmount);
  if (coin === 'USDT [ERC-20]') fee += 1;
  const totalUsd = usdAmount + fee;

  let decimals = 8;
  if (coin === 'SOL') decimals = 6;
  if (coin === 'USDT [ERC-20]') decimals = 2;

  const cryptoAmount = (totalUsd / price).toFixed(decimals);
  return { price, fee, totalUsd, cryptoAmount, address: getCryptoAddress(coin) };
}

module.exports = { getCryptoPrice, calculateFee, getCryptoAddress, getSetupCommand, convertUsdToCrypto };
