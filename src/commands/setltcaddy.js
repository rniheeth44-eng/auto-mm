const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setLtcAddress } = require('../utils/settings');
const { startMonitor } = require('../utils/monitor');

function isOwner(interaction) {
  const owner = interaction.client.application?.owner;
  const ownerId = owner?.ownerId ?? owner?.id;
  return interaction.user.id === ownerId;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setltcaddy')
    .setDescription('Set the LTC wallet address shown in payment invoices')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('address')
        .setDescription('The LTC wallet address')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    if (!isOwner(interaction)) {
      await interaction.reply({ content: 'Only the bot owner can use this command.', flags: 64 });
      return;
    }
    await interaction.deferReply({ flags: 64 });
    const address = interaction.options.getString('address');
    setLtcAddress(address);
    startMonitor(address, client);
    await interaction.editReply({ content: `LTC address updated to:\n\`${address}\`\n\nBlockchain monitor restarted.` });
  }
};
