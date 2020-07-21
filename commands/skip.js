module.exports = {
  name: "skip",
  description: "skip a song",
  async execute(message) {
    if (message.member.voice.channel) {
      if (!message.member.voice.channel)
        return message.channel.send(
          "No estás en ningún canal de voz, senpai :c"
        );
      const connection = await message.member.voice.channel.join();
      const dispatcher = connection.dispatcher;
      dispatcher.emit('finish');
    } else {
      message.reply(
        "Únete a un canal de voz primero y después ejecuta el mismo comando :heart:"
      );
    }
  },
};
