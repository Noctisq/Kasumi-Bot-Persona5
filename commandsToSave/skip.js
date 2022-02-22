module.exports = {
  name: "skip",
  description: "skip a song",
  async execute(message) {
    if (message.member.voice.channel) {
      if (!message.member.voice.channel)
        return message.channel.send(
          "you're not in a voice chat, senpai :c"
        );
      const connection = await message.member.voice.channel.join();
      const dispatcher = connection.dispatcher;
      dispatcher.emit('finish');
    } else {
      message.reply(
        "Join a voice chat adn try it again :heart:"
      );
    }
  },
};
