import { ApplicationCommandOptionType, ComponentType } from 'discord-api-types/v10';
import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../interface/Command.interface'
import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from '@discordjs/builders';
import { SelectMenuHandler } from '../Classes/SelectMenuHandler';
import { MusicPlayer, MusicTrack } from '../interface/MusicPlayer.interface';

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

  constructor(private readonly musicPlayer?: MusicPlayer) {}

  public async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    if (!this.musicPlayer) {
      throw new Error('PlayCommand.execute called without a MusicPlayer — this should never happen outside deploy-commands.ts');
    }
    const musicPlayer = this.musicPlayer;

    try {
      const user = await interaction.guild!.members.fetch(interaction.user.id);
      const channel = user.voice.channel;

      if(!channel) return interaction.reply("You're not on a Voice Channel, senpai. Give me a break.");

      const songToSearch = interaction.options.getString('song_name', true);
      const tracks = await musicPlayer.search(songToSearch, interaction.user);
      if (tracks.length === 0) {
        return interaction.reply("Couldn't find anything for that, senpai. Try another search, okay?");
      }

      const selectMenu = await this.printOptionsFound(tracks, interaction);
      const selectedUrls: Array<string> = await selectMenu.start();
      await selectMenu.interaction.delete();

      if (!selectedUrls || selectedUrls.length === 0) {
        return interaction.channel.send('Nothing selected, senpai.');
      }

      const { startedFresh } = await musicPlayer.enqueue(channel, interaction.channel, selectedUrls, interaction.user);

      return startedFresh
        ? interaction.channel.send('Starting Songs!')
        : interaction.channel.send('Music added!');

    } catch (error) {
      console.error(error);
      return await interaction.channel.send('Something happened when trying to play music, senpai. :(');
    }
  }

  private async printOptionsFound(tracks: MusicTrack[], interaction){
    const songsToPrint = tracks.slice(0, 5).map(track => {
      return {
        label: track.title.slice(0, 100),
        value : track.url
      }
    });
    const row = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select')
        .setPlaceholder('Nothing selected, senpai')
        .setMinValues(0)
        .setMaxValues(songsToPrint.length)
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
