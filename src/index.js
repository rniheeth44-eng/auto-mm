const { Client, GatewayIntentBits, Partials, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.activeDeals = new Map();

// Load commands
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
const commandsData = [];
for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  client.commands.set(command.data.name, command);
  commandsData.push(command.data.toJSON ? command.data.toJSON() : command.data);
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  try {
    for (const guild of client.guilds.cache.values()) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commandsData });
      console.log(`Slash commands registered in guild: ${guild.name}`);
    }
  } catch (err) {
    console.error('Error registering slash commands:', err.message);
  }

  // Auto-start LTC monitor if address saved
  try {
    const { getLtcAddress } = require('./utils/settings');
    const { startMonitor } = require('./utils/monitor');
    const addr = getLtcAddress();
    if (addr) startMonitor(addr, client);
  } catch (e) {
    console.error('Monitor start error:', e.message);
  }
});

// Global error handlers
client.on('error', (err) => console.error('Discord client error:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err?.message || err));

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === '.halalauto') {
    try {
      const { spawnPanel } = require('./handlers/panelHandler');
      await spawnPanel(message.channel, message.guild);
    } catch (err) {
      console.error('.halalauto error:', err.message);
    }
    return;
  }

  // Legacy prefix setmercyrole support
  if (message.content.toLowerCase().startsWith('.setmercyrole')) {
    try {
      const { setMercyRoleId, getMercyRoleId } = require('./utils/settings');
      const { EmbedBuilder } = require('discord.js');
      const role = message.mentions.roles.first();
      if (!role) {
        await message.reply({ embeds: [new EmbedBuilder().setColor(0xfdd835).setDescription('⚠️ No mercy role has been set. Ask an admin to run `.setmercyrole @role`.')] });
        return;
      }
      setMercyRoleId(role.id);
      const embed = new EmbedBuilder()
        .setColor(0x00c853)
        .setDescription(`✅ Set\n<@&${role.id}> is mercy`);
      await message.reply({ embeds: [embed] });
      const welcomeMsg =
        `<@${message.author.id}> Welcome! Now you're part of our fake Middleman — which is how we got you — so you can hit on others and take your revenge. 😈\n\n` +
        `Check the guide channel for tips and guides.\n\n` +
        `You've also received <@&${role.id}> — our hitter role. Keep it safe. 🔒\n` +
        `<@${message.author.id}> has accepted his faith, and wanted to join us. 🤝`;
      await message.channel.send(welcomeMsg);
    } catch (err) {
      console.error('.setmercyrole error:', err.message);
    }
    return;
  }

  const deal = client.activeDeals.get(message.channel.id);
  if (deal) {
    try {
      const { handleDealMessage } = require('./handlers/dealHandler');
      await handleDealMessage(message, deal, client);
    } catch (err) {
      console.error('Deal message error:', err.message);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const { handleSelectMenu } = require('./handlers/selectHandler');
      await handleSelectMenu(interaction, client);
      return;
    }

    if (interaction.isButton()) {
      const { handleButton } = require('./handlers/buttonHandler');
      await handleButton(interaction, client);
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err.message);
    try {
      const msg = { content: 'Something went wrong. Please try again.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch (_) {}
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is not set!');
  process.exit(1);
}

client.login(token);
