const axios = require('axios');
const { EmbedBuilder } = require('discord.js');

const COINS = ['BTC', 'ETH', 'LTC', 'SOL', 'USDT'];

const COIN_CONFIG = {
  BTC:  { ticker: 'BTC', min: 0.001, max: 0.5,    dec: 8, explorer: 'https://blockchair.com/bitcoin/transaction/',   icon: 'https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png',   cgId: 'bitcoin'  },
  ETH:  { ticker: 'ETH', min: 0.01,  max: 5,      dec: 6, explorer: 'https://etherscan.io/tx/',                       icon: 'https://assets.coingecko.com/coins/images/279/thumb/ethereum.png', cgId: 'ethereum' },
  LTC:  { ticker: 'LTC', min: 0.1,   max: 20,     dec: 8, explorer: 'https://blockchair.com/litecoin/transaction/',   icon: 'https://assets.coingecko.com/coins/images/2/thumb/litecoin.png',  cgId: 'litecoin' },
  SOL:  { ticker: 'SOL', min: 0.5,   max: 100,    dec: 4, explorer: 'https://solscan.io/tx/',                         icon: 'https://assets.coingecko.com/coins/images/4128/thumb/solana.png', cgId: 'solana'   },
  USDT: { ticker: 'USDT', min: 10,   max: 5000,   dec: 2, explorer: 'https://etherscan.io/tx/',                       icon: 'https://assets.coingecko.com/coins/images/325/thumb/Tether.png',  cgId: 'tether'   },
};

const FALLBACK_PRICES = { BTC: 65000, ETH: 3500, LTC: 85, SOL: 180, USDT: 1 };

async function getPrices() {
  try {
    const ids = Object.values(COIN_CONFIG).map(c => c.cgId).join(',');
    const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, { timeout: 8000 });
    const prices = {};
    for (const [coin, cfg] of Object.entries(COIN_CONFIG)) {
      prices[coin] = resp.data?.[cfg.cgId]?.usd || FALLBACK_PRICES[coin];
    }
    return prices;
  } catch (e) {
    return { ...FALLBACK_PRICES };
  }
}

function randFloat(min, max, dec) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function randHex(len) {
  return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateTxHash(coin) {
  if (coin === 'SOL') {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    return [...Array(88)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
  return randHex(64);
}

function buildEmbed(coin, prices, usdMin = 5, usdMax = 400) {
  const cfg = COIN_CONFIG[coin];
  const price = prices[coin] || FALLBACK_PRICES[coin];
  const usdAmt = randFloat(usdMin, usdMax, 2);
  const cryptoAmt = parseFloat((usdAmt / price).toFixed(cfg.dec));
  const txHash = generateTxHash(coin);
  const shortHash = `${txHash.slice(0, 8)}...${txHash.slice(-8)}`;

  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: '• Trade Completed', iconURL: cfg.icon })
    .setDescription(`**${cryptoAmt} ${cfg.ticker} ($${usdAmt} USD)**`)
    .addFields(
      { name: 'Sender',         value: 'Anonymous',                                             inline: false },
      { name: 'Receiver',       value: 'Anonymous',                                             inline: false },
      { name: 'Transaction ID', value: `[${shortHash}](${cfg.explorer}${txHash})`,              inline: false },
    );
}

module.exports = { COINS, getPrices, buildEmbed };
