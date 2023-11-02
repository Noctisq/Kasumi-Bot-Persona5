import { ApplicationCommandOptionType, ComponentType} from 'discord-api-types/v10';
import { Command } from '../interface/Command.interface'
import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from '@discordjs/builders';
import { SelectMenuHandler } from '../Classes/SelectMenuHandler';
import { ChannelConnection } from '../Classes/ChannelConnection';
import { AudioPlayer } from '../Classes/AudioPlayer';
const { search} = require('play-dl');

export class PlayCommand implements Command {
  public readonly name: string = 'play';
  public readonly description: string = 'Search a song or paste a youtube link!';
  public readonly data: SlashCommandBuilder;
  public readonly options: Array<object> = [
    {
      name: 'song_name',
      description: 'song name or youtube link!',
      type : ApplicationCommandOptionType.String,
      required: true,
    }
  ];

  public async execute(interaction): Promise<any> {
    try {
      const user = await interaction.member.fetch();
      const channel = await user.voice.channel;
      
      if(!channel) return interaction.reply("You're not on a Voice Channel, senpai. Give me a break.");
      
      const audioPlayerInstance = AudioPlayer.getInstance();
      const audioPlayerHasNotBeenInitialized = () => Object.keys(audioPlayerInstance).length === 0;
      const voiceChannelConnection = await new ChannelConnection().makeVoiceConnection(channel, interaction);
      const searchResults = await this.getQueryResults(interaction);
      const selectMenu = await this.printOptionsFound(searchResults, interaction, channel);
      const songsToAdd: Array<any> = await selectMenu.start();
      await selectMenu.interaction.delete();

      if(audioPlayerHasNotBeenInitialized()){
        audioPlayerInstance.initialize(songsToAdd, voiceChannelConnection);
        audioPlayerInstance.playMusic();
        return await interaction.channel.send("Starting Songs!");
      }

      const areSongsInQueue = () => audioPlayerInstance.songs.getCurrentQueue().length > 0;

      if(areSongsInQueue()){
        songsToAdd.forEach(song => {
          audioPlayerInstance.songs.addSong(song);
        });
        return await interaction.channel.send('Music added!');
      }
      
      audioPlayerInstance.playMusic();
      return await interaction.channel.send('Starting Songs!');

    } catch (error) {
      console.error(error);
      return await interaction.channel.send('Something happened when trying to play music, senpai. :(');
    }
  }


  public async getQueryResults(interaction){
    try {
        const songToSearch = await interaction.options.get('song_name').value;
        console.log(await search(songToSearch, { limit : 5 }));
        return await search(songToSearch, { limit : 5 });
    } catch (error) {
      console.log(error);
    }
  }

  public async printOptionsFound(songs, interaction,channel){
    const songsToPrint = songs.map(song => {
      return {
        label: song.title,
        value : song.url
      }
    });
    const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .setPlaceholder('Nothing selected, senpai')
        .setMinValues(0)
        .setMaxValues(songs.length)
        .addOptions(songsToPrint),
    );
  
    const optionsModal = await interaction.reply({ content: 'This is what i found, senpai!', components: [row] });
    
    const collectorHandler = new SelectMenuHandler(
      optionsModal,
      { componentType: ComponentType.StringSelect, time: 3_600_000 },
      songsToPrint,
    );
    return collectorHandler;
  }
}