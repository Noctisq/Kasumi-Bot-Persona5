module.exports = {
  name: "resume",
  description: "Resume music",
  async execute(message) {
    if (!message.member.voice.channel)
      return message.channel.send("you're not in a voice chat, senpai :c");

    const connection = await message.member.voice.channel.join();

    const dispatcher = connection.dispatcher;
    dispatcher.resume();
    message.reply("Reanudando la música, senpai :blush:");
  },
};
