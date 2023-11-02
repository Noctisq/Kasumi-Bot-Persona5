import {joinVoiceChannel} from '@discordjs/voice';
export class ChannelConnection {

    public async makeVoiceConnection(channel, interaction) {
        try {
            return await joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator
            });
        } catch (error) {
            console.log(error);
            return interaction.update("Something failed while joining in voice channel, senpai ;(");
        }
        
    };

}