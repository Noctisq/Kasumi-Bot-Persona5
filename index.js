const fs = require("fs");
const Discord = require("discord.js");
const bot = new Discord.Client();
const express = require("express");
const DBL = require("dblapi.js");

const ytsr = require("ytsr");
require('dotenv').config()
const dbl = new DBL(
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjczNDg3NDg4MzE4NzUzOTk3OCIsImJvdCI6dHJ1ZSwiaWF0IjoxNjAyMjA2MDY3fQ.Z0OWhJYyylH_RtOhLqiJMCuk-DbrSVGGVULT6Vi8-jg",
  bot
);
const { songs } = require("./commands/playSong");
const app = express();
const cors = require("cors");

app.use(cors());
app.use(express.json());

let prefix = "k";
let token = process.env.TOKEN;

app.set("view engine", "ejs");
bot.commands = new Discord.Collection();

process.on("unhandledRejection", (error) => {
  console.log("este es el error: ", error);
});

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

  setInterval(() => {
    dbl.postStats(bot.guilds.size);
  }, 180000);
  module.exports = bot;
});

bot.on("message", (message) => {

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
  } else {

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
          )} segundos más antes de utilizar el comando \`${command.name
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
  }

});

bot.login(token);
//Mobile

const router = express.Router();
app.use("/kasumi", router);

app.listen(process.env.PORT || 4000, function () {
  console.log("Escuchando peticiones en el puerto:", process.env.PORT || 4000);
});

//Rutas para la navegación

router.get("/skip", async function (req, res) {
  const voiceChannel = await bot.voice.connections.first(1);

  const dispatcher = voiceChannel[0].dispatcher;

  dispatcher.emit("finish");
  res.sendStatus(200);
});

router.get("/pause", async function (req, res) {
  const voiceChannel = await bot.voice.connections.first(1);

  const dispatcher = voiceChannel[0].dispatcher;
  dispatcher.pause();
  res.sendStatus(200);
});

router.get("/resume", async function (req, res) {
  const voiceChannel = await bot.voice.connections.first(1);

  const dispatcher = voiceChannel[0].dispatcher;
  dispatcher.resume();
  res.sendStatus(200);
});

router.get("/getQueue", async function (req, res) {
  res.send(songs);
});
router.post("/addSong", async function (req, res) {
  console.log("olv si llegue", req.body.song);
  songs.push(req.body.song.item);

  res.sendStatus(200);
});

router.post("/searchMusic", async function (req, res) {
  console.log(req.body);
  
  let search = req.body.search.toString().replace(/,/g, " ");
  const filters1 = await ytsr.getFilters(search);
  const filter1 = filters1.get('Type').get('Video');
  const options = {
    limit: 5,
  }
  const searchResults = await ytsr(filter1.url, options);
  console.log(searchResults.items);
  let boardSongs = [];

  let cont = 1;
  searchResults.items.forEach((item) => {
    boardSongs.push({
      id: cont,
      title: item.title,
      url: item.url,
      img: item.bestThumbnail.url,
      author: item.author.name
    });
    cont++;
  });

  res.send(boardSongs);

});
