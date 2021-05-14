module.exports = {
	name: 'join',
	description: 'join to voice channel',
	async execute(message) {
        if (message.member.voice.channel) {
            const connection = await message.member.voice.channel.join();
           
            
          } else {
            message.reply('Join a voice chat adn try it again :heart:');
          }
	},
};


