const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

async function spawnPanel(channel, guild) {
  const embed = new EmbedBuilder()
    .setColor(0x00c853)
    .setTitle('Cryptocurrency')
    .setDescription(
      '**Fees:**\n' +
      '• Deals $250+: 1%\n' +
      '• Deals under $250: $2\n' +
      '• Deals under $50: $0.50\n' +
      '• __Deals under $10 are **FREE**__\n' +
      '• USDT has $1 subcharge\n\n' +
      'Press the dropdown below to select & initiate a deal with supported cryptocurrencies.'
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId('crypto_select')
    .setPlaceholder('Make a selection')
    .addOptions([
      new StringSelectMenuOptionBuilder().setLabel('BTC').setValue('BTC').setEmoji({ name: 'Bitcoin' }),
      new StringSelectMenuOptionBuilder().setLabel('ETH').setValue('ETH').setEmoji({ name: 'ethereum' }),
      new StringSelectMenuOptionBuilder().setLabel('LTC').setValue('LTC').setEmoji({ name: 'Litecoin~2' }),
      new StringSelectMenuOptionBuilder().setLabel('SOL').setValue('SOL').setEmoji({ name: 'sol' }),
      new StringSelectMenuOptionBuilder().setLabel('USDT [ERC-20]').setValue('USDT [ERC-20]').setEmoji({ name: 'usdteth' }),
    ]);

  const row = new ActionRowBuilder().addComponents(select);

  await channel.send({ embeds: [embed], components: [row] });
}

module.exports = { spawnPanel };
