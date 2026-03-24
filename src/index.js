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
client.activeDeals = new Map(); // channelId -> deal state

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

  // Register slash commands globally
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsData });
    console.log('Slash commands registered');
  } catch (err) {
    console.error('Error registering slash commands:', err);
  }
});

// Message handler for prefix commands and deal flow
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // .halalauto command
  if (message.content.toLowerCase() === '.halalauto') {
    const { spawnPanel } = require('./handlers/panelHandler');
    await spawnPanel(message.channel, message.guild);
    return;
  }

  // Handle deal channel messages (collecting trade partner, amount, etc.)
  const deal = client.activeDeals.get(message.channel.id);
  if (deal) {
    const { handleDealMessage } = require('./handlers/dealHandler');
    await handleDealMessage(message, deal, client);
  }
});

// Interaction handler (buttons, select menus, slash commands)
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
    }
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
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is not set!');
  process.exit(1);
}

client.login(token);
