const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  gameType: { type: String, enum: ["point", " pool61", "pool101", "pool201"], required: true },
  poolLimit: { type: Number, default: null },
  round: { type: Number, default: 1 },
  started: { type: Boolean, default: false },
  playersCount: { type: Number, default: 0 }, 
  entryFee: { type: Number, default: 0 },   
  prizePool: { type: Number, default: 0 },  

  gameStatus: { type: String, enum: ["waiting", "started", "finished"], default: "waiting" },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  winnerName: { type: String, default: "" },
  prizeWon: { type: Number, default: 0 },
  deck: [
    {
      id: String,
      value: String,
    },
  ],
  discardPile: [
    {
      id: String,
      value: String,
    },
  ],
  wildCard: {
    id: String,
    value: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Game", gameSchema);
