const mongoose = require("mongoose");

const playerInGameSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  socketId: { type: String },
  score: { type: Number, default: 0 },
  drawn: { type: Boolean, default: false },
  discarded: { type: Boolean, default: false },
dropType: { type: String, enum: ['first', 'middle', null], default: null },
status: {
    type: String,
    enum: ["waiting", "playing", "finished", "dropped"],
    default: "waiting"
  },
  melds: [
    [
      {
        id: String,
        value: String,
      },
    ],
  ],
  hand: [
    {
      id: String,
      value: String,
    },
  ],
});

module.exports = mongoose.model("PlayerInGame", playerInGameSchema);
