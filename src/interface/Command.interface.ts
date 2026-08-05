import { ChatInputCommandInteraction } from 'discord.js';

export interface Command {
    name: string;
    description: string;
    execute(interaction: ChatInputCommandInteraction): Promise<unknown>;
}
