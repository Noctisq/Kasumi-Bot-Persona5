const ytdl = require("ytdl-core");
const ytsr = require("ytsr");
var ytpl = require("ytpl");
var songs = [];
let choice;
let filter;
module.exports = {
  name: "play",
  description: "Play a song",
  async execute(message, args) {
    const bot = require("../index");

    if (!message.member.voice.channel)
      return message.channel.send("No estás en ningún chat de voz, senpai :c");
    if (args.length == 0)
      return message.channel.send(
        "¿Qué canción reproduzco?, no seas baboso senpai."
      );

    if (!args[0].includes("https://")) {
      ytsr.getFilters(args[0].replace(/ /g, ""), function (err, filters) {
        if (err) throw err;
        filter = filters.get("Type").find((o) => o.name === "Video");
        ytsr.getFilters(filter.ref, function (err, filters) {
          if (err) throw err;
          filter = filters
            .get("Duration")
            .find((o) => o.name.startsWith("Short"));
          var options = {
            limit: 5,
            nextpageRef: filter.ref,
          };
          ytsr(null, options, async function (err, searchResults) {
            if (err) throw err;
            let boardSongs = [];
            let show = "";
            let cont = 1;

            searchResults.items.forEach((item) => {
              boardSongs.push({
                id: cont,
                title: item.title,
                url: item.link,
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
              if (reaction.partial) {
                try {
                  await reaction.fetch();
                } catch (error) {
                  console.log(
                    "Something went wrong when fetching the message: ",
                    error
                  );

                  return;
                }
              }

              if (user.username != "Kasumi") {
                if (reaction.emoji.name === "1️⃣") {
                  console.log("ya déjame dormir hijo de perra: ", boardSongs);
                  if (boardSongs.length != 0) {
                    message.channel.send(
                      "Será la opción 1 entonces, senpai! :black_heart:"
                    );
                    choice = boardSongs[0].url;
                    boardSongs = [];
                    reaction.message.delete();
                    prePlay(choice, message);
                  }
                } else if (reaction.emoji.name === "2️⃣") {
                  if (boardSongs.length != 0) {
                    message.channel.send(
                      "Será la opción 2 entonces, senpai! :black_heart:"
                    );
                    choice = boardSongs[1].url;
                    boardSongs = [];
                    reaction.message.delete();
                    prePlay(choice, message);
                  }
                } else if (reaction.emoji.name === "3️⃣") {
                  if (boardSongs.length != 0) {
                    message.channel.send(
                      "Será la opción 3 entonces, senpai! :black_heart:"
                    );
                    choice = boardSongs[2].url;
                    boardSongs = [];
                    prePlay(choice, message);
                  }
                } else if (reaction.emoji.name === "4️⃣") {
                  if (boardSongs.length != 0) {
                    message.channel.send(
                      "Será la opción 4 entonces, senpai! :black_heart:"
                    );
                    choice = boardSongs[3].url;
                    boardSongs = [];
                    prePlay(choice, message);
                  }
                } else {
                  if (boardSongs.length != 0) {
                    message.channel.send(
                      "Será la opción 5 entonces, senpai! :black_heart:"
                    );

                    choice = boardSongs[4].url;
                    boardSongs = [];
                    prePlay(choice, message);
                  }
                }
              }
            });
          });
        });
      });
    } else {
      if (args[0].includes("list=")) {
        ytpl(args[0], function (err, playlist) {
          if (err) throw err;
          playlist.items.forEach(async (song) => {
            const songInfo = await ytdl.getInfo(song.author.ref);
            const song1 = {
              title: songInfo.videoDetails.title,
              url: songInfo.videoDetails.video_url,
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
        };
        songs.push(song);
        const connection = await message.member.voice.channel.join();
        const isPlaying = connection.dispatcher;

        if (isPlaying) {
          message.channel.send(
            `¡La canción ${song.title} se ha añadido a la cola, senpai! :peach:`
          );
        } else {
          message.channel.send(
            `¡La canción ${song.title} se ha añadido a la cola, senpai y empezó a sonar! :peach:`
          );

          play(connection, songs, message);
        }
      }
    }
  },
};

const play = async (connection, songs, message) => {
  console.log(songs[0].title);
  const dispatcher = connection
    .play(ytdl(songs[0].url, { filter: "audioonly", volume: 10 / 100 }))
    .on("finish", () => {
      console.log("Terminó, la que sigue!");
      // Deletes the finished song from the queue
      songs.shift();
      if (songs.length == 0)
        return message.channel.send(
          "¡Ya no hay canciones, senpai! :pleading_face:"
        );
      message.channel.send(
        `¡Estás escuchando ${songs[0].title}, senpai! :smile:`
      );
      play(connection, songs, message);
    })
    .on("error", (error) => {
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(10 / 100);
};

const prePlay = async (choice, message) => {
  const songInfo = await ytdl.getInfo(choice);
  const song = {
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
  };
  songs.push(song);
  const connection = await message.member.voice.channel.join();
  const isPlaying = connection.dispatcher;

  if (isPlaying) {
    message.channel.send(
      `¡La canción ${song.title} se ha añadido a la cola, senpai! :peach:`
    );
  } else {
    message.channel.send(
      `¡La canción ${song.title} se ha añadido a la cola, senpai y empezó a sonar! :peach:`
    );

    play(connection, songs, message);
  }
};
