"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetCookieCommand = void 0;
const v10_1 = require("discord-api-types/v10");
class SetCookieCommand {
    constructor(musicPlayer) {
        this.musicPlayer = musicPlayer;
        this.name = 'set-cookie';
        this.description = 'Owner only: refresh the YouTube session cookie without restarting the bot.';
        this.options = [
            {
                name: 'value',
                description: 'Fresh Cookie header value, copied from a logged-in youtube.com session',
                type: v10_1.ApplicationCommandOptionType.String,
                required: true,
            },
        ];
    }
    async execute(interaction) {
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
        }
        catch (error) {
            console.error('[SetCookieCommand] Failed to refresh cookie:', error);
            return interaction.reply({ content: 'Something went wrong updating the cookie, senpai. :(', ephemeral: true });
        }
    }
}
exports.SetCookieCommand = SetCookieCommand;
//# sourceMappingURL=set-cookie.js.map