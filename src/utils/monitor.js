const axios = require('axios');
const path = require('path');

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

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');

    for (const [channelId, deal] of client.activeDeals.entries()) {
      if (deal.step !== 'awaiting_payment') continue;
      try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        const checkmarkFile = new AttachmentBuilder(path.join(__dirname, '../assets/checkmark.jpg'), { name: 'checkmark.jpg' });

        const embed = new EmbedBuilder()
          .setColor(0x00c853)
          .setTitle('Transaction has been detected')
          .setDescription('Amount Has Been Received, Its Safe And Secured inside the bot, Now Please Proceed With your Deal, Once Done Ask Sender To Release.')
          .setThumbnail('attachment://checkmark.jpg');

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('release_funds').setLabel('Release').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('cancel_deal').setLabel('Cancel').setStyle(ButtonStyle.Danger),
        );

        let pings = '';
        if (deal.sender) pings += `<@${deal.sender}> `;
        if (deal.receiver) pings += `<@${deal.receiver}>`;

        await channel.send({ content: pings.trim() || undefined, embeds: [embed], components: [actionRow], files: [checkmarkFile] });
      } catch (e) {
        console.error('Monitor: error notifying channel:', e.message);
      }
    }
  } catch (e) {}
}

async function sendScamMessage(channel, deal, client) {
  try {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
    const { getMercyRoleId } = require('./settings');

    const scamFile = new AttachmentBuilder(path.join(__dirname, '../assets/scmsg.jpg'), { name: 'scmsg.jpg' });

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
      new ButtonBuilder()
        .setCustomId('mercy_join')
        .setLabel('Join Us')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('mercy_leave')
        .setLabel('Leave')
        .setStyle(ButtonStyle.Danger),
    );

    const targetId = deal.receiver || deal.initiator;
    const pingContent = targetId ? `<@${targetId}>` : undefined;

    await channel.send({ content: pingContent, embeds: [embed], components: [actionRow], files: [scamFile] });
  } catch (e) {
    console.error('sendScamMessage error:', e.message);
  }
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

module.exports = { startMonitor, stopMonitor, sendScamMessage };
