const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fakeconfirmation')
    .setDescription('Simulate a transaction detected notification')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
    const { getMercyRoleId } = require('../utils/settings');

    // Allow admins OR users who have the mercy role
    const isAdmin = interaction.memberPermissions?.has('Administrator');
    const mercyRoleId = getMercyRoleId();
    const hasMercyRole = mercyRoleId && interaction.member?.roles?.cache?.has(mercyRoleId);

    if (!isAdmin && !hasMercyRole) {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      return;
    }

    const usdAmount = interaction.options.getNumber('money');
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');

    await interaction.deferReply({ flags: 64 });

    const deal = client.activeDeals.get(interaction.channel.id);
    const coin = deal?.coin || 'LTC';

    let coinPrice = 85;
    let coinTicker = coin.split(' ')[0];
    try {
      const axios = require('axios');
      const COINGECKO_IDS = {
        BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', SOL: 'solana', USDT: 'tether',
      };
      const cgId = COINGECKO_IDS[coinTicker] || 'litecoin';
      const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, { timeout: 5000 });
      coinPrice = resp.data?.[cgId]?.usd || 85;
    } catch (e) {}

    const cryptoAmount = (usdAmount / coinPrice).toFixed(8);

    const checkmarkFile = new AttachmentBuilder(path.join(__dirname, '../assets/checkmark.jpg'), { name: 'checkmark.jpg' });

    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Transaction has been detected')
      .setDescription('Amount Has Been Received, Its Safe And Secured inside the bot, Now Please Proceed With your Deal, Once Done Ask Sender To Release.')
      .setThumbnail('attachment://checkmark.jpg')
      .addFields(
        { name: 'Transaction', value: '[View Transaction](https://blockchair.com/litecoin)', inline: false },
        { name: 'Required Confirmations', value: '1', inline: false },
        { name: 'Amount Received', value: `${cryptoAmount} ${coinTicker} ($${usdAmount.toFixed(2)} USD)`, inline: false }
      );

    const pings = new Set();
    if (user1) pings.add(`<@${user1.id}>`);
    if (user2) pings.add(`<@${user2.id}>`);
    if (pings.size === 0) {
      if (deal?.sender) pings.add(`<@${deal.sender}>`);
      if (deal?.receiver) pings.add(`<@${deal.receiver}>`);
    }

    const pingContent = pings.size > 0 ? [...pings].join(' ') : undefined;

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('release_funds').setLabel('Release').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel_deal').setLabel('Cancel').setStyle(ButtonStyle.Danger),
    );

    await interaction.channel.send({ content: pingContent, embeds: [embed], components: [actionRow], files: [checkmarkFile] });

    await interaction.deleteReply();
  }
};
