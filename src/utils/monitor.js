const axios = require('axios');

let lastTxHash = null;
let monitorInterval = null;

async function checkLTCTransactions(address, client) {
  try {
    const resp = await axios.get(
      `https://api.blockchair.com/litecoin/dashboards/address/${address}?limit=1`,
      { timeout: 10000 }
    );
    const txs = resp.data?.data?.[address]?.transactions;
    if (!txs || txs.length === 0) return;

    const latest = txs[0];
    if (latest === lastTxHash) return;

    const prev = lastTxHash;
    lastTxHash = latest;

    if (prev === null) return;

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    for (const [channelId, deal] of client.activeDeals.entries()) {
      if (deal.step !== 'awaiting_payment') continue;
      try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        const embed = new EmbedBuilder()
          .setColor(0x00c853)
          .setTitle('Transaction has been detected')
          .setDescription('Amount Has Been Received, Its Safe And Secured inside the bot, Now Please Proceed With your Deal, Once Done Ask Sender To Release.');

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('release_funds').setLabel('Release').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('cancel_deal').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        );

        let pings = '';
        if (deal.sender) pings += `<@${deal.sender}> `;
        if (deal.receiver) pings += `<@${deal.receiver}>`;

        await channel.send({ content: pings.trim() || undefined, embeds: [embed], components: [actionRow] });
      } catch (e) {
        console.error('Monitor: error notifying channel:', e.message);
      }
    }
  } catch (e) {}
}

function startMonitor(address, client) {
  if (monitorInterval) clearInterval(monitorInterval);
  lastTxHash = null;
  checkLTCTransactions(address, client);
  monitorInterval = setInterval(() => checkLTCTransactions(address, client), 30000);
  console.log(`LTC monitor started: ${address}`);
}

function stopMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
}

module.exports = { startMonitor, stopMonitor };
