// at the top of your file
const Discord = require("discord.js");

// inside a command, event listener, etc.

module.exports = {
  name: "help",
  description: "Info",
  execute(message) {
    const exampleEmbed = new Discord.MessageEmbed()
      .setColor("#FF0000")
      .setTitle("Información")
      .attachFiles([
        
        "assets/images/Real_Kasumi.png",
      ])
     
      .setAuthor("Kasumi", "attachment://Real_Kasumi.png")
      .setDescription(
        "Soy Kasumi. Porfa, lee bien los comandos y no chingues al chris :smiling_face_with_3_hearts: "
      )
      
      .addFields(
        {
          name:
            "Para darme alguna orden usa el prefijo ky! seguido de algún comando: ",
          value: "ejemplo: ky!love",
        },

        { name: "love", value: "Te doy amor.",},
        { name: "help", value: "Abrir esta ventana." },
        { name: "play <url o busqueda de canción>", value: "Reproducir una canción",  },
        { name: "volume <num>", value: "Volumen 0-100", },
        { name: "skip", value: "Pasar a la siguiente canción", },
        { name: "night", value: "Me despido de ti :heart:", },
        
      )
     
      .setTimestamp()
      .setFooter("tqm<3", "attachment://Real_Kasumi.png");
     
    message.channel.send(exampleEmbed);
  },
};
