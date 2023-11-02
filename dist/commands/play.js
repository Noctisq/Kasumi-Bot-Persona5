"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayCommand = void 0;
const v10_1 = require("discord-api-types/v10");
const builders_1 = require("@discordjs/builders");
const SelectMenuHandler_1 = require("../Classes/SelectMenuHandler");
const ChannelConnection_1 = require("../Classes/ChannelConnection");
const AudioPlayer_1 = require("../Classes/AudioPlayer");
const { search } = require('play-dl');
class PlayCommand {
    constructor() {
        this.name = 'play';
        this.description = 'Search a song or paste a youtube link!';
        this.options = [
            {
                name: 'song_name',
                description: 'song name or youtube link!',
                type: v10_1.ApplicationCommandOptionType.String,
                required: true,
            }
        ];
    }
    async execute(interaction) {
        try {
            const user = await interaction.member.fetch();
            const channel = await user.voice.channel;
            if (!channel)
                return interaction.reply("You're not on a Voice Channel, senpai. Give me a break.");
            const audioPlayerInstance = AudioPlayer_1.AudioPlayer.getInstance();
            const audioPlayerHasNotBeenInitialized = () => Object.keys(audioPlayerInstance).length === 0;
            const voiceChannelConnection = await new ChannelConnection_1.ChannelConnection().makeVoiceConnection(channel, interaction);
            const searchResults = await this.getQueryResults(interaction);
            const selectMenu = await this.printOptionsFound(searchResults, interaction, channel);
            const songsToAdd = await selectMenu.start();
            await selectMenu.interaction.delete();
            if (audioPlayerHasNotBeenInitialized()) {
                audioPlayerInstance.initialize(songsToAdd, voiceChannelConnection);
                audioPlayerInstance.playMusic();
                return await interaction.channel.send("Starting Songs!");
            }
            const areSongsInQueue = () => audioPlayerInstance.songs.getCurrentQueue().length > 0;
            if (areSongsInQueue()) {
                songsToAdd.forEach(song => {
                    audioPlayerInstance.songs.addSong(song);
                });
                return await interaction.channel.send('Music added!');
            }
            audioPlayerInstance.playMusic();
            return await interaction.channel.send('Starting Songs!');
        }
        catch (error) {
            console.error(error);
            return await interaction.channel.send('Something happened when trying to play music, senpai. :(');
        }
    }
    async getQueryResults(interaction) {
        try {
            const songToSearch = await interaction.options.get('song_name').value;
            console.log(await search(songToSearch, { limit: 5 }));
            return await search(songToSearch, { limit: 5 });
        }
        catch (error) {
            console.log(error);
        }
    }
    async printOptionsFound(songs, interaction, channel) {
        const songsToPrint = songs.map(song => {
            return {
                label: song.title,
                value: song.url
            };
        });
        const row = new builders_1.ActionRowBuilder()
            .addComponents(new builders_1.StringSelectMenuBuilder()
            .setCustomId('select')
            .setPlaceholder('Nothing selected, senpai')
            .setMinValues(0)
            .setMaxValues(songs.length)
            .addOptions(songsToPrint));
        const optionsModal = await interaction.reply({ content: 'This is what i found, senpai!', components: [row] });
        const collectorHandler = new SelectMenuHandler_1.SelectMenuHandler(optionsModal, { componentType: v10_1.ComponentType.StringSelect, time: 3600000 }, songsToPrint);
        return collectorHandler;
    }
}
exports.PlayCommand = PlayCommand;
//# sourceMappingURL=play.js.map