module.exports = {
  name: "pause",
  description: "Pause music",
  async execute(message) {
    if (!message.member.voice.channel)
    return message.channel.send("you're not in a voice chat, senpai :c");
    const connection = await message.member.voice.channel.join();
    
    const dispatcher = connection.dispatcher;
    dispatcher.pause();
    message.reply("i paused the music. :relaxed:");
  },
};
