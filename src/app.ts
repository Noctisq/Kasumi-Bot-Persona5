import { Bot } from './Classes/Bot'
import * as fs from 'fs';
import { Command } from './interface/Command.interface';
import 'dotenv/config'
const commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.ts'));
const botInstance = Bot.getInstance();

for (const file of commandFiles) {
    const command: Command = require(`./commands/${file.replace(/\.ts$/, '')}`);
    botInstance.createCommandsCollection();
    const commandInstance = Object.values(command)[0]
    botInstance.setCommandsCollection(new commandInstance(botInstance.getClient()));
}

botInstance.getClient().once("ready", () => {
    console.info(`Iniciando a ${botInstance.getClient().user.tag}!`);
});

botInstance.getClient().on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = botInstance.getCommandFromCollection(interaction.commandName);
    console.log(command);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});


botInstance.loginBot(process.env.TOKEN)