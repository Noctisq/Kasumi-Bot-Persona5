const fs = require("fs");
const { Client, Intents, Collection, Application } = require('discord.js');
const { token } = require('./config.json');
const myIntents = new Intents();

myIntents.add(Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_PRESENCES,
  Intents.FLAGS.GUILD_VOICE_STATES,);


const client = new Client({ intents: myIntents });
client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
process.on("unhandledRejection", (error) => {
  console.log("este es el error: ", error);
});

for (const file of commandFiles) {
  console.log(file);
	const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once("ready", () => {
  console.info(`Iniciando a ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});


client.login(token);

process.on('unhandledError', error => {
    console.log('Test error:', error);
});


// http server and routes

