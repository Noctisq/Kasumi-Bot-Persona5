module.exports = {
  name: "volume",
  description: "Volume for music",
  async execute(message, args) {
    if (!message.member.voice.channel)
      return message.channel.send("you're not in a voice channel, senpai :c");
    if (args.length == 0)
      return message.channel.send(
        "Don't forget the volume. Stupid senpai. :heart:"
      );
    
    if(message.author.username == "Nezukochiquita"){
      return message.channel.send(
        "Chingas a tu puta madre senpai, tú no puedes hacer eso :3:heart:"
      );
    }
    
    console.log("este es el volumen que llega: ", message.author.username);
    const connection = await message.member.voice.channel.join();

    const dispatcher = connection.dispatcher;
    if (parseInt(args[0]) > 85)
      return message.channel.send(
        "that's a lot, senpai. try numbers between 0 y 85 :persevere:"
      );
    dispatcher.setVolumeLogarithmic(parseInt(args[0]) / 100);
    message.reply(
      `Changing volune to: ${args[0]} , senpai :blush:`
    );
  },
};
