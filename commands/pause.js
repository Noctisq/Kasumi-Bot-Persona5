module.exports = {
  name: "pause",
  description: "Pause music",
  async execute(message) {
    if (!message.member.voice.channel)
    return message.channel.send("No estás en ningún chat de voz, senpai :c");
    const connection = await message.member.voice.channel.join();
    
    const dispatcher = connection.dispatcher;
    dispatcher.pause();
    message.reply("Se pausó la música. :relaxed:");
  },
};
