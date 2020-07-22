module.exports = {
    name: "reset",
    description: "reset queue",
    async execute(message) {
        if (!message.member.voice.channel)
        return message.channel.send("No estás en ningún chat de voz, senpai :c");
  
      const connection = await message.member.voice.channel.join();
  
      await connection.disconnect()
      await message.reply("La cola se reinició, senpai :black_heart:");
     
      await message.member.voice.channel.join();
     
    },
  };
  