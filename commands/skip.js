module.exports = {
  name: "skip",
  description: "skip a song",
  async execute(message) {
    if (message.member.voice.channel) {
      if (!message.member.voice.channel)
        return message.channel.send(
          "No estás en ningún canal de voz, senpai :c"
        );
      const voiceChannel = await bot.voice.connections.first(1);

      const dispatcher = voiceChannel[0].dispatcher;
      dispatcher.emit("finish");
    } else {
      message.reply(
        "Únete a un canal de voz primero y después ejecuta el mismo comando :heart:"
      );
    }
  },
};
