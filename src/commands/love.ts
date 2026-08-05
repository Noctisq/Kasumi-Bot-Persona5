import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../interface/Command.interface'
export class LoveCommand implements Command {
	public readonly name : string = 'love';
	public readonly description: string = 'love from kasumi!';

	public async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
        return await interaction.reply('i love you senpai!');
    }
}
