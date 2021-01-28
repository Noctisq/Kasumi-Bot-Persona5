const ytdl = require("ytdl-core");
const ytsr = require("ytsr");
const Discord = require("discord.js");
const fs = require("fs");
var ytpl = require("ytpl");

var guildBoard;

module.exports = {
  songs: (songs = []),
  name: "play",
  cooldown: 3,
  description: "Play a song",
  async execute(message, args) {
    const bot = require("../index");
    let choice;
    let boardSongs = [];
    let show = "";
    let cont = 1;
    console.log("este es el id del guild: ", message.channel.guild.id)
    fs.readFile("guilds.json", "utf8", (err, data) => {
      if (err) {
        console.log(err);
      } else {
        guilds = JSON.parse(data); //now it an object
        guildBoard = guilds.find(
          (guild) => guild.idGuild == message.channel.guild.id
        );
        console.log("guild encontrado", guildBoard);
      }
    });

    if (!message.member.voice.channel)
      return message.channel.send("No estás en ningún chat de voz, senpai :c");
    if (args.length == 0)
      return message.channel.send(
        "¿Qué canción reproduzco?, no seas baboso senpai."
      );

    if (
      message.channel.messages.cache.some((elem) =>
        elem.content.startsWith("Senpai,")
      )
    ) {
      return message.reply(
        `Primero elige una canción de la anterior búsqueda, senpai:black_heart:`
      );
    }
    // for (msg of message.channel.messages.cache) {
    //   console.log(msg.content)
    //   if (msg.content.startsWith("Senpai,")) {
    //     isSearching = true;
    //   } else {
    //     isSearching = false;
    //   }
    // }

    if (!args[0].includes("https://")) {
      let search = args.toString().replace(/,/g, " ");
      ytsr
        .getFilters(search)
        .then(async (filters1) => {
          const filter1 = await filters1
            .get("Type")
            .find((o) => o.name === "Video");
          const filters2 = await ytsr.getFilters(filter1.ref);
          const filter2 = filters2
            .get("Duration")
            .find((o) => o.name.startsWith("Short"));

          const options = {
            limit: 5,
            nextpageRef: filter2.ref,
          };

          const searchResults = await ytsr(filter2.query, options);
          searchResults.items.forEach((item) => {
            boardSongs.push({
              id: cont,
              title: item.title,
              url: item.link,
              img: item.thumbnail,
            });
            cont++;
          });
          boardSongs.forEach((song) => {
            show = show + `\n${song.id}.-${song.title}`;
          });
          message.channel.send(
            `Senpai, esto es lo que encontré: ${show} \nElije una de las cinco opciones, senpai :heart:`
          );

          bot.on("messageReactionAdd", async (reaction, user) => {
            if (user.username != "Kasumi") {
              if (reaction.emoji.name === "1️⃣") {
                if (boardSongs.length != 0) {
                  message.channel.send(
                    `Será la opción 1️⃣ entonces, senpai! :black_heart:`
                  );
                  choice = boardSongs[0];
                  boardSongs = [];
                  reaction.message.delete();

                  prePlay(choice, message);
                }
              } else if (reaction.emoji.name === "2️⃣") {
                if (boardSongs.length != 0) {
                  message.channel.send(
                    "Será la opción 2️⃣ entonces, senpai! :black_heart:"
                  );
                  choice = boardSongs[1];
                  boardSongs = [];
                  reaction.message.delete();
                  prePlay(choice, message);
                }
              } else if (reaction.emoji.name === "3️⃣") {
                if (boardSongs.length != 0) {
                  message.channel.send(
                    "Será la opción 3️⃣ entonces, senpai! :black_heart:"
                  );
                  choice = boardSongs[2];
                  boardSongs = [];
                  reaction.message.delete();
                  prePlay(choice, message);
                }
              } else if (reaction.emoji.name === "4️⃣") {
                if (boardSongs.length != 0) {
                  message.channel.send(
                    "Será la opción 4️⃣ entonces, senpai! :black_heart:"
                  );
                  choice = boardSongs[3];
                  boardSongs = [];
                  reaction.message.delete();
                  prePlay(choice, message);
                }
              } else if (reaction.emoji.name === "5️⃣") {
                if (boardSongs.length != 0) {
                  message.channel.send(
                    "Será la opción 5️⃣ entonces, senpai! :black_heart:"
                  );

                  choice = boardSongs[4];
                  boardSongs = [];
                  reaction.message.delete();
                  prePlay(choice, message);
                }
              } else {
                if (boardSongs.length != 0) {
                  boardSongs = [];
                  message.reply("Ya no te equivoques, senpai:black_heart:");
                  reaction.message.delete();
                }
              }
            }
          });
        })
        .catch((err) => console.log(err));
    } else {
      if (args[0].includes("list=")) {
        console.log(args[0]);
        ytpl(args[0]).then(async (playlist) => {
          console.log(playlist);
          playlist.items.forEach(async (song) => {
            const song1 = {
              title: song.title,
              url: song.url_simple,
            };

            guildBoard.Songs.push(song1);
            const newGuilds = guilds.map((guild) => {
              if (guild.idGuild == message.channel.guild.id) {
                return (guild.Songs = guildBoard.Songs);
              } else {
                return guild;
              }
            });
            fs.writeFile(
              "guilds.json",
              JSON.stringify(newGuilds),
              "utf8",
              () => {
                console.log("created");
              }
            );
          });
          const connection = await message.member.voice.channel.join();
          const isPlaying = connection.dispatcher;

          if (isPlaying) {
            message.channel.send(
              `¡La playlist se ha añadido a la cola, senpai! :peach:`
            );
          } else {
            message.channel.send(
              `¡La playlist se ha añadido a la cola, senpai! y empezó a sonar! :peach:`
            );

            play(connection, songs, message);
          }
        });
      } else {
        const songInfo = await ytdl.getInfo(args[0]);
       
        const song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          img: songInfo.videoDetails.thumbnail.thumbnails[4]
            ? songInfo.videoDetails.thumbnail.thumbnails[4].url
            : songInfo.videoDetails.thumbnail.thumbnails[3].url,
          duration: songInfo.videoDetails.lengthSeconds,
        };
        prePlay(song, message);
      }
    }
  },
};

