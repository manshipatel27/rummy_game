const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    // select: false
  },
  
  gamesPlayed: {
    type: Number,
    default: 0,
  },
  gamesWon: {
    type: Number,
    default: 0,
  },
  wallet: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
 
  
});

module.exports = mongoose.model("User", userSchema);

  // currentGameStatus: {
  //   type: String,
  //   enum: ["waiting", "playing", "finished"],
  //   default: "waiting",
  // },
   // melds: {
  //   type: Array,    
  //   default: [],
  // },
  // hasDropped: {
  //   type: Boolean,
  //   default: false,
  // },
  // dropType: {
  //   type: String,
  //   enum: ['first', 'middle'],
  //   default: null,
  // },
  // dealScore: {
    //   type: Number,
    //   default: 0,
    // },
    // score: {
    //   type: Number,
    //   default: 0,
    // },