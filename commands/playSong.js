const ytdl = require("ytdl-core");
var songs = [];
module.exports = {
  name: "play",
  description: "Play a song",
  async execute(message, args) {
    if (!message.member.voice.channel)
      return message.channel.send("No estás en ningún chat de voz, senpai :c");
    if(args.length == 0)
    return message.channel.send("¿Qué canción reproduzco?, no seas baboso senpai.");
    const connection = await message.member.voice.channel.join();
    const isPlaying = connection.dispatcher;
    const songInfo = await ytdl.getInfo(args[0]);
    const song = {
      title: songInfo.videoDetails.title,
      url: songInfo.videoDetails.video_url,
    };
    songs.push(song);

    if (isPlaying) {
      message.channel.send(
        `¡La canción ${song.title} se ha añadido a la cola, senpai! :peach:`
      );
    } else {
      message.channel.send(
        `¡La canción ${song.title} se ha añadido a la cola, senpai! :peach:`
      );

      play(connection, songs, message);
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
