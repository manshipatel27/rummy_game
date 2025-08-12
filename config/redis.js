require("dotenv").config();
const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL
});
redisClient.connect().catch(console.error);

const GAME_PREFIX = "game:";
const USER_GAME_PREFIX = "user:game:";

module.exports = {
  getGame: async (roomId) => {
    const data = await redisClient.get(GAME_PREFIX + roomId);
    return data ? JSON.parse(data) : null;
  },

  setGame: async (roomId, game) => {
    await redisClient.set(GAME_PREFIX + roomId, JSON.stringify(game));
    console.log(`[Redis] Saving game ${roomId}:`, game);
  },

  delGame: async (roomId) => {
    await redisClient.del(GAME_PREFIX + roomId);
  },
  
  setUserGameState: async (userId, state) => {
    await redisClient.hSet(USER_GAME_PREFIX + userId, {
      currentGameStatus: String(state.currentGameStatus ?? ""),
      hasDropped: String(state.hasDropped ?? false),
      dropType:
        state.dropType === null || state.dropType === undefined
          ? ""
          : String(state.dropType),
      melds: JSON.stringify(state.melds || []),
      score: String(state.score ?? 0),
      dealScore: String(state.dealScore ?? 0),
    });
  },
  getUserGameState: async (userId) => {
    const data = await redisClient.hGetAll(USER_GAME_PREFIX + userId);
    if (!data || Object.keys(data).length === 0) return null;
    return {
      ...data,
      melds: JSON.parse(data.melds || "[]"),
      hasDropped: data.hasDropped === "true",
      score: Number(data.score),
      dealScore: Number(data.dealScore),
    };
  },
  delUserGameState: async (userId) => {
    await redisClient.del(USER_GAME_PREFIX + userId);
  },
};

// // async function test() {
// //     const result = await redisClient.get('user:2')
// //     console.log("result =====>>>>>>", result);
// // }

// // test()
