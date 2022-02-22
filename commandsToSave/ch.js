module.exports = {
  name: "ch",
  description: "chinga tu madre",
  async execute(message) {
   
    console.log(message.mentions.users);
    if (message.mentions.users) {
      // check if an user is mentionned
      message.mentions.users.forEach((mention) => {
        // do something for each mentions
        console.log(mention);
        message.channel.send(
          `${mention} te mandó a chingar a tu madre ${message.author.username}, senpai :heart:`
        );
      });
    } else {
      message.channel.send("Menciona a alguien, senpai! :(");
    }
  },
};
