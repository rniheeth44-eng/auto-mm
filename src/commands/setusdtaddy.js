const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setUsdtAddress } = require('../utils/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setusdtaddy')
    .setDescription('Set the USDT wallet address shown in payment invoices')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('address')
        .setDescription('The USDT (ERC-20) wallet address')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const address = interaction.options.getString('address');
    setUsdtAddress(address);
    await interaction.editReply({ content: `USDT address updated to:\n\`${address}\`` });
  }
};
