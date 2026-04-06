const { Client, GatewayIntentBits, Partials, REST, Routes, Collection, EmbedBuilder } = require('discord.js');
  const fs = require('fs');
  const path = require('path');
  const http = require('http');
  const { spawnPanel } = require('./handlers/panelHandler');
  const { handleSelectMenu } = require('./handlers/selectHandler');
  const { handleButton } = require('./handlers/buttonHandler');
  const { handleDealMessage } = require('./handlers/dealHandler');
  const { setMercyRoleId, getLtcAddress, getMode } = require('./utils/settings');
  const { startMonitor, startAllMonitors } = require('./utils/monitor');

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[FATAL] DISCORD_BOT_TOKEN is not set! Exiting.');
    process.exit(1);
  }

  // ── HTTP keepalive server (required by Render to stay alive) ─────────────
  const PORT = process.env.PORT || 3001;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is online!');
  });
  server.listen(PORT, () => {
    console.log('[HTTP] Keepalive server running on port ' + PORT);
  });

  function createClient() {
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
      console.log('[BOT] Logged in as ' + client.user.tag);

      const rest = new REST({ version: '10' }).setToken(token);
      try {
        for (const guild of client.guilds.cache.values()) {
          await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commandsData });
          console.log('[BOT] Slash commands registered in guild: ' + guild.name);
        }
      } catch (err) {
        console.error('[BOT] Error registering slash commands:', err.message);
      }

      try {
        const ltcAddr = getLtcAddress();
        if (ltcAddr) startMonitor(ltcAddr, client);
        startAllMonitors(client);
      } catch (e) {
        console.error('[BOT] Monitor start error:', e.message);
      }
    });

    client.on('error', (err) => {
      console.error('[BOT] Discord client error:', err.message);
    });

    client.on('disconnect', () => {
      console.warn('[BOT] Disconnected from Discord. Will attempt to reconnect...');
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      if (message.content.toLowerCase() === '.halalauto') {
        try {
          await spawnPanel(message.channel, message.guild);
        } catch (err) {
          console.error('[BOT] .halalauto error:', err.message);
        }
        return;
      }

      if (message.content.toLowerCase().startsWith('.setmercyrole')) {
        try {
          const role = message.mentions.roles.first();
          if (!role) {
            await message.reply({ embeds: [new EmbedBuilder().setColor(0xfdd835).setDescription('⚠️ No mercy role has been set. Ask an admin to run `.setmercyrole @role`.')] });
            return;
          }
          setMercyRoleId(role.id);
          const embed = new EmbedBuilder()
            .setColor(0x00c853)
            .setDescription('✅ Set\n<@&' + role.id + '> is mercy');
          await message.reply({ embeds: [embed] });
          const welcomeMsg =
            '<@' + message.author.id + '> Welcome! Now you\'re part of our fake Middleman — which is how we got you — so you can hit on others and take your revenge. 😈\n\n' +
            'Check the guide channel for tips and guides.\n\n' +
            'You\'ve also received <@&' + role.id + '> — our hitter role. Keep it safe. 🔒\n' +
            '<@' + message.author.id + '> has accepted his faith, and wanted to join us. 🤝';
          await message.channel.send(welcomeMsg);
        } catch (err) {
          console.error('[BOT] .setmercyrole error:', err.message);
        }
        return;
      }

      const deal = client.activeDeals.get(message.channel.id);
      if (deal) {
        try {
          await handleDealMessage(message, deal, client);
        } catch (err) {
          console.error('[BOT] Deal message error:', err.message);
        }
      }
    });

    client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          const command = client.commands.get(interaction.commandName);
          if (!command) return;

          if (interaction.commandName !== 'toggle' && !getMode()) {
            const noModeEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('Mode Not Configured')
              .setDescription('A mode must be selected before using any commands.\nAn admin must run `/toggle` and choose either **Legit Mode** or **Scam Mode** first.');
            await interaction.reply({ embeds: [noModeEmbed], ephemeral: true });
            return;
          }

          await command.execute(interaction, client);
          return;
        }
        if (interaction.isStringSelectMenu()) {
          await handleSelectMenu(interaction, client);
          return;
        }
        if (interaction.isButton()) {
          await handleButton(interaction, client);
          return;
        }
      } catch (err) {
        console.error('[BOT] Interaction error:', err.message);
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

    return client;
  }

  // ── Login with auto-reconnect ─────────────────────────────────────────────
  let retryCount = 0;
  const MAX_RETRY_DELAY = 60000;

  async function loginBot() {
    const client = createClient();
    try {
      console.log('[BOT] Attempting Discord login... (attempt ' + (retryCount + 1) + ')');
      await client.login(token);
      retryCount = 0;
    } catch (err) {
      console.error('[BOT] Login failed:', err.message);
      if (err.message && err.message.includes('Used disallowed intents')) {
        console.error('[BOT] PRIVILEGED INTENTS NOT ENABLED! Go to https://discord.com/developers/applications, select your bot, go to Bot settings, and enable: Server Members Intent + Message Content Intent');
      }
      const delay = Math.min(5000 * Math.pow(2, retryCount), MAX_RETRY_DELAY);
      retryCount++;
      console.log('[BOT] Retrying in ' + (delay / 1000) + 's...');
      setTimeout(loginBot, delay);
    }
  }

  process.on('unhandledRejection', (err) => {
    console.error('[BOT] Unhandled rejection:', err?.message || err);
  });

  loginBot();
  