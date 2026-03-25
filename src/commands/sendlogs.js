const { SlashCommandBuilder } = require('discord.js');
const { setLogChannelId } = require('../utils/settings');
const { COINS, getPrices, buildEmbed } = require('../utils/txlog');

const SMALL_INTERVAL  = 5  * 60 * 1000;
const LARGE_INTERVAL  = 15 * 60 * 1000;

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

    if (client.logInterval)      { clearInterval(client.logInterval);      client.logInterval      = null; }
    if (client.logLargeInterval) { clearInterval(client.logLargeInterval); client.logLargeInterval = null; }

    async function sendBatch(count, usdMin, usdMax) {
      try {
        const ch = await client.channels.fetch(channel.id).catch(() => null);
        if (!ch) return;

        const prices = await getPrices();
        for (let i = 0; i < count; i++) {
          const coin = COINS[Math.floor(Math.random() * COINS.length)];
          const embed = buildEmbed(coin, prices, usdMin, usdMax);
          await ch.send({ embeds: [embed] });
          await new Promise(r => setTimeout(r, 800));
        }
      } catch (e) {
        console.error('sendlogs error:', e.message);
      }
    }

    // Initial burst: 80 small transactions
    sendBatch(80, 5, 400);

    // Every 5 mins: 2–5 small transactions ($5–$400)
    client.logInterval = setInterval(() => {
      const count = Math.floor(Math.random() * 4) + 2;
      sendBatch(count, 5, 400);
    }, SMALL_INTERVAL);

    // Every 15 mins: 1–3 large transactions ($1000–$8000)
    client.logLargeInterval = setInterval(() => {
      const count = Math.floor(Math.random() * 3) + 1;
      sendBatch(count, 1000, 8000);
    }, LARGE_INTERVAL);

    await interaction.editReply({ content: `Sending 80 transactions now to <#${channel.id}>. Then 2–5 small ones every 5 mins, and 1–3 large ($1k–$8k) every 15 mins.` });
  }
};