const play = async (connection, songs, message) => {
  const dispatcher = connection
    .play(ytdl(songs.Songs[0].url, { filter: "audioonly", volume: 20 / 100 }))
    .on("finish", async () => {
      console.log("Terminó, la que sigue!");
      // Deletes the finished song from the queue
      fs.readFile("guilds.json", "utf8", (err, data) => {
        if (err) {
          console.log(err);
        } else {
          guilds = JSON.parse(data); //now it an object
          guildBoard = guilds.find(
            (guild) => guild.idGuild == message.channel.guild.id
          );
          console.log("guild encontrado", guildBoard);
        }
      });
      guildBoard.Songs.shift();
      const newGuilds = guilds.map((guild) => {
        if (guild.idGuild == message.channel.guild.id) {
          return guildBoard;
        } else {
          return guild;
        }
      });
      fs.writeFile("guilds.json", JSON.stringify(newGuilds), "utf8", () => {
        console.log("Canción se fué a la chuchaaaaa");
      });
      if (guildBoard.Songs.length == 0)
        return message.channel.send(
          "¡Ya no hay canciones, senpai! :pleading_face:"
        );
      const songInfo = await ytdl.getInfo(guildBoard.Songs[0].url);

      const msg = await createMessage(
        `${guildBoard.Songs[0].title}`,
        songInfo.videoDetails.thumbnail.thumbnails[4]
          ? songInfo.videoDetails.thumbnail.thumbnails[4].url
          : songInfo.videoDetails.thumbnail.thumbnails[3].url,

        message.author.displayAvatarURL({
          format: "png",
          dynamic: true,
          size: 256,
        }),
        guildBoard.Songs.length > 1
          ? guildBoard.Songs[1].title
          : "No hay más canciones en la cola, senpai :(",
        songInfo.videoDetails.author.name,
        guildBoard.Songs[0].url
      );

      message.channel.send(msg);

      play(connection, guildBoard, message);
    })
    .on("error", (error) => {
      message.channel.send(
        `¡Parece que hubo un error senpai :(. Inténtalo de nuevo.! :smile:`
      );
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(20 / 100);
};

const prePlay = async (choice, message) => {
  const connection = await message.member.voice.channel.join();
  const isPlaying = connection.dispatcher;

  console.log("este es el guild board", guildBoard);
  guildBoard.Songs.push(choice);
  console.log("este es el guild board después del push", guildBoard);
  //necesito leer primero el guildboard
  const newGuilds = guilds.map((guild) => {
    if (guild.idGuild == message.channel.guild.id) {
      
      return guildBoard;
    } else {
      return guild;
    }
  });
  fs.writeFile("guilds.json", JSON.stringify(newGuilds), "utf8", () => {
    console.log("created");
  });
  console.log("Esto es la cola: ", guildBoard.Songs);
  if (isPlaying) {
    message.channel.send(
      `¡La canción ${choice.title} se ha añadido a la cola, senpai! :peach:`
    );
  } else {
    const songInfo = await ytdl.getInfo(guildBoard.Songs[0].url);

    const msg = await createMessage(
      `${choice.title}`,
      songInfo.videoDetails.thumbnail.thumbnails[4]
        ? songInfo.videoDetails.thumbnail.thumbnails[4].url
        : songInfo.videoDetails.thumbnail.thumbnails[3].url,
      message.author.displayAvatarURL({
        format: "png",
        dynamic: true,
        size: 256,
      }),
      guildBoard.Songs.length > 1
        ? guildBoard.Songs[1].title
        : "No hay más canciones en la cola, senpai :(",
      songInfo.videoDetails.author.name,
      guildBoard.Songs[0].url
    );
    message.channel.send(msg);

    play(connection, guildBoard, message);
  }
};

const createMessage = async (
  desc,
  img,
  urlAvatar,
  nextSong,
  authorSong,
  urlSong
) => {
  const messageem1 = new Discord.MessageEmbed()
    .setAuthor(authorSong)
    .setColor("#ff0000")
    .setThumbnail(urlAvatar)
    .setTitle(`${desc}:smile: :black_heart:`)
    .setURL(urlSong)
    .setImage(img)
    .addField(`Siguiente canción :black_heart:`, `> ***${nextSong}***`)
    .setTimestamp();

  return messageem1;
}; //Aqui puedo poner el tumbnail del video de yotuube
