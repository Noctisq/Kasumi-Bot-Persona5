require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const bot = new Discord.Client();

let prefix = process.env.PREFIX
let token = process.env.TOKEN 
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
  module.exports = bot;

});

bot.on("message", (message) => {
  console.log("que es estoooo : ", message.author.bot);

  if (message.author.bot) {
    if (message.content.startsWith("Senpai,")) {
      message
        .react("1️⃣")
        .then(() => message.react("2️⃣"))
        .then(() => message.react("3️⃣"))
        .then(() => message.react("4️⃣"))
        .then(() => message.react("5️⃣"))
        .catch(() => console.error("One of the emojis failed to react."));
    }
  }
  if (!message.content.startsWith(prefix)) return;
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

