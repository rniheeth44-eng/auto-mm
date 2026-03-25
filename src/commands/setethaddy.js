const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setEthAddress } = require('../utils/settings');

function isOwner(interaction) {
  const owner = interaction.client.application?.owner;
  const ownerId = owner?.ownerId ?? owner?.id;
  return interaction.user.id === ownerId;
}

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

  async execute(interaction) {
    if (!isOwner(interaction)) {
      await interaction.reply({ content: 'Only the bot owner can use this command.', flags: 64 });
      return;
    }
    await interaction.deferReply({ flags: 64 });
    const address = interaction.options.getString('address');
    setEthAddress(address);
    await interaction.editReply({ content: `ETH address updated to:\n\`${address}\`` });
  }
};
