import { Client, GatewayIntentBits } from 'discord.js';
import { CommandRegistry } from './Classes/CommandRegistry';
import { DiscordPlayerMusicService } from './services/DiscordPlayerMusicService';
import { ActivityGateway } from './services/ActivityGateway';
import { PlayCommand } from './commands/play';
import { LoveCommand } from './commands/love';
import { SetCookieCommand } from './commands/set-cookie';
import 'dotenv/config';

async function bootstrap() {
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
    const musicPlayer = await DiscordPlayerMusicService.create(client);

    const activityGateway = new ActivityGateway(musicPlayer, Number(process.env.ACTIVITY_PORT) || 3001);
    activityGateway.start();

    const commands = new CommandRegistry();
    commands.register(new PlayCommand(musicPlayer));
    commands.register(new LoveCommand());
    commands.register(new SetCookieCommand(musicPlayer));

    client.once('ready', () => console.info(`Iniciando a ${client.user.tag}!`));
    client.on('interactionCreate', async interaction => {
        if (!interaction.isChatInputCommand()) return;
        const command = commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    });

    await client.login(process.env.TOKEN);
}

bootstrap().catch(console.error);
