// at the top of your file
const Discord = require("discord.js");

// inside a command, event listener, etc.

module.exports = {
  name: "help",
  description: "Info",
  async execute(message) {
    const messageem1 = new Discord.MessageEmbed()
      .setColor("#FF0000")
      .setTitle("General Info")

      .setAuthor("Kasumi V1.1", "https://i.ibb.co/FJqCkLD/Kasumi.gif")
      .setThumbnail("attachment://Kasumi.png")
      .setDescription(
        "I'm a Discord bot that's in early development, so for now my functionality is limited to playing music and a few interactions with you, senpai. So bear a little patience with me :heart:."
      )
      .setTimestamp()
      .setFooter("tqm<3", "https://i.ibb.co/FJqCkLD/Kasumi.gif");

    const messageem2 = new Discord.MessageEmbed()
      .setColor("#000000")
      .setTitle("Commands")

      
      .setDescription(
        "To give an order you have to follow the structure `k <command>`, whenever you want to remember them you can use `k help`:heart:"
      )

      .addFields({
        name: "Actions: ",
        value:
          "\n> `k play <url o name> ` I play a song. :heart:\n> \n> `k stop ` i stop being annoying. :heart:\n> `k love` i give you love. :heart:\n> `k pause` I pause the song. :heart:\n> `k resume` Resume music :heart:\n> `k volume <0-85>` Change my volume. :heart:\n> `k skip` Skip Song.:heart:\n> `k reset` Restart queue.:heart:\n> `k night` I say you good night.:heart:\n\n\n\n",
      })
      .setImage("https://i.ibb.co/FJqCkLD/Kasumi.gif")
      .setTimestamp();

    const messageem3 = new Discord.MessageEmbed()
      .setColor("#FF0000")
      .setTitle("For you")

      .setThumbnail("https://i.ibb.co/FJqCkLD/Kasumi.gif")
      .setDescription(
        "If you want to make your own bot y and you want to use kasumi as your base you can go to: [repository](https://github.com/Noctisq/Kasumi-Bot-Persona5)"
      )
      .setTimestamp()
      .setFooter("ily<3", "https://i.ibb.co/FJqCkLD/Kasumi.gif");

    await message.channel.send(messageem1);
    await message.channel.send(messageem2);
    await message.channel.send(messageem3);
  },
};
