const { SlashCommandBuilder } = require('@discordjs/builders');
const {songsData} = require('./playSong');
module.exports = {
  data: new SlashCommandBuilder()
		.setName('skip')
		.setDescription('skip current song!'),
  async execute(interaction) {
    try {
      const user = await interaction.member.fetch();
      const channel = await user.voice.channel;
      if(!channel) return interaction.reply("You're not on a Voice Channel, senpai. Give me a break.");
      const streamToRead =  await stream(songsQeue[0], { quality: 1 });
      const connection = await joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator
      });
    } catch (error) {
      console.log(error);
    }
  },
};
