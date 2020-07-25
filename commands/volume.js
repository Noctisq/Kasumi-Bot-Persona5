module.exports = {
  name: "volume",
  description: "Volume for music",
  async execute(message, args) {
    if (!message.member.voice.channel)
      return message.channel.send("No estás en ningún chat de voz, senpai :c");
    if (args.length == 0)
      return message.channel.send(
        "No te olvides de poner el volumen. Senpai tan pendejo :heart:"
      );

    console.log("este es el volumen que llega: ", args);
    const connection = await message.member.voice.channel.join();

    const dispatcher = connection.dispatcher;
    if (parseInt(args[0]) > 85)
      return message.channel.send(
        "Es mucho volumen, senpai. Intenta con valores entre 0 y 85 :persevere:"
      );
    dispatcher.setVolumeLogarithmic(parseInt(args[0]) / 100);
    message.reply(
      `Cambiando volumen de la música a: ${args[0]} , senpai :blush:`
    );
  },
};
