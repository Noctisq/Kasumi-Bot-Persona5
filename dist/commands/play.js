"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayCommand = void 0;
const v10_1 = require("discord-api-types/v10");
const builders_1 = require("@discordjs/builders");
const SelectMenuHandler_1 = require("../Classes/SelectMenuHandler");
class PlayCommand {
    constructor(musicPlayer) {
        this.musicPlayer = musicPlayer;
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
        if (!this.musicPlayer) {
            throw new Error('PlayCommand.execute called without a MusicPlayer — this should never happen outside deploy-commands.ts');
        }
        const musicPlayer = this.musicPlayer;
        try {
            const user = await interaction.guild.members.fetch(interaction.user.id);
            const channel = user.voice.channel;
            if (!channel)
                return interaction.reply("You're not on a Voice Channel, senpai. Give me a break.");
            const songToSearch = interaction.options.getString('song_name', true);
            const tracks = await musicPlayer.search(songToSearch, interaction.user);
            if (tracks.length === 0) {
                return interaction.reply("Couldn't find anything for that, senpai. Try another search, okay?");
            }
            const selectMenu = await this.printOptionsFound(tracks, interaction);
            const selectedUrls = await selectMenu.start();
            await selectMenu.interaction.delete();
            if (!selectedUrls || selectedUrls.length === 0) {
                return interaction.channel.send('Nothing selected, senpai.');
            }
            const { startedFresh } = await musicPlayer.enqueue(channel, interaction.channel, selectedUrls, interaction.user);
            return startedFresh
                ? interaction.channel.send('Starting Songs!')
                : interaction.channel.send('Music added!');
        }
        catch (error) {
            console.error(error);
            return await interaction.channel.send('Something happened when trying to play music, senpai. :(');
        }
    }
    async printOptionsFound(tracks, interaction) {
        const songsToPrint = tracks.slice(0, 5).map(track => {
            return {
                label: track.title.slice(0, 100),
                value: track.url
            };
        });
        const row = new builders_1.ActionRowBuilder()
            .addComponents(new builders_1.StringSelectMenuBuilder()
            .setCustomId('select')
            .setPlaceholder('Nothing selected, senpai')
            .setMinValues(0)
            .setMaxValues(songsToPrint.length)
            .addOptions(songsToPrint));
        const optionsModal = await interaction.reply({ content: 'This is what i found, senpai!', components: [row] });
        const collectorHandler = new SelectMenuHandler_1.SelectMenuHandler(optionsModal, { componentType: v10_1.ComponentType.StringSelect, time: 3600000 }, songsToPrint);
        return collectorHandler;
    }
}
exports.PlayCommand = PlayCommand;
//# sourceMappingURL=play.js.map