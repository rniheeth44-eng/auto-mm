const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { setLogChannelId } = require('../utils/settings');
const { COINS, getPrices, buildEmbed } = require('../utils/txlog');

const LOG_INTERVAL = 5 * 60 * 1000;

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

    async function sendLog() {
      try {
        const ch = await client.channels.fetch(channel.id).catch(() => null);
        if (!ch) { clearInterval(client.logInterval); return; }

        const prices = await getPrices();
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
          const coin = COINS[Math.floor(Math.random() * COINS.length)];
          const embed = buildEmbed(coin, prices);
          await ch.send({ embeds: [embed] });
          if (i < count - 1) await new Promise(r => setTimeout(r, 1200));
        }
      } catch (e) {
        console.error('sendlogs error:', e.message);
      }
    }

    await sendLog();
    client.logInterval = setInterval(sendLog, LOG_INTERVAL);

    await interaction.editReply({ content: `Transaction logs will be sent to <#${channel.id}> every 5 minutes.` });
  }
};
