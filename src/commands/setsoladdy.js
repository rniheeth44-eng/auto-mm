const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setSolAddress } = require('../utils/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setsoladdy')
    .setDescription('Set the SOL wallet address shown in payment invoices')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('address')
        .setDescription('The Solana wallet address')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const address = interaction.options.getString('address');
    setSolAddress(address);
    await interaction.editReply({ content: `SOL address updated to:\n\`${address}\`` });
  }
};
