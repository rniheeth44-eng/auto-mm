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

    // Show loading while fetching price
    await interaction.deferReply();

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

    await interaction.editReply({ embeds: [embed] });
  }
};
