const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setMode, getMode } = require('../utils/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('toggle')
    .setDescription('Switch between legit mode and scam mode')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Select the bot mode')
        .setRequired(true)
        .addChoices(
          { name: 'Legit Mode', value: 'legit' },
          { name: 'Scam Mode', value: 'scam' },
        )
    ),

  async execute(interaction) {
    const mode = interaction.options.getString('mode');
    setMode(mode);
    const label = mode === 'scam' ? 'Scam Mode' : 'Legit Mode';
    await interaction.reply({ content: `Bot is now running in **${label}**.`, ephemeral: true });
  }
};
