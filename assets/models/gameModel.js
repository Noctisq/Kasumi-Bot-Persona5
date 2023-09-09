const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Crear modelo y esquema de un ninja

//crear  esquema de geolocalizacion

const GameSchema = new Schema({
  appid: {
    type: Number,
  },
  name: {
    type: String,
  },
});

const Game = mongoose.model("Game", GameSchema);

module.exports = Game;
