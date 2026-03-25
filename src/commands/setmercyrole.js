const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { setMercyRoleId, getMercyRoleId } = require('../utils/settings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setmercyrole')
    .setDescription('Set the role given to users who click Join Us after the scam message')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The mercy/hitter role to assign')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    const role = interaction.options.getRole('role');
    setMercyRoleId(role.id);

    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setDescription(`✅ Set\n<@&${role.id}> is mercy`);

    await interaction.editReply({ embeds: [embed] });
  }
};
