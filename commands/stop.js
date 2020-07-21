module.exports = {
  name: "stop",
  description: "Stop music",
  async execute(message, args) {
    console.log(message.member.voice.channel);
    if (!message.member.voice.channel)
      return message.channel.send("No estás en ningún chat de voz, senpai :c");
    
    message.member.voice.channel.leave();
    message.reply("Se paró la música y salí del chat de voz. :upside_down:");
  },
};
