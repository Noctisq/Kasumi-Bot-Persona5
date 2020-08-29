const ytdl = require("ytdl-core");
const ytsr = require("ytsr");
const Discord = require("discord.js");
var ytpl = require("ytpl");

var songs = [];
let choice;
let filter;

module.exports = {
  songs: (songs = []),
  name: "play",
  cooldown: 3,
  description: "Play a song",
  async execute(message, args) {
    const bot = require("../index");
   
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
      ytsr.getFilters(search, function (err, filters) {
        if (err)
          return message.channel.send(
            `Parece que hubo un error, ¿puedes buscar de nuevo, senpai?`
          );
        filter = filters.get("Type").find((o) => o.name === "Video");
        ytsr.getFilters(filter.ref, function (err, filters) {
          if (err)
            if (err)
              return message.channel.send(
                `Parece que hubo un error, ¿puedes buscar de nuevo, senpai?`
              );
          var options = {
            limit: 5,
            nextpageRef: filter.ref,
          };
          ytsr(search, options, async function (err, searchResults) {
            if (err)
              return message.channel.send(
                `Parece que hubo un error, ¿puedes buscar de nuevo, senpai?`
              );
            let boardSongs = [];
            let show = "";
            let cont = 1;

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
          });
        });
      });
    } else {
      if (args[0].includes("list=")) {
        ytpl(args[0], async function (err, playlist) {
          if (err) throw err;
          playlist.items.forEach(async (song) => {
            const song1 = {
              title: song.title,
              url: song.url_simple,
            };

            songs.push(song1);
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
          img:
            (songInfo.videoDetails.thumbnail.thumbnails[4])
              ? songInfo.videoDetails.thumbnail.thumbnails[4].url
              : songInfo.videoDetails.thumbnail.thumbnails[3].url,
        };
        prePlay(song, message);
      }
    }
  },
};

const play = async (connection, songs, message) => {
  const dispatcher = connection
    .play(ytdl(songs[0].url, { filter: "audioonly", volume: 20 / 100 }))
    .on("finish", async () => {
      console.log("Terminó, la que sigue!");
      // Deletes the finished song from the queue
      songs.shift();
      if (songs.length == 0)
        return message.channel.send(
          "¡Ya no hay canciones, senpai! :pleading_face:"
        );
      const songInfo = await ytdl.getInfo(songs[0].url);

      const msg = await createMessage(
        `${songs[0].title}`,
        (songInfo.videoDetails.thumbnail.thumbnails[4])
        ? songInfo.videoDetails.thumbnail.thumbnails[4].url
        : songInfo.videoDetails.thumbnail.thumbnails[3].url,
          
        message.author.displayAvatarURL({
          format: "png",
          dynamic: true,
          size: 256,
        }),
        songs.length > 1
          ? songs[1].title
          : "No hay más canciones en la cola, senpai :(",
        songInfo.videoDetails.author.name,
        songs[0].url
      );

      message.channel.send(msg);

      play(connection, songs, message);
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
  songs.push(choice);
  console.log("Esto es la cola: ", songs);
  if (isPlaying) {
    message.channel.send(
      `¡La canción ${choice.title} se ha añadido a la cola, senpai! :peach:`
    );
  } else {
    const songInfo = await ytdl.getInfo(songs[0].url);
    
    const msg = await createMessage(
      `${choice.title}`,
      (songInfo.videoDetails.thumbnail.thumbnails[4])
      ? songInfo.videoDetails.thumbnail.thumbnails[4].url
      : songInfo.videoDetails.thumbnail.thumbnails[3].url,
      message.author.displayAvatarURL({
        format: "png",
        dynamic: true,
        size: 256,
      }),
      songs.length > 1
        ? songs[1].title
        : "No hay más canciones en la cola, senpai :(",
      songInfo.videoDetails.author.name,
      songs[0].url
    );
    message.channel.send(msg);

    play(connection, songs, message);
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
