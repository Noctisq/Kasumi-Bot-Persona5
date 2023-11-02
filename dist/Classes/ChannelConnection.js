"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelConnection = void 0;
const voice_1 = require("@discordjs/voice");
class ChannelConnection {
    async makeVoiceConnection(channel, interaction) {
        try {
            return await (0, voice_1.joinVoiceChannel)({
                channelId: channel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
        }
        catch (error) {
            console.log(error);
            return interaction.update("Something failed while joining in voice channel, senpai ;(");
        }
    }
    ;
}
exports.ChannelConnection = ChannelConnection;
//# sourceMappingURL=ChannelConnection.js.map