const Game = require("../assets/models/gameModel");
const fetch = require("node-fetch");
const Discord = require("discord.js");
module.exports = {
  name: "st",
  description: "Search for a steam game",
  execute(message, args) {
    if (args.length == 0)
      return message.channel.send(
        "Introduce el nombre del juego, senpai! :heart:"
      );

    let search = args.toString().replace(/,/g, " ");
    Game.findOne({ name: search.toLowerCase() }, async (err, docs) => {
      if (err) {
        return message.channel.send(
          "No pude recolectar ningún dato, senpai...."
        );
      }
      if (!docs) {
        return message.channel.send(
          "No encuentro el juego, ¿Podrías ser más exacto con el nombre, senpai? :tired_face: "
        );
      }
      message.channel.send("Recolectando datos, senpai...");

      fetch(
        `https://store.steampowered.com/api/appdetails?appids=${docs.appid}&cc=mxn`
      )
        .then((response) => {
          return response.json();
        })
        .then((response) => {
          let categories = "";
          let messageCritic = "";
          if (!response[docs.appid].data.metacritic) {
            messageCritic =
              "No encontré datos sobre el score en metacritic, senpai:cold_sweat:.";
          } else {
            if (response[docs.appid].data.metacritic.score > 90) {
              messageCritic = `Tiene un score de ${
                response[docs.appid].data.metacritic.score
              } en metacritic. Parece que es un juego extraordinario, senpai. ¡Debes de jugarlo! :yellow_heart: `;
            } else if (
              response[docs.appid].data.metacritic.score <= 90 &&
              response[docs.appid].data.metacritic.score >= 70
            ) {
              messageCritic = `Tiene un score de ${
                response[docs.appid].data.metacritic.score
              } en metacritic. Es un buen juego, senpai. :yellow_heart: `;
            } else if (
              response[docs.appid].data.metacritic.score < 70 &&
              response[docs.appid].data.metacritic.score >= 40
            ) {
              messageCritic = `Tiene un score de ${
                response[docs.appid].data.metacritic.score
              } en metacritic. Es un juego regular, senpai.:yum: `;
            } else if (
              response[docs.appid].data.metacritic.score < 40 &&
              response[docs.appid].data.metacritic.score == 0
            ) {
              messageCritic = `Tiene un score de ${
                response[docs.appid].data.metacritic.score
              } en metacritic. Esto es una mierda, senpai.:poop: `;
            }
          }

          response[docs.appid].data.genres.forEach((category) => {
            categories += `${category.description}, `;
          });
          message.channel.send("¡Ya lo encontré senpai!").then(() => {
            const messageem2 = new Discord.MessageEmbed()
              .setColor("#a93451")
              .setTitle(response[docs.appid].data.name)
              .setAuthor("Kasumi V1.0", "https://i.ibb.co/FJqCkLD/Kasumi.gif")
              .setDescription(
                `Podríamos decir que este juego entra en los géneros de ${categories} senpai :blue_heart:. ${messageCritic}`
              )

              .addFields({
                name: "Precio: ",
                value: `${
                  "`" +
                  response[docs.appid].data.price_overview.final_formatted +
                  "`"
                }`,
              })
              .setImage(response[docs.appid].data.header_image)
              .setTimestamp();
            message.channel.send(messageem2);
          });
        });
    });
  },
};
