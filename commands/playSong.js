const Discord = require("discord.js");
const {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	joinVoiceChannel,
} = require('@discordjs/voice');

const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { search, video_basic_info, stream} = require('play-dl');

const { SlashCommandBuilder } = require('@discordjs/builders');
var songsQeue = [];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Search a song or paste a youtube link!')
    .addStringOption(option =>
      option.setName('song_name')
        .setDescription('Name or Link')
        .setRequired(true)),
	async execute(interaction) {
    try {
      const user = await interaction.member.fetch();
      const channel = await user.voice.channel;
      if(!channel) return interaction.reply("You're not on a Voice Channel, senpai. Give me a break.");
      const querySong = await interaction.options.get('song_name').value;
      await getSong(querySong, interaction, channel);
    } catch (error) {
      console.error(error);
    }
    
    
	},
  songsData: songsQeue,

};

const makeVoiceConnection = async (interaction, channel, stream) => {

  try {
    const connection = await joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });
  
    const resource = await createAudioResource(stream.stream, { inputType: stream.type });
    const player = await createAudioPlayer();
  
    await playMusic(player, resource, connection, interaction)
  } catch (error) {
    console.error(error)
  }
  
}

const playMusic = async (player, resource, connection) =>{
  try{
    await player.play(resource);
    await connection.subscribe(player);
    player.on(AudioPlayerStatus.Idle, () => nextSong(player, connection));
  }catch(error){
    console.error(error);
  }
  
}

const nextSong = async (player, connection)=> {
  try {
    songsQeue.shift();
    if(songsQeue.length == 0){
      connection.destroy();
    }
    console.log(songsQeue);
    const streamToRead =  await stream(songsQeue[0], { quality: 1 });
    const resource = await createAudioResource(streamToRead.stream, { inputType: streamToRead.type });
    await player.play(resource);
  } catch (error) {
    console.error(error);
  }
 
  
}

const getSong = async (song, interaction, channel) => {
    
  try {
    if(song.includes("www") && songsQeue.length > 0 ){
      return await ytdl(song, { filter: 'audioonly' });
    } 
      const infoVideos = await search(song, { limit : 5 });
      await chooseSong(infoVideos, interaction, channel);
  } catch (error) {
    console.log(error);
  }
  
}

const chooseSong = async (songs, interaction, channel) => { 
  try {
    const interactionToSend = interaction;
  const songsToPrint = await songs.map(song => {
    return {
      label: song.title,
      value : song.url
    }
  });
  const row = new MessageActionRow()
  .addComponents(
    new MessageSelectMenu()
      .setCustomId('select')
      .setPlaceholder('Nothing selected, senpai')
      .setMinValues(0)
			.setMaxValues(songs.length)
      .addOptions(songsToPrint),
  );

  await interactionToSend.reply({ content: 'This is what i found, senpai!', components: [row] });

  interactionToSend.client.on('interactionCreate', async interaction => {
    if (!interaction.isSelectMenu()) return;
    if (interaction.customId === 'select') {
      if(songsQeue.length > 0){
        songsQeue = songsQeue.concat(interaction.values);
        console.log("DESPUES", songsQeue);
        await interaction.update({ content: 'Songs Added!', components: [] });
        return;
      }
      songsQeue = songsQeue.concat(interaction.values);
      const streamToRead =  await stream(songsQeue[0], { quality: 1 });
      await makeVoiceConnection(interactionToSend, channel, streamToRead);
      await interaction.update({ content: 'Songs Added!', components: [] });
      
    }
  });
  } catch (error) {
    console.error(error);
  }
  

}