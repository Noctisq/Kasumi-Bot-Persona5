import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../interface/Command.interface';
import { MusicPlayer } from '../interface/MusicPlayer.interface';

export class SetCookieCommand implements Command {
  public readonly name: string = 'set-cookie';
  public readonly description: string = 'Owner only: refresh the YouTube session cookie without restarting the bot.';
  public readonly options: Array<object> = [
    {
      name: 'value',
      description: 'Fresh Cookie header value, copied from a logged-in youtube.com session',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ];

  constructor(private readonly musicPlayer?: MusicPlayer) {}

  public async execute(interaction: ChatInputCommandInteraction): Promise<unknown> {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply({ content: "This isn't for you, senpai.", ephemeral: true });
    }
    if (!this.musicPlayer) {
      throw new Error('SetCookieCommand.execute called without a MusicPlayer — this should never happen outside deploy-commands.ts');
    }

    const cookie = interaction.options.getString('value', true);

    try {
      await this.musicPlayer.refreshYoutubeCookie(cookie);
      return interaction.reply({ content: 'Cookie updated and session refreshed, senpai!', ephemeral: true });
    } catch (error) {
      console.error('[SetCookieCommand] Failed to refresh cookie:', error);
      return interaction.reply({ content: 'Something went wrong updating the cookie, senpai. :(', ephemeral: true });
    }
  }
}
