let {songs} = require("../commands/playSong");

module.exports = {
  name: "reset",
  description: "reset queue",
  async execute(message) {
    if (!message.member.voice.channel)
      return message.channel.send("No estás en ningún chat de voz, senpai :c");

    await message.member.voice.channel.join();

    console.log(songs);
    songs.length = 0;
    console.log(songs);
    await message.reply("La cola se reinició, senpai :black_heart:");
  },
};
