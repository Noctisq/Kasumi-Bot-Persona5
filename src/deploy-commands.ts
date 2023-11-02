const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
import 'dotenv/config'
const fs = require('fs');
import { Command } from './interface/Command.interface';
const commands = [];
const commandFiles = fs.readdirSync('src/commands').filter(file => file.endsWith('.ts'));
const clientId = '734874883187539978';
const guildId = '731727908619681842';
for (const file of commandFiles) {
	const command: Command = require(`./commands/${file.replace(/\.ts$/, '')}`);
	const commandInstance = Object.values(command)[0]
	commands.push(new commandInstance());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();