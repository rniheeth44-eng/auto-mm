const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { setLogChannelId } = require('../utils/settings');
const { COINS, getPrices, buildEmbed } = require('../utils/txlog');

const LOG_INTERVAL = 15 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendlogs')
    .setDescription('Send fake transaction logs to a channel every 5 minutes')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send transaction logs to')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const channel = interaction.options.getChannel('channel');

    setLogChannelId(channel.id);

    if (client.logInterval) {
      clearInterval(client.logInterval);
      client.logInterval = null;
    }

    async function sendBatch(count) {
      try {
        const ch = await client.channels.fetch(channel.id).catch(() => null);
        if (!ch) { clearInterval(client.logInterval); return; }

        const prices = await getPrices();
        for (let i = 0; i < count; i++) {
          const coin = COINS[Math.floor(Math.random() * COINS.length)];
          const embed = buildEmbed(coin, prices);
          await ch.send({ embeds: [embed] });
          await new Promise(r => setTimeout(r, 800));
        }
      } catch (e) {
        console.error('sendlogs error:', e.message);
      }
    }

    // Initial burst: 80 transactions to get channel up to 5k+ history fast
    sendBatch(80);

    // Then every 15 mins send 5–15 more
    client.logInterval = setInterval(() => {
      const count = Math.floor(Math.random() * 11) + 5;
      sendBatch(count);
    }, LOG_INTERVAL);

    await interaction.editReply({ content: `Sending 80 transactions now to <#${channel.id}>, then 5–15 more every 15 minutes.` });
  }
};
