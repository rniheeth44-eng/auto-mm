const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fakeconfirmation')
    .setDescription('Simulate a transaction detected notification')
    .addNumberOption(option =>
      option.setName('money')
        .setDescription('Amount in USD received')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const usdAmount = interaction.options.getNumber('money');

    // Defer ephemerally so no "X used /fakeconfirmation" shows in the channel
    await interaction.deferReply({ ephemeral: true });

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
      .setDescription('Wait for the transaction to receive the required number of confirmations.')
      .addFields(
        { name: 'Transaction', value: '[View Transaction](https://blockchair.com/litecoin)', inline: false },
        { name: 'Required Confirmations', value: '1', inline: false },
        { name: 'Amount Received', value: `${ltcAmount} LTC ($${usdAmount.toFixed(2)} USD)`, inline: false }
      );

    // Ping both users if there's an active deal in this channel
    const deal = client.activeDeals.get(interaction.channel.id);
    let pings = '';
    if (deal) {
      if (deal.sender) pings += `<@${deal.sender}> `;
      if (deal.receiver) pings += `<@${deal.receiver}>`;
    }

    // Send embed directly to the channel so it looks like a normal bot message
    await interaction.channel.send({ content: pings.trim() || undefined, embeds: [embed] });

    // Delete the ephemeral ack so nothing is left from the command
    await interaction.deleteReply();
  }
};
