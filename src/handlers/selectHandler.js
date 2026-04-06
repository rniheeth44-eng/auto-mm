const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require('discord.js');
const path = require('path');

function getNextTicketNumber() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const COIN_DISPLAY = {
  BTC:           'Bitcoin (BTC)',
  ETH:           'Ethereum (ETH)',
  LTC:           'Litecoin (LTC)',
  SOL:           'Solana (SOL)',
  'USDT [ERC-20]': 'USDT ERC-20',
};

async function handleSelectMenu(interaction, client) {
  if (interaction.customId !== 'crypto_select') return;

  const coin = interaction.values[0];
  const guild = interaction.guild;
  const user = interaction.user;

  // Defer immediately — must happen within 3 seconds
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (e) {
    console.error('selectHandler: failed to defer:', e.message);
    return;
  }

  const ticketNum = getNextTicketNumber();
  const channelName = `auto-${ticketNum}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
        },
      ],
    });
  } catch (e) {
    console.error('selectHandler: failed to create channel:', e.message);
    await interaction.editReply({ content: 'Failed to create deal channel. Make sure the bot has **Manage Channels** permission.' });
    return;
  }

  client.activeDeals.set(channel.id, {
    coin,
    channelName,
    initiator: user.id,
    initiatorTag: user.tag || user.username,
    partner: null,
    partnerTag: null,
    sender: null,
    receiver: null,
    amount: null,
    step: 'await_partner',
    rolesConfirmed: { sender: false, receiver: false },
    amountConfirmed: { sender: false, receiver: false },
    invoiceMsg: null,
  });

  await interaction.editReply({ content: `Deal channel created: <#${channel.id}>` });

  const coinDisplay = COIN_DISPLAY[coin] || coin;

  try {
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Crypto Currency Middleman System')
      .setDescription(
        `**${coinDisplay} Middleman request created successfully!**\n\n` +
        `Welcome to our automated cryptocurrency Middleman system!\n` +
        `Your cryptocurrency will be stored securely for the duration of this deal.\n` +
        `Please notify support for assistance.\n\n` +
        `${channelName}`
      );

    const welcomeFile = new AttachmentBuilder(path.join(__dirname, '../assets/welcome_small.gif'), { name: 'welcome.gif' });
    welcomeEmbed.setImage('attachment://welcome.gif');

    const securityEmbed = new EmbedBuilder()
      .setColor(0xe53935)
      .setTitle('Security Notification')
      .setDescription(
        'Our Bot and staff team will **NEVER** direct message you. Ensure all conversations related to the deal are done within this ticket. Failure to do so may put you at risk of being scammed.'
      );

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Secondary)
    );

    const partnerEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Who are you dealing with?')
      .setDescription('eg. @user\neg. 123456789123456789');

    const partnerFile = new AttachmentBuilder(path.join(__dirname, '../assets/welcome_small.gif'), { name: 'welcome2.gif' });
    partnerEmbed.setThumbnail('attachment://welcome2.gif');

    await channel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], files: [welcomeFile] });
    await channel.send({ embeds: [securityEmbed], components: [closeRow] });
    await channel.send({ embeds: [partnerEmbed], files: [partnerFile] });
  } catch (e) {
    console.error('selectHandler: failed to send ticket messages:', e.message);
  }
}

module.exports = { handleSelectMenu };
