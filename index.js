const fs = require("fs");
const { Client, Intents, Collection } = require('discord.js');
const { token } = require('./config.json');
const ytsr = require("ytsr");
require('dotenv').config()
//const { songs } = require("./commands/playSong");
let prefix = "k";

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
// for (const file of commandFiles) {
//   const command = require(`./commands/${file}`);
//   client.commands.set(command.name, command);
// }
//Ver nombre del bot
// const cooldowns = new Discord.Collection();

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
// bot.on('guildMemberSpeaking',(member, speaking)=>{
//   if(speaking.bitfield === 1){
//     const command = bot.commands.get('voice');
//     command.execute(member);
//   }
// });
// bot.on("message", (message) => {

//   if (message.author.bot) {

//     if (message.content.startsWith("Senpai,")) {
//       message
//         .react("1️⃣")
//         .then(() => message.react("2️⃣"))
//         .then(() => message.react("3️⃣"))
//         .then(() => message.react("4️⃣"))
//         .then(() => message.react("5️⃣"))
//         .then(() => message.react("❌"))
//         .catch(() => console.error("One of the emojis failed to react."));
//     }
//   } else {

//     if (!message.content.startsWith(prefix)) return;
//     const args = message.content.slice(prefix.length).trim().split(/ +/);
//     console.log(args);
//     const commandName = args.shift().toLowerCase();

//     if (!bot.commands.has(commandName)) {
//       return message.reply("Parece que no existe este comando, senpai :c");
//     }
//     const command = bot.commands.get(commandName);
//     if (!cooldowns.has(command.name)) {
//       cooldowns.set(command.name, new Discord.Collection());
//     }

//     const now = Date.now();
//     const timestamps = cooldowns.get(command.name);
//     const cooldownAmount = (command.cooldown || 3) * 1000;

//     if (timestamps.has(message.author.id)) {
//       const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

//       if (now < expirationTime) {
//         const timeLeft = (expirationTime - now) / 1000;
//         return message.reply(
//           `Espera ${timeLeft.toFixed(
//             1
//           )} segundos más antes de utilizar el comando \`${command.name
//           }\`, senpai :heart: .`
//         );
//       }
//     }
//     timestamps.set(message.author.id, now);
//     setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
//     try {
//       command.execute(message, args);
//     } catch (err) {
//       console.log(err);
//       message.reply("Algo salió mal, perdóname senpai :(!");
//     }
//   }

// });


//Mobile

// const router = express.Router();
// app.use("/kasumi", router);

// app.listen(process.env.PORT || 4000, function () {
//   console.log("Escuchando peticiones en el puerto:", process.env.PORT || 4000);
// });

// //Rutas para la navegación

// router.get("/skip", async function (req, res) {
//   const voiceChannel = await bot.voice.connections.first(1);

//   const dispatcher = voiceChannel[0].dispatcher;

//   dispatcher.emit("finish");
//   res.sendStatus(200);
// });

// router.get("/pause", async function (req, res) {
//   const voiceChannel = await bot.voice.connections.first(1);

//   const dispatcher = voiceChannel[0].dispatcher;
//   dispatcher.pause();
//   res.sendStatus(200);
// });

// router.get("/resume", async function (req, res) {
//   const voiceChannel = await bot.voice.connections.first(1);

//   const dispatcher = voiceChannel[0].dispatcher;
//   dispatcher.resume();
//   res.sendStatus(200);
// });

// router.get("/getQueue", async function (req, res) {
//   res.send(songs);
// });
// router.post("/addSong", async function (req, res) {
//   console.log("olv si llegue", req.body.song);
//   songs.push(req.body.song.item);

//   res.sendStatus(200);
// });

// router.post("/searchMusic", async function (req, res) {
//   console.log(req.body);
  
//   let search = req.body.search.toString().replace(/,/g, " ");
//   const filters1 = await ytsr.getFilters(search);
//   const filter1 = filters1.get('Type').get('Video');
//   const options = {
//     limit: 5,
//   }
//   const searchResults = await ytsr(filter1.url, options);
//   console.log(searchResults.items);
//   let boardSongs = [];

//   let cont = 1;
//   searchResults.items.forEach((item) => {
//     boardSongs.push({
//       id: cont,
//       title: item.title,
//       url: item.url,
//       img: item.bestThumbnail.url,
//       author: item.author.name
//     });
//     cont++;
//   });

//   res.send(boardSongs);

// });
        