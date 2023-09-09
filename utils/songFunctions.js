
const {search} = require('play-dl');

const getSongs = async (name) => {
    try {
      return await search(name, { limit : 10 })
    } catch (error) {
      console.log(error);
    }    
}

module.exports = {
    getSongs
};