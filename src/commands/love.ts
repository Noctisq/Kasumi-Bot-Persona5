import { Command } from '../interface/Command.interface'
export class LoveCommand implements Command {
	public readonly name : string = 'love';
	public readonly description: string = 'love from kasumi!';
	public interaction;

	public async execute(interaction): Promise<any> {
        return await interaction.reply('i love you senpai!');
    }
}
