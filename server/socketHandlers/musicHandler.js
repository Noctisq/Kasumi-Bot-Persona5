const {getSongs} = require('../../utils/songFunctions');


module.exports = async (io, socket) => {

    const sendResults = async (payload) =>{
        console.log(payload);
        const results = getSongs(payload);
        return results 
    }

    socket.on("searchSong", async(arg, callback) =>{
        console.log("got the arg", arg)
        const newMusicList = await sendResults(arg);
        console.log(newMusicList);
        callback({
            musicList: newMusicList.map(song =>{
                const {title, durationInSec, url} = song;
                let newSongData = {title: title, duration: durationInSec, thumb: url}
                return newSongData;
            })
        });
    });
}