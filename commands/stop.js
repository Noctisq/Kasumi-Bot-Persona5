module.exports = {
  name: "stop",
  description: "Stop music",
  async execute(message, args) {
    console.log(message.member.voice.channel);
    if (!message.member.voice.channel)
      return message.channel.send("You're not on a voice channel, senpai :c");
    
    message.member.voice.channel.leave();
    message.reply("bye bye, senpai. :upside_down:");
  },
};
