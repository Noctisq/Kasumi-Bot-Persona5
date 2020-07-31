require("dotenv").config();
const fs = require("fs");
const Discord = require("discord.js");
const bot = new Discord.Client();
const mongoose = require("mongoose");
let prefix = process.env.prefix;
let token = process.env.TOKEN;
bot.commands = new Discord.Collection();

mongoose.connect(
  `mongodb+srv://Noctis:${process.env.DBPASSWORD}@steamdb.gs3i1.mongodb.net/${process.env.DBNAME}?retryWrites=true&w=majority`,
  (err) => {
    if (err) {
      return console.log("error", err);
    }

    console.log("Conectado a la base de datos");
  }
);

process.on("unhandledRejection", (error) =>
  console.error("Uncaught Promise Rejection", error)
);
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  bot.commands.set(command.name, command);
}
//Ver nombre del bot
const cooldowns = new Discord.Collection();

bot.on("ready", () => {
  console.info(`Iniciando a ${bot.user.tag}!`);
  module.exports = bot;
});

bot.on("message", (message) => {
  console.log("Es mensaje del bot? ", message.author.bot);

  if (message.author.bot) {
    if (message.content.startsWith("Senpai,")) {
      message
        .react("1️⃣")
        .then(() => message.react("2️⃣"))
        .then(() => message.react("3️⃣"))
        .then(() => message.react("4️⃣"))
        .then(() => message.react("5️⃣"))
        .then(() => message.react("❌"))
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
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 3) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `Espera ${timeLeft.toFixed(
          1
        )} segundos más antes de utilizar el comando \`${
          command.name
        }\`, senpai :heart: .`
      );
    }
  }
  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
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
