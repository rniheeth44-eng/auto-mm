const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COINS = ['BTC', 'ETH', 'LTC', 'SOL', 'USDT', 'USDC'];

const COIN_CONFIG = {
  BTC: {
    ticker: 'BTC',
    label: 'Bitcoin Deal Complete',
    min: 0.001, max: 0.5, dec: 8,
    explorer: 'https://blockchair.com/bitcoin/transaction/',
    explorerLabel: 'View on Blockchair',
    icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    cgId: 'bitcoin',
    color: 0xF7931A,
  },
  ETH: {
    ticker: 'ETH',
    label: 'Ethereum Deal Complete',
    min: 0.01, max: 5, dec: 6,
    explorer: 'https://etherscan.io/tx/',
    explorerLabel: 'View on Etherscan',
    icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    cgId: 'ethereum',
    color: 0x627EEA,
  },
  LTC: {
    ticker: 'LTC',
    label: 'Litecoin Deal Complete',
    min: 0.1, max: 20, dec: 8,
    explorer: 'https://live.blockcypher.com/ltc/tx/',
    explorerLabel: 'View on BlockCypher',
    icon: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
    cgId: 'litecoin',
    color: 0xBFBFBF,
  },
  SOL: {
    ticker: 'SOL',
    label: 'Solana Deal Complete',
    min: 0.5, max: 100, dec: 4,
    explorer: 'https://solscan.io/tx/',
    explorerLabel: 'View on Solscan',
    icon: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    cgId: 'solana',
    color: 0x9945FF,
  },
  USDT: {
    ticker: 'USDT',
    label: 'USDT [TRC-20] Deal Complete',
    min: 10, max: 5000, dec: 2,
    explorer: 'https://tronscan.org/#/transaction/',
    explorerLabel: 'View on Tronscan',
    icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
    cgId: 'tether',
    color: 0x26A17B,
  },
  USDC: {
    ticker: 'USDC',
    label: 'USDC [ERC-20] Deal Complete',
    min: 10, max: 5000, dec: 2,
    explorer: 'https://etherscan.io/tx/',
    explorerLabel: 'View on Etherscan',
    icon: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png',
    cgId: 'usd-coin',
    color: 0x2775CA,
  },
};

const FALLBACK_PRICES = { BTC: 65000, ETH: 3500, LTC: 85, SOL: 180, USDT: 1, USDC: 1 };

async function getPrices() {
  try {
    const ids = Object.values(COIN_CONFIG).map(c => c.cgId).join(',');
    const resp = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { timeout: 8000 }
    );
    const prices = {};
    for (const [coin, cfg] of Object.entries(COIN_CONFIG)) {
      prices[coin] = resp.data?.[cfg.cgId]?.usd || FALLBACK_PRICES[coin];
    }
    return prices;
  } catch {
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
  const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-6)}`;

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTitle(cfg.label)
    .setThumbnail(cfg.icon)
    .addFields(
      { name: 'Amount',      value: `${cryptoAmt} ${cfg.ticker} ($${usdAmt} USD)`, inline: false },
      { name: 'Sender',      value: 'Anonymous',                                    inline: false },
      { name: 'Receiver',    value: 'Anonymous',                                    inline: false },
      { name: 'Transaction', value: `[${shortHash}](${cfg.explorer}${txHash})`,     inline: false },
    );

  const button = new ButtonBuilder()
    .setLabel(cfg.explorerLabel)
    .setURL(`${cfg.explorer}${txHash}`)
    .setStyle(ButtonStyle.Link);

  const components = [new ActionRowBuilder().addComponents(button)];

  return { embed, components };
}

module.exports = { COINS, getPrices, buildEmbed };
