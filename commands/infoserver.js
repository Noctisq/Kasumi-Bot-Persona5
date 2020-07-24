// at the top of your file
const Discord = require("discord.js");

// inside a command, event listener, etc.

module.exports = {
  name: "help",
  description: "Info",
  async execute(message) {
    const messageem1 = new Discord.MessageEmbed()
      .setColor("#FF0000")
      .setTitle("Información general")
      .attachFiles([
        "assets/images/Real_Kasumi.png",
        "assets/images/Kasumi.png",
      ])
      .setAuthor("Kasumi V1.0", "attachment://Real_Kasumi.png")
      .setThumbnail("attachment://Kasumi.png")
      .setDescription(
        "Soy un bot para discord que está en early development, así que por ahora mis funcionalidades están limitadas a reproducir música y a unas cuántas interacciones contigo, senpai. Así que ten un poco de paciencia conmigo :heart:."
      )
      .setTimestamp()
      .setFooter("tqm<3", "attachment://Kasumi.png");

    const messageem2 = new Discord.MessageEmbed()
      .setColor("#000000")
      .setTitle("Comandos")
      .attachFiles([
        
        "assets/images/Kasumi.png",
      ])
      .setThumbnail("attachment://Kasumi.png")
      .setDescription(
        "Para poder darme una orden tienes que seguir la estructura `ky!<comando>`, siempre que quieras recordarlos puedes usar `ky!help`:heart:"
      )

      .addFields({
        name: "Acciones: ",
        value:
          "\n> `ky!play <url o nombre> ` Reproduzco una canción. :heart:\n> `ky!love` Te doy amor. :heart:\n> `ky!pause` Pauso la música canción. :heart:\n> `ky!resume` Reanudo la música :heart:\n> `ky!volume <0-85>` Cambiar el volúmen de la música. :heart:\n> `ky!skip` Saltar canción.:heart:\n> `ky!reset` Limpia la cola de canciones.:heart:\n> `ky!stop` Salgo del chat de voz.:heart:\n> `ky!night` Te doy las buenas noches.:heart:\n\n\n\n",
      })

      .setTimestamp()
      .setFooter("tqm<3", "attachment://Kasumi.png");

    const messageem3 = new Discord.MessageEmbed()
      .setColor("#FF0000")
      .setTitle("Otros")
      .attachFiles([
        
        "assets/images/Kasumi.png",
      ])
      .setThumbnail("attachment://Kasumi.png")
      .setDescription(
        "Si quieres realizar tu propio bot y quieres tener como base a Kasumi, puedes dirigirte a su [repositorio](https://github.com/Noctisq/Kasumi-Bot-Persona5) de github. También, si tienes algún problema, puedes levantar un issue en el mismo repositorio."
      )
      .setTimestamp()
      .setFooter("tqm<3", "attachment://Kasumi.png");

    await message.channel.send(messageem1);
    await message.channel.send(messageem2);
    await message.channel.send(messageem3);
  },
};
