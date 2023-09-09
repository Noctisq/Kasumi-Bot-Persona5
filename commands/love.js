const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('love')
		.setDescription('love from kasumi!'),
	async execute(interaction) {
		await interaction.reply('i love you senpai!');
	},
};