module.exports = {
	name: 'join',
	description: 'join to voice channel',
	async execute(message) {
        if (message.member.voice.channel) {
            const connection = await message.member.voice.channel.join();
           
            
          } else {
            message.reply('Únete a un chat de voz primero y después ejecuta el mismo comando :heart:');
          }
	},
};


