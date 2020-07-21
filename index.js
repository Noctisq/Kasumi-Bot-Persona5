require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const bot = new Discord.Client();
const { prefix, token } = require("./config.json");

bot.commands = new Discord.Collection();

const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  bot.commands.set(command.name, command);
}
//Ver nombre del bot
bot.on("ready", () => {
  console.info(`Iniciando a ${bot.user.tag}!`);
});

bot.on("message", (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (!bot.commands.has(commandName)) {
    return message.reply("Parece que no existe este comando, senpai :c");
  }
  const command = bot.commands.get(commandName);
  try {
    command.execute(message, args);
   
  } catch (err) {
    console.log(err);
    message.reply("Algo salió mal, perdóname senpai :(!");
  }

  //   if (message.content === `${prefix}server`) {
  //     message.channel.send(
  //       `Bienvenidos a: ${message.guild.name}\nTotal de miembros: ${message.guild.memberCount}`
  //     );
  //   } else if (command === "args-info") {
  //     if (!args.length) {
  //       return message.channel.send(
  //         `No me diste algo que buscar :(, ${message.author}!`
  //       );
  //     }
  //     message.channel.send(`Nombre del comando: ${command}\nArgumentos: ${args}`);
  //   }
});



bot.login(token);
