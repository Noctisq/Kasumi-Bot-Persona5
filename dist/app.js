"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const CommandRegistry_1 = require("./Classes/CommandRegistry");
const DiscordPlayerMusicService_1 = require("./services/DiscordPlayerMusicService");
const play_1 = require("./commands/play");
const love_1 = require("./commands/love");
require("dotenv/config");
async function bootstrap() {
    const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildVoiceStates] });
    const musicPlayer = await DiscordPlayerMusicService_1.DiscordPlayerMusicService.create(client);
    const commands = new CommandRegistry_1.CommandRegistry();
    commands.register(new play_1.PlayCommand(musicPlayer));
    commands.register(new love_1.LoveCommand());
    client.once('ready', () => console.info(`Iniciando a ${client.user.tag}!`));
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand())
            return;
        const command = commands.get(interaction.commandName);
        if (!command)
            return;
        try {
            await command.execute(interaction);
        }
        catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    });
    await client.login(process.env.TOKEN);
}
bootstrap().catch(console.error);
//# sourceMappingURL=app.js.map