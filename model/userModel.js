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
  dealScore: {
    type: Number,
    default: 0,
  },
  score: {
    type: Number,
    default: 0,
  },
  gamesPlayed: {
    type: Number,
    default: 0,
  },
  gamesWon: {
    type: Number,
    default: 0,
  },
  currentGameStatus: {
    type: String,
    enum: ["waiting", "playing", "finished"],
    default: "waiting",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  melds: {
    type: Array,    
    default: [],
  },
  hasDropped: {
    type: Boolean,
    default: false,
  },
  dropType: {
    type: String,
    enum: ['first', 'middle'],
    default: null,
  },
});

module.exports = mongoose.model("User", userSchema);
