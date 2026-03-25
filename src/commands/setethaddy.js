const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setEthAddress } = require('../utils/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setethaddy')
    .setDescription('Set the ETH wallet address shown in payment invoices')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('address')
        .setDescription('The Ethereum wallet address')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const address = interaction.options.getString('address');
    setEthAddress(address);
    await interaction.editReply({ content: `ETH address updated to:\n\`${address}\`` });
  }
};
