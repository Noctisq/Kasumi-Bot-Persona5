const ytdl = require("ytdl-core");
const ytsr = require("ytsr");
const Discord = require("discord.js");
var ytpl = require("ytpl");
const fs = require("fs");

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
      return message.channel.send("You're not in a channel, senpai :c");
    if (args.length == 0)
      return message.channel.send(
        "Which song should i play?, don't be silly senpai."
      );

    if (
      message.channel.messages.cache.some((elem) =>
        elem.content.startsWith("Senpai,")
      )
    ) {
      return message.reply(
        `Pick a song from the options i send earlier, senpai :black_heart:`
      );
    }

    if (!args[0].includes("https://")) {

      try {
        let search = args.toString().replace(/,/g, " ");
        const filters1 = await ytsr.getFilters(search);
        const filter1 = filters1.get('Type').get('Video');
        const options = {
          limit: 5,
        }
        const searchResults = await ytsr(filter1.url, options);
        let boardSongs = [];
        let show = "";
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

        boardSongs.forEach((song) => {
          show = show + `\n${song.id}.-${song.title}`;
        });

        message.channel.send(
          `Senpai, this is what i found: ${show} \nchoose one, senpai :heart:`
        );

        bot.on("messageReactionAdd", async (reaction, user) => {
          if (user.username != "Kasumi" && boardSongs.length != 0) {
            switch (
            reaction.emoji.name
            ) {
              case "1️⃣":
                sendSongData(reaction.emoji.name, boardSongs[0], message);
                break;
              case "2️⃣":
                sendSongData(reaction.emoji.name, boardSongs[1], message);
                break;
              case "3️⃣":
                sendSongData(reaction.emoji.name, boardSongs[2], message);
                break;
              case "4️⃣":
                sendSongData(reaction.emoji.name, boardSongs[3], message);
                break;
              case "5️⃣":
                sendSongData(reaction.emoji.name, boardSongs[4], message);
                break;
              case "❌":
                message.reply("Think before you search, senpai! :black_heart:");
                break;
            }
            boardSongs = [];
            reaction.message.delete();
          }
        });

      } catch (error) {
        console.log(error);
      }
    } else {
      if (args[0].includes("list=")) {
        const playlist = await ytpl(args[0]);

        playlist.items.forEach(async (song) => {
          const songP = {

            title: song.title,
            url: song.url,
            img: song.bestThumbnail.url,
            author: song.author.name
          };
          songs.push(songP);
        });


        const connection = await message.member.voice.channel.join();
        const isPlaying = connection.dispatcher;


        if (isPlaying) {
          message.channel.send(
            `added to queue, senpai! :peach:`
          );
        } else {

          message.channel.send(
            `added to queue, senpai and started playing! :peach:`
          );
          const thumb = await createSongThumbnail(songs, message);
          message.channel.send(thumb).then((msg) => {
            play(connection, songs, msg);
          });
        }


      } else {
        const songInfo = await ytdl.getInfo(args[0]);
        const song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          img: songInfo.videoDetails.thumbnail.thumbnails[4]
            ? songInfo.videoDetails.thumbnail.thumbnails[4].url
            : songInfo.videoDetails.thumbnail.thumbnails[3].url,
          duration: songInfo.videoDetails.lengthSeconds,
          author: songInfo.videoDetails.author.name
        };
        prePlay(song, message);
      }
    }
  },
};

const prePlay = async (choice, message) => {
  const connection = await message.member.voice.channel.join();
  const isPlaying = connection.dispatcher;
  songs.push(choice);
  console.log("Esto es la cola: ", songs);
  if (isPlaying) {
    message.channel.send(
      `the song: ${choice.title} was added, senpai! :peach:`
    );
  } else {
    const thumb = await createSongThumbnail(songs, message);
    message.channel.send(thumb).then((msg) => {
      play(connection, songs, msg);
    });

  }
};

const play = async (connection, songs, message) => {


  const dispatcher = connection
    .play(ytdl(songs[0].url, { filter: "audioonly", volume: 20 / 100 }))
    .on("finish", async () => {
      message.delete();
      console.log("Terminó, la que sigue!");
      songs.shift();
      if (songs.length == 0)
        return message.channel.send(
          "There's no songs, senpai! :pleading_face:"
        );
      const thumb = await createSongThumbnail(songs, message);
      message.channel.send(thumb).then((msg) => {
        play(connection, songs, msg);
      });
    })
    .on("error", (error) => {
      message.channel.send(
        `I'm stupid, senpai :(. Should i try again? :smile:`
      );
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(20 / 100);
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
    .addField(`Next song :black_heart:`, `> ***${nextSong}***`)
    .setTimestamp();

  return messageem1;
}; //Aqui puedo poner el tumbnail del video de yotuube

const createSongThumbnail = (songs, message) => {
  return createMessage(
    `${songs[0].title}`,
    songs[0].img,
    message.author.displayAvatarURL({
      format: "png",
      dynamic: true,
      size: 256,
    }),
    songs.length > 1
      ? songs[1].title
      : "There's no songs, senpai :(",
    songs[0].author,
    songs[0].url
  );
}

const sendSongData = (emoji, choice, message) => {
  message.channel.send(
    `It'll be ${emoji}, senpai! :black_heart:`
  );

  prePlay(choice, message);
}