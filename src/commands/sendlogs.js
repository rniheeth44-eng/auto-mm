const { SlashCommandBuilder } = require('discord.js');
const { setLogChannelId } = require('../utils/settings');
const { COINS, getPrices, buildEmbed } = require('../utils/txlog');

const INTERVAL = 2 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendlogs')
    .setDescription('Send fake transaction logs to a channel every 2 seconds')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send transaction logs to')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const channel = interaction.options.getChannel('channel');

    setLogChannelId(channel.id);

    if (client.logInterval) { clearInterval(client.logInterval); client.logInterval = null; }

    async function sendOne(usdMin, usdMax) {
      try {
        const ch = await client.channels.fetch(channel.id).catch(() => null);
        if (!ch) return;
        const prices = await getPrices();
        const coin = COINS[Math.floor(Math.random() * COINS.length)];
        const { embed, components } = buildEmbed(coin, prices, usdMin, usdMax);
        await ch.send({ embeds: [embed], components });
      } catch (e) {
        console.error('sendlogs error:', e.message);
      }
    }

    sendOne(5, 8000);

    client.logInterval = setInterval(() => {
      const usdMax = Math.random() < 0.15 ? 8000 : 400;
      sendOne(5, usdMax);
    }, INTERVAL);

    await interaction.editReply({ content: `Now sending transaction logs to <#${channel.id}> every 2 seconds.` });
  }
};
