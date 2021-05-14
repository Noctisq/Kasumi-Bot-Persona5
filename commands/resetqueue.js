let {songs} = require("../commands/playSong");

module.exports = {
  name: "reset",
  description: "reset queue",
  async execute(message) {
    if (!message.member.voice.channel)
      return message.channel.send("you're not in a voice chat, senpai :c");

    await message.member.voice.channel.join();

    console.log("Antes la cola: ",songs);
    songs.length = 0;
    console.log("después la cola: ", songs);
    await message.reply("queue restarted, senpai :black_heart:");
  },
};
