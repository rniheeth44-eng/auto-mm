const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fakeconfirmation')
    .setDescription('Simulate a transaction detected notification')
    .addNumberOption(option =>
      option.setName('money')
        .setDescription('Amount in USD received')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('user1')
        .setDescription('First user to ping (e.g. sender)')
        .setRequired(false)
    )
    .addUserOption(option =>
      option.setName('user2')
        .setDescription('Second user to ping (e.g. receiver)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const usdAmount = interaction.options.getNumber('money');
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');

    // Defer ephemerally so no "X used /fakeconfirmation" shows in the channel
    await interaction.deferReply({ flags: 64 });

    let ltcPrice = 85;
    try {
      const axios = require('axios');
      const resp = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=usd', { timeout: 5000 });
      ltcPrice = resp.data?.litecoin?.usd || 85;
    } catch (e) {
      // fallback
    }

    const ltcAmount = (usdAmount / ltcPrice).toFixed(8);

    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Transaction has been detected')
      .setDescription('Amount Has Been Received, Its Safe And Secured inside the bot, Now Please Proceed With your Deal, Once Done Ask Sender To Release.')
      .addFields(
        { name: 'Transaction', value: '[View Transaction](https://blockchair.com/litecoin)', inline: false },
        { name: 'Required Confirmations', value: '1', inline: false },
        { name: 'Amount Received', value: `${ltcAmount} LTC ($${usdAmount.toFixed(2)} USD)`, inline: false }
      );

    // Build ping string: prefer explicit users, fall back to active deal state
    const pings = new Set();

    if (user1) pings.add(`<@${user1.id}>`);
    if (user2) pings.add(`<@${user2.id}>`);

    // Also pull from deal state if available
    if (pings.size === 0) {
      const deal = client.activeDeals.get(interaction.channel.id);
      if (deal?.sender) pings.add(`<@${deal.sender}>`);
      if (deal?.receiver) pings.add(`<@${deal.receiver}>`);
    }

    const pingContent = pings.size > 0 ? [...pings].join(' ') : undefined;

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('release_funds')
        .setLabel('Release')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel_deal')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger),
    );

    // Send embed directly to the channel
    await interaction.channel.send({ content: pingContent, embeds: [embed], components: [actionRow] });

    // Delete the ephemeral ack so nothing is left from the command
    await interaction.deleteReply();
  }
};
