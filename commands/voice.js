const { Transform } = require('stream');
const googleSpeech = require('@google-cloud/speech');
const googleSpeechClient = new googleSpeech.SpeechClient();
const songs = require('./playSong');
const ytdl = require("ytdl-core");
const ytsr = require("ytsr");
var ytpl = require("ytpl");
const Discord = require("discord.js");

module.exports = {
    name: "voice",
    description: "voice recognition",
    async execute(message) {
        const voiceConnection = await (message.hasOwnProperty('content')) ? message.member.voice.channel.join() : await message.voice.channel.join();
        const receiver = await voiceConnection.receiver;
        const author = await (message.hasOwnProperty('content')) ? await message.author : await message.user;
        const audioStream = await receiver.createStream(author, { mode: "pcm" });
        const requestConfig = {
            encoding: 'LINEAR16',
            sampleRateHertz: 48000,
            languageCode: 'es-MX'
        };
        const request = {
            config: requestConfig
        };
        const recognizeStream = googleSpeechClient
            .streamingRecognize(request)
            .on('error', console.error)
            .on('data', async response => {
                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n')
                    .toLowerCase();
                
                if(transcription.includes("esa no pendeja")){
                    const bot = require("../index");
                    const dispatcher = voiceConnection.dispatcher;
                    dispatcher.emit('finish');
                    bot.channels.cache.get('766777466995474493').send(`Pues perdón, Senpai tan pendejo. :pleading_face: `);
                };

                if (transcription.includes("reproduce")) {
                    const args = await transcription.trim().split(/ +/).slice(2);
                    const bot = require("../index");
                    
                    try {
                        let search = args.toString().replace(/,/g, " ");
                        const filters1 = await ytsr.getFilters(search);
                        const filter1 = filters1.get('Type').get('Video');
                        const options = {
                            limit: 5,
                        }
                        const searchResults = await ytsr(filter1.url, options);
                        let boardSongs = [];


                        boardSongs.push({

                            title: searchResults.items[0].title,
                            url: searchResults.items[0].url,
                            img: searchResults.items[0].bestThumbnail.url,
                            author: searchResults.items[0].author.name
                        });

                        sendSongData( boardSongs[0], message);

                    } catch (error) {
                        console.log(error);
                    }


                } else {
                    return;
                }

            });

        const convertTo1ChannelStream = new ConvertTo1ChannelStream();

        audioStream.pipe(convertTo1ChannelStream).pipe(recognizeStream);

        audioStream.on('end', async (data) => {

        })
    },
};

function convertBufferTo1Channel(buffer) {
    const convertedBuffer = Buffer.alloc(buffer.length / 2);

    for (let i = 0; i < (convertedBuffer.length / 2) - 1; i++) {
        const uint16 = buffer.readUInt16LE(i * 4);
        convertedBuffer.writeUInt16LE(uint16, i * 2)
    }

    return convertedBuffer
}

class ConvertTo1ChannelStream extends Transform {
    constructor(source, options) {
        super(options)
    }

    _transform(data, encoding, next) {
        next(null, convertBufferTo1Channel(data))
    }
}


const prePlay = async (choice, message) => {
    const connection = await message.voice.channel.join();
    const isPlaying = connection.dispatcher;
    const bot = require("../index");
    songs.songs.push(choice);
    if (isPlaying) {

        bot.channels.cache.get('766777466995474493').send(`the song: ${choice.title} was added, senpai! :peach:`);

    } else {
        const thumb = await createSongThumbnail(songs.songs, message);
        bot.channels.cache.get('766777466995474493').send(thumb).then((msg) => {
            play(connection, songs.songs, message);
        });

    }
};

const play = async (connection, songs, message) => {
    const bot = require("../index");
    const dispatcher = connection
        .play(ytdl(songs[0].url, { filter: "audioonly", volume: 20 / 100 }))
        .on("finish", async () => {

            console.log("Terminó, la que sigue!");
            songs.shift();
            if (songs.length == 0)
                return bot.channels.cache.get('766777466995474493').send(
                    "There's no songs, senpai! :pleading_face:"
                ); 
            const thumb = await createSongThumbnail(songs, message);
            const channel = bot.channels.cache.get('766777466995474493');
            channel.mes
            bot.channels.cache.get('766777466995474493').send(thumb).then((msg) => {
                play(connection, songs, message);
            });
        })
        .on("error", (error) => {
            bot.channels.cache.get('766777466995474493').send(
                `¡I'm stupid, senpai :(. Should i try again? :smile:`
            );
            console.error(error);
        });
    dispatcher.setVolumeLogarithmic(20 / 100);
};



const createMessage = async (
    desc,
    img,
    urlAvatar,
    nextSong,
    authorSong,
    urlSong
) => {
    const messageem1 = new Discord.MessageEmbed()
        .setAuthor(authorSong)
        .setColor("#ff0000")
        .setThumbnail(urlAvatar)
        .setTitle(`${desc}:smile: :black_heart:`)
        .setURL(urlSong)
        .setImage(img)
        .addField(`Next song :black_heart:`, `> ***${nextSong}***`)
        .setTimestamp();

    return messageem1;
}; //Aqui puedo poner el tumbnail del video de yotuube

const createSongThumbnail = (songs, message) => {
    const user = typeof message.author === 'undefined' ? message.user : message.author;
    return createMessage(
        `${songs[0].title}`,
        songs[0].img,
        user.displayAvatarURL({
            format: "png",
            dynamic: true,
            size: 256,
        }),
        songs.length > 1
            ? songs[1].title
            : "There's no songs, senpai :(",
        songs[0].author,
        songs[0].url
    );
}

const sendSongData = (choice, message) => {
   
    prePlay(choice, message);
}