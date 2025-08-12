const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const {
  isValidMeld,
  hasPureSequence,
  countSequences,
  calculatePenaltyPoints,
  resetGameForNextRound,
  startTurnTimer,
  cleanupTimers,
  // TURN_DURATION_SECONDS,
  handlePlayerRemoval,
} = require("../utils/isValidMeld");

const {getGame,setGame,delGame,setUserGameState,delUserGameState,} = require("../../config/redis.js");

const { updateUser } = require("../userService");
const User = require("../../model/userModel");
const Game = require("../../model/gameModel");
const PlayerInGame = require("../../model/playerInGameModel");
const Transaction = require("../../model/transactionModel"); 


// const activeGames = {};
const MAX_PLAYERS = 4;
const ENTRY_FEE =100;
const disconnectedPlayers = new Map();
 
const isValidString = (param) =>
  typeof param === "string" && param.trim() !== "";
 
module.exports = (io, socket) => {

  const handleGameOver = async (roomId, winnerId, winnerName, game) => {
    try {
      const totalPrizePool = game.prizePool || 0;
      const winnerPrize = Math.floor(totalPrizePool * 0.9); // 90% to winner
  
      // 💰 Distribute prize to winner
      if (totalPrizePool > 0) {
        const winner = await User.findById(winnerId);
        if (winner) {
          const newBalance = winner.wallet + winnerPrize;
  
          const transaction = {
            type: "gameWin",
            amount: winnerPrize,
            balanceAfter: newBalance,
            status: "success",
            remarks: `Prize for winning game in room ${roomId}`,
            timestamp: new Date(),
          };
  
          await User.findByIdAndUpdate(winnerId, {
            wallet: newBalance,
            $push: { transactions: transaction }
          });
        }
      }
  
      // 🏆 Update winner stats
      await updateUser(winnerId, {
        $inc: { gamesWon: 1 },
        currentGameStatus: "finished",
      });
  
      // 🧮 Calculate penalty points for others
      for (const p of game.players) {
        if (p.userId === winnerId) {
          p.score = 0; // Winner has 0 penalty
        } else {
          // const points = calculatePenaltyPoints(p.hand, game.wildCard, p.melds);
          const points = calculatePenaltyPoints(p.originalHand || p.hand, game.wildCard, p.melds);

          p.score = points;
  
          await updateUser(p.userId, {
            currentGameStatus: "finished",
          });
        }
      }
  
      // 🏁 Mark game as finished
      game.winnerId = winnerId;
      game.winnerName = winnerName;
      game.prizeWon = winnerPrize;
      game.gameStatus = "finished";

      
  
      // 📤 Emit gameOver event
      io.to(roomId).emit("gameOver", {
        gameStatus: "ended",
        winnerId,
        winnerName,
        prizeWon: winnerPrize,
        message: `${winnerName} wins the game!`,
        scores: game.players.map((p) => {
          const isWinner = String(p.userId) === String(winnerId);
          return {
            playerId: p.userId,
            playerName: p.userName,
            score: isWinner ? 0 : calculatePenaltyPoints(p.originalHand || p.hand, game.wildCard, p.melds),
            prize: isWinner ? winnerPrize : 0 // ✅ set this here
          };
        })
        

        // scores: game.players.map((p) => ({
        //   playerId: p.userId,
        //   score: p.score,
        //   prize: p.userId === winnerId ? winnerPrize : 0, // Add prize per player
        //   playerName: p.userName 
        // })),
      });
  
      // 💾 Save final game state
      await saveGameToMongo(roomId, game);
  
      // 🧹 Cleanup
      await delGame(roomId);
      cleanupTimers(roomId);
  
    } catch (error) {
      console.error("Error in handleGameOver:", error);
    }
  };
  
  

  // const handleGameOver = async (roomId, winnerId, winnerName, game) => {
  //   try {
  //     const totalPrizePool = game.prizePool || 0;
  //     const winnerPrize = Math.floor(totalPrizePool * 0.9); // 90% to winner, 10% platform fee
  
  //     // Distribute prize to winner
  //     if (totalPrizePool > 0) {
  //       const winner = await User.findById(winnerId);
  //       if (winner) {
  //         const newBalance = winner.wallet + winnerPrize;
  
  //         const transaction = {
  //           type: "gameWin",
  //           amount: winnerPrize,
  //           balanceAfter: newBalance,
  //           status: "success",
  //           remarks: `Prize for winning game in room ${roomId}`,
  //           timestamp: new Date(),
  //         };
  
  //         await User.findByIdAndUpdate(winnerId, {
  //           wallet: newBalance,
  //           $push: { transactions: transaction }
  //         });
  //       }
  //     }
  
  //     // Update winner stats
  //     await updateUser(winnerId, {
  //       $inc: { gamesWon: 1 },
  //       currentGameStatus: "finished",
  //     });
  
  //     // Update all other players
  //     for (const p of game.players) {
  //       if (p.userId !== winnerId) {
  //         await updateUser(p.userId, {
  //           currentGameStatus: "finished",
  //         });
  //       }
  //     }
  
  //     // Mark game as finished
  //     game.winnerId = winnerId;
  //     game.winnerName = winnerName;
  //     game.prizeWon = winnerPrize;
  //     game.gameStatus = "finished";
  
  //     // Emit gameOver event
  //     io.to(roomId).emit("gameOver", {
  //       gameStatus: "ended",
  //       winnerId,
  //       winnerName,
  //       prizeWon: winnerPrize,
  //       message: `${winnerName} wins the game!`,
  //       scores: game.players.map((p) => ({
  //         playerId: p.userId,
  //         score: p.score,
  //       })),
  //     });
  
  //     // Save final game state
  //     await saveGameToMongo(roomId, game);
  
  //     // Cleanup
  //     await delGame(roomId);
  //     cleanupTimers(roomId);
  
  //   } catch (error) {
  //     console.error("Error in handleGameOver:", error);
  //   }
  // };//21
  




  // const handleGameOver = async (roomId, winnerId, winnerName, game) => {
  //   try {
  //     // Calculate prize distribution
  //     const totalPrizePool = game.prizePool || 0;
  //     const winnerPrize = Math.floor(totalPrizePool * 0.9); // 90% to winner, 10% platform fee
      
  //     // Distribute prize if there's a prize pool
  //     if (totalPrizePool > 0) {
  //       socket.emit("distributePrize", { 
  //         roomId, 
  //         winnerId, 
  //         winnerPrize 
  //       });
  //     }

  //     // Update winner stats
  //     await updateUser(winnerId, {
  //       $inc: { gamesWon: 1 },
  //       currentGameStatus: "finished",
  //     });

  //     // Update other players
  //     for (const p of game.players) {
  //       if (p.userId !== winnerId) {
  //         await updateUser(p.userId, {
  //           currentGameStatus: "finished",
  //         });
  //       }
  //     }

  //     game.winnerId = winnerId;
  //     game.winnerName = winnerName;
  //     game.prizeWon = winnerPrize;
  //     game.gameStatus = "finished";

  //     // Emit game over event
  //     io.to(roomId).emit("gameOver", {
  //       gameStatus: "ended",
  //       winnerId,
  //       message: `${winnerName} wins the game!`,
  //       prizeWon: winnerPrize,
  //       scores: game.players.map((p) => ({
  //         playerId: p.userId,
  //         score: p.score,
  //       })),
  //     });

  //     await saveGameToMongo(roomId, game);

  //     // Cleanup
  //     await delGame(roomId);
  //     cleanupTimers(roomId);
      
  //   } catch (error) {
  //     console.error("Error in handleGameOver:", error);
  //   }
  // };

  async function processWalletTransaction(userId, amount, type, remarks) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    const newBalance = user.wallet + amount;
    if (newBalance < 0) throw new Error('Insufficient balance');
  
    const transaction = {
      type,
      amount,
      balanceAfter: newBalance,
      status: "success",
      remarks,
      timestamp: new Date()
    };
  
    await User.findByIdAndUpdate(userId, {
      wallet: newBalance,
      $push: { transactions: transaction }
    });
  
    return newBalance;
  }

  // socket.on("joinRoom", async ({ roomId, gameType = "pool101", poolLimit = null }) => {
  //     try {
  //       const { _id: userId, name: userName } = socket.user;
  //       socket.userId = userId;
  //       socket.roomId = roomId;
  //       socket.join(roomId);

  //     // Get or create game from Redis
  //      let game = await getGame(roomId);
  //       if (!game) {
  //         game = {
  //           players: [],
  //           started: false,
  //           createdAt: new Date(),
  //           createdBy: userId.toString(),
  //           gameType,
  //           poolLimit,
  //           round: 1,
  //         };
  //       }

      

  //       // if (game.players.length > 0 && game.gameType !== gameType) {
  //       //   return socket.emit("turnError", {
  //       //     message: `You cannot join this room with game type '${gameType}'. This room is already set to '${game.gameType}'.`,
  //       //   });
  //       // }
  //       if (
  //         game.players.length > 0 &&
  //         !(
  //           (gameType === "point" && game.gameType === "point") ||
  //           (gameType.startsWith("pool") && game.gameType.startsWith("pool"))
  //         )
  //       ) {
  //         return socket.emit("turnError", {
  //           message: `You cannot join this room with game type '${gameType}'. This room is already set to '${game.gameType}'.`,
  //         });
  //       }
        
        

  //       if (game.players.find((p) => p.userId == userId)) {
  //         return socket.emit("turnError", {
  //           message: "User already joined the room.",
  //         });
  //       }

  //       if (game.players.length >= MAX_PLAYERS) {
  //         return socket.emit("turnError", { message: "Room is full." });
  //       }

  //       const player = { userId, userName, socketId: socket.id, score: 0 };
  //       game.players.push(player);

  //       await updateUser(userId, { currentGameStatus: "waiting" });

  //       //  Cache user in-game state in Redis
  //       await setUserGameState(userId, {
  //         currentGameStatus: "waiting",
  //         hasDropped: false,
  //         dropType: null,
  //         melds: [],
  //         score: 0,
  //         dealScore: 0,
  //       });

  //       //  Save updated game to Redis
  //       await setGame(roomId, game);

  //       // const payload = {
  //       //   players: game.players,
  //       //   message: `${userName} has joined the room.`,
  //       // };

  //       // io.to(roomId).emit("userJoined", payload);
  //       // io.to(roomId).emit("joinedRoom", { ...payload, roomId });

  //       const roomData = {
  //         roomId,
  //         players: game.players,
  //         gameType: game.gameType,
  //         poolLimit: game.poolLimit,
  //         round: game.round,
  //         started: game.started,
  //         createdAt: game.createdAt,
  //         createdBy: game.createdBy,
  //       };
    
  //       // ✅ 1. To joining player only:
  //       socket.emit("joinedRoom", { room: roomData });
    
  //       // ✅ 2. To everyone in the room (including creator):
  //       io.to(roomId).emit("roomUpdated", { room: roomData });

        
  //     } catch (err) {
  //       console.error("joinRoom error:", err);
  //       socket.emit("turnError", { message: "Unexpected error in joinRoom." });
  //     }
  //   }
  // );


 
  // socket.on("joinRoom", async ({ roomId, gameType = "pool101", poolLimit = null, entryFee = 0 }) => {
  //   try {
  //     const { _id: userId, name: userName } = socket.user;
      
  //     if (!userId || !userName) {
  //       return socket.emit("walletError", { message: "Unauthorized access." });
  //     }

  //     // Get user's current wallet balance
  //     const user = await User.findById(userId);
  //     if (!user) {
  //       return socket.emit("walletError", { message: "User not found." });
  //     }

  //     // Check if user has sufficient balance
  //     if (user.wallet < entryFee) {
  //       return socket.emit("walletError", { 
  //         message: `Insufficient balance. Required: ₹${entryFee}, Available: ₹${user.wallet}` 
  //       });
  //     }

  //     socket.userId = userId;
  //     socket.roomId = roomId;
  //     socket.join(roomId);

  //     // Get or create game from Redis
  //     let game = await getGame(roomId);
  //     if (!game) {
  //       game = {
  //         players: [],
  //         started: false,
  //         createdAt: new Date(),
  //         createdBy: userId.toString(),
  //         gameType,
  //         poolLimit,
  //         round: 1,
  //         entryFee,
  //         prizePool: 0,
  //       };
  //     }


  //     // Validate game type compatibility
  //     if (
  //       game.players.length > 0 &&
  //       !(
  //         (gameType === "point" && game.gameType === "point") ||
  //         (gameType.startsWith("pool") && game.gameType.startsWith("pool"))
  //       )
  //     ) {
  //       return socket.emit("walletError", {
  //         message: `You cannot join this room with game type '${gameType}'. This room is already set to '${game.gameType}'.`,
  //       });
  //     }

  //     // Check if user already joined
  //     if (game.players.find((p) => p.userId == userId)) {
  //       return socket.emit("walletError", {
  //         message: "User already joined the room.",
  //       });
  //     }

  //     // Check room capacity
  //     if (game.players.length >= 4) {
  //       return socket.emit("walletError", { message: "Room is full." });
  //     }

  //     // Deduct entry fee from wallet
  //     const newBalance = user.wallet - entryFee;
      
  //     // Create transaction record
  //     const transaction = {
  //       type: "gameLoss",
  //       amount: -entryFee,
  //       balanceAfter: newBalance,
  //       status: "success",
  //       remarks: `Entry fee for room ${roomId}`,
  //     };

  //     // Update user wallet and add transaction
  //     await User.findByIdAndUpdate(userId, {
  //       wallet: newBalance,
  //       currentGameStatus: "waiting",
  //       $push: { transactions: transaction }
  //     });

  //     // Add player to game
  //     const player = { 
  //       userId, 
  //       userName, 
  //       socketId: socket.id, 
  //       score: 0,
  //       entryFeePaid: entryFee 
  //     };
  //     game.players.push(player);
  //     game.prizePool += entryFee;

  //     // Save user game state
  //     await setUserGameState(userId, {
  //       currentGameStatus: "waiting",
  //       hasDropped: false,
  //       dropType: null,
  //       melds: [],
  //       score: 0,
  //       dealScore: 0,
  //       entryFeePaid: entryFee,
  //     });

  //     // Save updated game to Redis
  //     await setGame(roomId, game);

  //     const roomData = {
  //       roomId,
  //       players: game.players,
  //       gameType: game.gameType,
  //       poolLimit: game.poolLimit,
  //       round: game.round,
  //       started: game.started,
  //       createdAt: game.createdAt,
  //       createdBy: game.createdBy,
  //       entryFee: game.entryFee,
  //       prizePool: game.prizePool,
  //     };

  //     // Emit to joining player
  //     socket.emit("joinedPaidRoom", { 
  //       room: roomData, 
  //       walletBalance: newBalance,
  //       message: `₹${entryFee} deducted from wallet. New balance: ₹${newBalance}`
  //     });

  //     // Emit to all players in room
  //     io.to(roomId).emit("roomUpdated", { room: roomData });

  //     console.log(`Player ${userName} joined paid room ${roomId} with entry fee ₹${entryFee}`);

  //   } catch (error) {
  //     console.error("joinPaidRoom error:", error);
  //     socket.emit("walletError", { message: "Failed to join paid room." });
  //   }
  // }); //--->WITHOUT
  
  socket.on("joinRoom", async ({ roomId, gameType = "pool101" }) => {
    try {
      const { _id: userId, name: userName } = socket.user;
      if (!userId || !userName) return socket.emit("walletError", { message: "Unauthorized access." });
  
      let game = await getGame(roomId) || {
        players: [],
        started: false,
        createdAt: new Date(),
        createdBy: userId.toString(),
        gameType,
        poolLimit: gameType.startsWith("pool") ? parseInt(gameType.replace("pool", "")) : null,
        round: 1,
        entryFee: ENTRY_FEE,
        prizePool: 0,
      };
  
      if (game.players.find(p => p.userId === userId)) {
        return socket.emit("walletError", { message: "User already joined the room." });
      }
  
      if (game.players.length >= MAX_PLAYERS) {
        return socket.emit("walletError", { message: "Room is full." });
      }
  
      if (
        game.players.length > 0 &&
        !(
          (gameType === "point" && game.gameType === "point") ||
          (gameType.startsWith("pool") && game.gameType.startsWith("pool"))
        )
      ) {
        return socket.emit("walletError", {
          message: `Cannot join ${game.gameType} room with ${gameType}`
        });
      }
  
      const newBalance = await processWalletTransaction(
        userId,
        -ENTRY_FEE,
        "gameEntryFee",
        `Entry fee for ${gameType} room ${roomId}`
      );
  
      const player = {
        userId,
        userName,
        socketId: socket.id,
        score: 0,
        entryFeePaid: ENTRY_FEE
      };
  
      game.players.push(player);
      game.prizePool += ENTRY_FEE;
  
      await setUserGameState(userId, {
        currentGameStatus: "waiting",
        hasDropped: false,
        dropType: null,
        melds: [],
        score: 0,
        dealScore: 0,
        entryFeePaid: ENTRY_FEE
      });
  
      await setGame(roomId, game);
      socket.join(roomId);
  
      const roomData = {
        roomId,
        players: game.players,
        gameType: game.gameType,
        poolLimit: game.poolLimit,
        round: game.round,
        entryFee: game.entryFee,
        prizePool: game.prizePool,
        started: game.started,
        createdAt: game.createdAt,
        createdBy: game.createdBy,
      };
  
      socket.emit("joinedPaidRoom", {
        room: roomData,
        walletBalance: newBalance,
        message: `₹${ENTRY_FEE} deducted. New balance: ₹${newBalance}`
      });
  
      io.to(roomId).emit("roomUpdated", { room: roomData });
      console.log(`Player ${userName} joined room ${roomId}`);
  
    } catch (error) {
      console.error("joinRoom error:", error);
      const message = error.message.includes("balance")
        ? `Insufficient balance. Need ₹${ENTRY_FEE} to join.`
        : "Failed to join room";
      socket.emit("walletError", { message });
    }
  });


  socket.on("startGame", async ({ roomId }) => {
    try {
      if (!isValidString(roomId)) {
        socket.emit("error", { message: "Invalid room ID." });
        return;
      }

      // if (!activeGames[roomId]) {
      //   socket.emit("turnError", { message: "Room not found." });
      //   return;
      // }

      // const game = activeGames[roomId];

      // redis set-up
      //  Get game from Redis

      let game = await getGame(roomId);
      if (!game) {
        socket.emit("turnError", { message: "Room not found." });
        return;
      }

      if (game.started) {
        socket.emit("turnError", { message: "Game has already started." });
        return;
      }

      if (game.players.length < 2) {
        socket.emit("turnError", {
          message: "At least 2 players are required to start the game.",
        });
        return;
      }

      game.started = true;

      if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
        game.poolLimit = game.gameType === "pool61"
        ? 61
        : game.gameType === "pool101"
        ? 101
        : 201;
      }

      let numPlayers = game.players.length;
      let numDecks = numPlayers <= 6 ? 2 : 3;

      // let deck = createDeck(numDecks);
      // deck = shuffleDeck(deck);
      let rawDeck = shuffleDeck(createDeck(numDecks));
let deck = rawDeck.map((value, index) => ({
  id: `card-${index}`, // unique per card
  value,               // e.g., "H10"
}));
      game.deck = deck;

      console.log(`Number of Players: ${numPlayers}`);
      console.log(`Number of Decks Used: ${numDecks}`);
      console.log(`Total Number of Cards After Shuffling: ${deck.length}`);

      let cardsPerPlayer = 13;

      if (game.deck.length < game.players.length * cardsPerPlayer + 5) {
        socket.emit("turnError", {
          message: "Not enough cards in deck to start the game.",
        });
        return;
      }

      const wildCard = game.deck.pop();
      game.wildCard = wildCard;

      do {
        game.discardPile = [game.deck.pop()];
      } while (game.discardPile[0] === "JOKER");

      game.currentPlayerIndex = 0;

      for (const player of game.players) {
        await updateUser(player.userId, {
          $inc: { gamesPlayed: 1 },
          currentGameStatus: "playing",
          score: player.score || 0,
          melds: [],
        });

        await setUserGameState(player.userId, {
          currentGameStatus: "playing",
          hasDropped: false,
          dropType: null,
          melds: [],
          score: player.score || 0,
          dealScore: 0,
        });
      }

      game.players.forEach((player) => {
        player.hand = game.deck.splice(0, cardsPerPlayer);
        player.melds = [];
        io.to(player.socketId).emit("playerHand", { hand: player.hand });
      });

      //  Save updated game to Redis
      await setGame(roomId, game);
      await saveGameToMongo(roomId, game);

      io.to(roomId).emit("gameStarted", {
        message: "Game has started",
        gameType: game.gameType,
        poolLimit: game.poolLimit || null,
        players: game.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          handSize: cardsPerPlayer,
          score: p.score,
        })),
        discardPile: game.discardPile,
        currentPlayerIndex: game.currentPlayerIndex,
        wildCard: game.wildCard,
      });

      console.log(`Game successfully started in room: ${roomId}`);

      //without redis add startTurnTimer(io, roomId, activeGames);
      startTurnTimer(io, roomId);
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("turnError", { message: "An unexpected error occurred" });
    }
  });

  socket.on("drawCard", async ({ drawFrom }) => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );

      /* if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }
      const game = activeGames[roomId]; */

      console.log("drawCard called by user:", socket.user?._id);
      console.log("Rooms of socket:", Array.from(socket.rooms));
      console.log("RoomId used:", roomId);

      // Get game from Redis
      let game = await getGame(roomId);
      console.log(
        "Game players from Redis:",
        game?.players?.map((p) => p.userId)
      );

      if (!roomId || !game) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }

      const userId = socket.user._id;
      // without redis
      // const player = game.players.find((p) => p.userId === userId);

      const player = game.players.find(
        (p) => String(p.userId) === String(userId)
      );
      console.log("Found player:", player);

      if (!player) {
        return socket.emit("turnError", { message: "Player not found." });
      }

      /* if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      } */

      if (
        String(game.players[game.currentPlayerIndex].userId) !== String(userId)
      ) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      player.socketId = socket.id;

      if (player.drawn) {
        return socket.emit("AlreadyDrawnCard", {
          message: "You've already drawn a card this turn.",
        });
      }

      if (game.deck.length === 0 && game.discardPile.length > 1) {
        const reshufflePile = game.discardPile.slice(0, -1);
        game.deck = shuffleDeck(reshufflePile);
        // game.discardPile = [game.discardPile.at(-1)];
        // io.to(roomId).emit("deckReshuffled");

        game.discardPile = [game.discardPile[game.discardPile.length - 1]];

        io.to(roomId).emit("deckReshuffled", {
          message: "The discard pile has been reshuffled into the deck.",
        });
      }

      let drawnCard;
      if (drawFrom === "deck") {
        if (!game.deck.length)
          return socket.emit("error", { message: "Deck is empty" });
        drawnCard = game.deck.shift();
      } else if (drawFrom === "discard") {
        if (!game.discardPile.length)
          return socket.emit("error", { message: "Discard pile is empty" });
        drawnCard = game.discardPile.shift();
      } else {
        return socket.emit("turnError", { message: "Invalid draw source" });
      }

      player.drawn = true;
      player.hand.push(drawnCard);

      /*  io.to(player.socketId).emit("cardDrawn", {
        drawnCard,
        hand: player.hand,
        deckSize: game.deck.length,
      }); */

      // redis
      io.to(socket.id).emit("cardDrawn", {
        drawnCard,
        hand: player.hand,
        deckSize: game.deck.length,
      });

      if (drawFrom === "discard") {
        io.to(roomId).emit("updateDiscardPile", game.discardPile);
      }

      // Save updated game to Redis
      await setGame(roomId, game);

      await setUserGameState(userId, {
        currentGameStatus: "playing",
        hasDropped: player.hasDropped || false,
        dropType: player.dropType || null,
        melds: player.melds || [],
        score: player.score || 0,
        dealScore: player.dealScore || 0,
      });

      await User.findByIdAndUpdate(
        userId,
        { score: player.score },
        { new: true }
      );
    } catch (turnError) {
      console.error("Draw card error:", turnError);
      socket.emit("turnError", { message: "Failed to draw card" });
    }
  });

  socket.on("discardCard", async ({ card }) => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }
      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );

      /* if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }

      const game = activeGames[roomId]; */

      if (!roomId) {
        return socket.emit("turnError", {
          message: "You're not in a valid room.",
        });
      }

      const game = await getGame(roomId);
      if (!game) {
        return socket.emit("turnError", {
          message: "Game not found.",
        });
      }

      const userId = socket.user._id;

      // without redis
      // const player = game.players.find((p) => p.userId === userId);

      const player = game.players.find(
        (p) => String(p.userId) === String(userId)
      );

      if (!player) {
        return socket.emit("turnError", { message: "Player data not found." });
      }

      if (!player.drawn) {
        return socket.emit("turnError", {
          message: "You must draw a card before discarding.",
        });
      }

      if (player.discarded) {
        return socket.emit("turnError", {
          message: "Already discarded this turn.",
        });
      }

      // if (game.players[game.currentPlayerIndex].userId !== userId) {
      //   return socket.emit("turnError", { message: "It's not your turn." });
      // }

      if (
        String(game.players[game.currentPlayerIndex].userId) !== String(userId)
      ) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      // const cardIndex = player.hand.findIndex((c) => c.trim() === card.trim());
      const cardValue = typeof card === "string" ? card : card?.value;

const cardIndex = player.hand.findIndex((c) => {
  const cVal = typeof c === "string" ? c : c?.value;
  return cVal === cardValue;
});

if (!cardValue) {
  return socket.emit("turnError", { message: "Invalid card format." });
}

      if (cardIndex === -1) {
        return socket.emit("turnError", { message: "Card not found in hand." });
      }

      const discardedCard = player.hand.splice(cardIndex, 1)[0];
      game.discardPile.unshift(discardedCard);
      player.discarded = true;

      io.to(roomId).emit("updateDiscardPile", game.discardPile);
      io.to(player.socketId).emit("updateHand", player.hand);

      console.log("📦 Player hand from backend:", player.hand);
console.log("🔢 Player hand length:", player.hand.length);

// console.log("💡 Number of melds received from client:", melds.length);

      // if (player.hand.length === 0) {
      //   console.log("🏁 Empty hand detected - checking win conditions");
      //   console.log("Player melds:", JSON.stringify(player.melds, null, 2));
      //   console.log("Wild card:", game.wildCard);
        
      //   const hasPure = hasPureSequence(player.melds, game.wildCard);
      //   const totalSequences = countSequences(player.melds, game.wildCard);
      
      //   console.log("Win condition results:", {
      //     hasPure,
      //     totalSequences,
      //     required: { minPure: 1, minTotal: 2 }
      //   });
      //   if(hasPure && totalSequences >= 2) {
      //     player.score += 0;

      //     for (const p of game.players) {
      //       if (p.userId !== userId) {
      //         p.score += Math.min(
      //           calculatePenaltyPoints(p.hand, game.wildCard, p.melds || []),
      //           80
      //         );
      //       }
      //     }

      //     for (const p of game.players) {
      //       await updateUser(p.userId, {
      //         score: p.score,
      //         currentGameStatus: "playing",
      //       });
      //     }

      //     if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
      //       const poolLimit = game.poolLimit;
      //       const eliminatedPlayers = game.players.filter(
      //         (p) => p.score >= poolLimit
      //       );

      //       // Remove eliminated players
      //       game.players = game.players.filter((p) => p.score < poolLimit);

      //       // Notify about eliminations
      //       if (eliminatedPlayers.length > 0) {
      //         io.to(roomId).emit("playerEliminated", {
      //           eliminated: eliminatedPlayers.map((p) => ({
      //             playerId: p.userId,
      //             userName: p.userName,
      //           })),
      //           message: `${eliminatedPlayers
      //             .map((p) => p.userName)
      //             .join(", ")} eliminated for exceeding pool limit.`,
      //         });

      //         // Update database for eliminated players
      //         for (const p of eliminatedPlayers) {
      //           await updateUser(p.userId, {
      //             currentGameStatus: "finished",
      //           });
      //         }
      //       }

      //       // Check if only one player remains
      //       if (game.players.length === 1) {
      //         const winner = game.players[0];
      //         await updateUser(winner.userId, {
      //           $inc: { gamesWon: 1 },
      //           currentGameStatus: "finished",
      //         });

      //         io.to(roomId).emit("gameOver", {
      //           gameStatus: "ended",
      //           winnerId: winner.userId,
      //           message: `${winner.userName} wins the Pool Rummy game!`,
      //           scores: game.players.concat(eliminatedPlayers).map((p) => ({
      //             playerId: p.userId,
      //             score: p.score,
      //           })),
      //         });

      //         // delete activeGames[roomId];
      //         await delGame(roomId);
      //         return;
      //       }

      //       // Start next round
      //       game.round += 1;
      //       resetGameForNextRound(game, io, roomId);
      //       return;
      //     }

      //     // Point Rummy logic
      //     await updateUser(userId, {
      //       $inc: { gamesWon: 1 },
      //       currentGameStatus: "finished",
      //     });

      //     for (const p of game.players) {
      //       if (p.userId !== userId) {
      //         await updateUser(p.userId, {
      //           currentGameStatus: "finished",
      //         });
      //       }
      //     }

      //     io.to(roomId).emit("gameOver", {
      //       gameStatus: "ended",
      //       winnerId: userId,
      //       message: `${player.userName} wins the game!`,
      //       scores: game.players.map((p) => ({
      //         playerId: p.userId,
      //         score: p.score,
      //       })),
      //     });

      //     // delete activeGames[roomId];
      //     await delGame(roomId);
      //     return;
      //   } else {
      //     const wrongPenalty = Math.min(
      //       calculatePenaltyPoints(
      //         player.hand.concat(player.melds.flat()),
      //         game.wildCard,
      //         []
      //       ),
      //       80
      //     );

      //     player.score += wrongPenalty;

      //     await updateUser(player.userId, {
      //       score: player.score,
      //       currentGameStatus: "playing",
      //     });

      //     io.to(roomId).emit("wrongDeclaration", {
      //       playerId: userId,
      //       penaltyPoints: wrongPenalty,
      //     });
      //   }
      // }

      if (player.hand.length === 0) {  // updated
        console.log("🏁 Empty hand detected - checking win conditions");
        console.log("Player melds:", JSON.stringify(player.melds, null, 2));
        console.log("Wild card:", game.wildCard);
        
        const hasPure = hasPureSequence(player.melds, game.wildCard);
        const totalSequences = countSequences(player.melds, game.wildCard);
      
        console.log("Win condition results:", {
          hasPure,
          totalSequences,
          required: { minPure: 1, minTotal: 2 }
        });
        
        if(hasPure && totalSequences >= 2) {
          player.score += 0;

          for (const p of game.players) {
            if (p.userId !== userId) {
              p.score += Math.min(
                calculatePenaltyPoints(p.hand, game.wildCard, p.melds || []),
                80
              );
            }
          }

          // Pool game logic
          if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
            const poolLimit = game.poolLimit;
            const eliminatedPlayers = game.players.filter(
              (p) => p.score >= poolLimit
            );

            game.players = game.players.filter((p) => p.score < poolLimit);

            if (eliminatedPlayers.length > 0) {
              io.to(roomId).emit("playerEliminated", {
                eliminated: eliminatedPlayers.map((p) => ({
                  playerId: p.userId,
                  userName: p.userName,
                })),
                message: `${eliminatedPlayers
                  .map((p) => p.userName)
                  .join(", ")} eliminated for exceeding pool limit.`,
              });

              for (const p of eliminatedPlayers) {
                await updateUser(p.userId, {
                  currentGameStatus: "finished",
                });
              }
            }

            if (game.players.length === 1) {
              await handleGameOver(roomId, game.players[0].userId, game.players[0].userName, game);
              return;
            }

            game.round += 1;
            resetGameForNextRound(game, io, roomId);
            return;
          }

          // Point Rummy - direct win
          await handleGameOver(roomId, userId, player.userName, game);
          return;
        } else {
          // Wrong declaration penalty
          const wrongPenalty = Math.min(
            calculatePenaltyPoints(
              player.hand.concat(player.melds.flat()),
              game.wildCard,
              []
            ),
            80
          );

          player.score += wrongPenalty;

          await updateUser(player.userId, {
            score: player.score,
            currentGameStatus: "playing",
          });

          io.to(roomId).emit("wrongDeclaration", {
            playerId: userId,
            penaltyPoints: wrongPenalty,
          });
        }
      }
      

      // without the redis=>  if (activeGames[roomId]) {
      if (game) {
        game.currentPlayerIndex =
          (game.currentPlayerIndex + 1) % game.players.length;
        const nextPlayer = game.players[game.currentPlayerIndex];
        nextPlayer.drawn = false;
        nextPlayer.discarded = false;

        // Save updated game state to Redis
        await setGame(roomId, game);

        io.to(roomId).emit("turnEnded", {
          message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
          currentPlayerId: nextPlayer.userId,
        });

        io.to(nextPlayer.socketId).emit("yourTurn", {
          message: `It's your turn, ${nextPlayer.userName}`,
        });
        
        cleanupTimers(roomId);
        startTurnTimer(io, roomId); 
      }

      console.log("Discarded:", card, "by", player.userName);
    } catch (error) {
      console.error("Discard card error:", error);
      socket.emit("turnError", {message: error.message || "Failed to discard card"});
    }
  });

  socket.on("layDownMelds", async ({ melds }) => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );
      let game = await getGame(roomId);

      // const roomId = Array.from(socket.rooms).find(
      //   (room) => room !== socket.id
      // );

      /* 
      if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      } */

      // const game = activeGames[roomId];

      if (!roomId || !game) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }

      const userId = socket.user._id;
      // const player = game.players.find((p) => p.userId === userId);
      const player = game.players.find(
        (p) => String(p.userId) === String(userId)
      );
      if (!player) {
        return socket.emit("turnError", { message: "Player not found." });
      }

      /* if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      } */

      if (
        String(game.players[game.currentPlayerIndex].userId) !== String(userId)
      ) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      if (!Array.isArray(melds) || melds.length === 0) {
        return socket.emit("turnError", { message: "Invalid melds format." });
      }

      // const remainingCards = [...player.hand];
      // const allMeldCards = melds.flat();

      // for (const meldCard of allMeldCards) {
      //   const cardIndex = remainingCards.findIndex(
      //     (handCard) => handCard?.value?.trim() === meldCard?.trim()
      //   );

        console.log("🧩 Received melds from client:", JSON.stringify(melds, null, 2));
console.log("🧩 Player hand:", JSON.stringify(player.hand, null, 2));

const remainingCards = [...player.hand];
const allMeldCards = melds.flat();

for (const meldCard of allMeldCards) {
  const cardValue = typeof meldCard === "string" ? meldCard : meldCard?.value;
  const cardIndex = remainingCards.findIndex(
    (handCard) => handCard?.value?.trim() === cardValue?.trim()
  );


        if (cardIndex === -1) {
          return socket.emit("turnError", {
            message: `Card ${meldCard} not found in your hand.`,
          });
        }
        remainingCards.splice(cardIndex, 1);
      }

      for (const meld of melds) {
        if (!isValidMeld(meld, game.wildCard)) {
          return socket.emit("turnError", {
            message: "Invalid meld detected.",
          });
        }
      }

      player.melds.push(...melds);
      player.hand = remainingCards;

      //  Save updated game to Redis
      await setGame(roomId, game);

      await setUserGameState(userId, {
        currentGameStatus: "playing",
        hasDropped: player.hasDropped || false,
        dropType: player.dropType || null,
        melds: player.melds || [],
        score: player.score || 0,
        dealScore: player.dealScore || 0,
      });

      // Update database with melds
      await updateUser(userId, { melds: player.melds });

      // if (player.hand.length === 0) {
      //   console.log("🏁 Empty hand detected - checking win conditions");
      //   console.log("Player melds:", JSON.stringify(player.melds, null, 2));
      //   console.log("Wild card:", game.wildCard);
        
      //   const hasPure = hasPureSequence(player.melds, game.wildCard);
      //   const totalSequences = countSequences(player.melds, game.wildCard);
      
      //   console.log("Win condition results:", {
      //     hasPure,
      //     totalSequences,
      //     required: { minPure: 1, minTotal: 2 }
      //   });

      //   if (!hasPure || totalSequences < 2) {
      //     const wrongPenalty = Math.min(
      //       calculatePenaltyPoints(
      //         player.hand.concat(player.melds.flat()),
      //         game.wildCard,
      //         []
      //       ),
      //       80
      //     );

      //     console.log("📌 Final check:", {
      //       handLength: player.hand.length,
      //       hasPure: hasPure,
      //       totalSequences: totalSequences,
      //       melds: player.melds,
      //     });

      //     player.score += wrongPenalty;

      //     await updateUser(player.userId, {
      //       score: player.score,
      //       currentGameStatus: "playing",
      //     });

      //     io.to(roomId).emit("wrongDeclaration", {
      //       playerId: userId,
      //       penaltyPoints: wrongPenalty,
      //     });

      //     // game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      //     // const nextPlayer = game.players[game.currentPlayerIndex];
      //     // nextPlayer.drawn = false;
      //     // nextPlayer.discarded = false;

      //     // io.to(roomId).emit("turnEnded", {
      //     //   message: `Wrong declaration by ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
      //     //   currentPlayerId: nextPlayer.userId,
      //     // });

      //     // io.to(nextPlayer.socketId).emit("yourTurn", {
      //     //   message: `It's your turn, ${nextPlayer.userName}`,
      //     // });
      //     // return;
      //   }

      
        

      //   // Valid show
      //   player.score += 0;

      //   for (const p of game.players) {
      //     if (p.userId !== userId) {
      //       p.score += Math.min(
      //         calculatePenaltyPoints(p.hand, game.wildCard, p.melds || []),
      //         80
      //       );
      //     }
      //   }

      //   for (const p of game.players) {
      //     await updateUser(p.userId, {
      //       score: p.score,
      //       currentGameStatus: "playing",
      //     });
      //   }

      //   if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
      //     const poolLimit = game.poolLimit;
      //     const eliminatedPlayers = game.players.filter(
      //       (p) => p.score >= poolLimit
      //     );

      //     game.players = game.players.filter((p) => p.score < poolLimit);

      //     if (eliminatedPlayers.length > 0) {
      //       io.to(roomId).emit("playerEliminated", {
      //         eliminated: eliminatedPlayers.map((p) => ({
      //           playerId: p.userId,
      //           userName: p.userName,
      //         })),
      //         message: `${eliminatedPlayers
      //           .map((p) => p.userName)
      //           .join(", ")} eliminated for exceeding pool limit.`,
      //       });

      //       for (const p of eliminatedPlayers) {
      //         await updateUser(p.userId, {
      //           currentGameStatus: "finished",
      //         });
      //       }
      //     }

      //     if (game.players.length === 1) {
      //       const winner = game.players[0];
      //       await updateUser(winner.userId, {
      //         $inc: { gamesWon: 1 },
      //         currentGameStatus: "finished",
      //       });

      //       io.to(roomId).emit("gameOver", {
      //         gameStatus: "ended",
      //         winnerId: winner.userId,
      //         message: `${winner.userName} wins the Pool Rummy game!`,
      //         scores: game.players.concat(eliminatedPlayers).map((p) => ({
      //           playerId: p.userId,
      //           score: p.score,
      //         })),
      //       });

      //       // delete activeGames[roomId];
      //       await delGame(roomId);
      //       cleanupTimers(roomId, activeGames);
      //       return;
      //     }

      //     game.round += 1;
      //     resetGameForNextRound(game, io, roomId);
      //     return;
      //   }

      //   await updateUser(userId, {
      //     $inc: { gamesWon: 1 },
      //     currentGameStatus: "finished",
      //   });

      //   for (const p of game.players) {
      //     if (p.userId !== userId) {
      //       await updateUser(p.userId, {
      //         currentGameStatus: "finished",
      //       });
      //     }
      //   }

      //   // io.to(roomId).emit("gameOver", {
      //   //   gameStatus: "ended",
      //   //   winnerId: userId,
      //   //   message: data.message,
      //   //   scores: game.players.map((p) => ({
      //   //     playerId: p.userId,
      //   //     score: p.score,
      //   //   })),
      //   // });

      //   io.to(roomId).emit("gameOver", {
      //     gameStatus: "ended",
      //     winnerId: userId,
      //     message: `${player.userName} wins the game!`,  // Fixed this line
      //     scores: game.players.map((p) => ({
      //       playerId: p.userId,
      //       score: p.score,
      //     })),
      //   });

      //   // delete activeGames[roomId];

      //   await delGame(roomId);
      //   cleanupTimers(roomId, activeGames);
      //   return;
      // }


      //updated one 
      if (player.hand.length === 0) {
        console.log("🏁 Empty hand detected - checking win conditions");
        console.log("Player melds:", JSON.stringify(player.melds, null, 2));
        console.log("Wild card:", game.wildCard);
        
        const hasPure = hasPureSequence(player.melds, game.wildCard);
        const totalSequences = countSequences(player.melds, game.wildCard);
      
        console.log("Win condition results:", {
          hasPure,
          totalSequences,
          required: { minPure: 1, minTotal: 2 }
        });

        if (!hasPure || totalSequences < 2) {
          const wrongPenalty = Math.min(
            calculatePenaltyPoints(
              player.hand.concat(player.melds.flat()),
              game.wildCard,
              []
            ),
            80
          );

          player.score += wrongPenalty;

          await updateUser(player.userId, {
            score: player.score,
            currentGameStatus: "playing",
          });

          io.to(roomId).emit("wrongDeclaration", {
            playerId: userId,
            penaltyPoints: wrongPenalty,
          });
          return;
        }

        // Valid show - calculate scores and distribute prizes
        player.score += 0;

        for (const p of game.players) {
          if (p.userId !== userId) {
            p.score += Math.min(
              calculatePenaltyPoints(p.hand, game.wildCard, p.melds || []),
              80
            );
          }
        }

        if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
          const poolLimit = game.poolLimit;
          const eliminatedPlayers = game.players.filter(
            (p) => p.score >= poolLimit
          );

          game.players = game.players.filter((p) => p.score < poolLimit);

          if (eliminatedPlayers.length > 0) {
            io.to(roomId).emit("playerEliminated", {
              eliminated: eliminatedPlayers.map((p) => ({
                playerId: p.userId,
                userName: p.userName,
              })),
              message: `${eliminatedPlayers
                .map((p) => p.userName)
                .join(", ")} eliminated for exceeding pool limit.`,
            });

            for (const p of eliminatedPlayers) {
              await updateUser(p.userId, {
                currentGameStatus: "finished",
              });
            }
          }

          if (game.players.length === 1) {
            await handleGameOver(roomId, game.players[0].userId, game.players[0].userName, game);
            return;
          }

          game.round += 1;
          resetGameForNextRound(game, io, roomId);
          return;
        }

        // Point Rummy - direct win
        await handleGameOver(roomId, userId, player.userName, game);
        return;
      }




      io.to(roomId).emit("meldsLaidDown", {
        playerId: userId,
        melds: player.melds,
        
      });

      // End turn
      // game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      // const nextPlayer = game.players[game.currentPlayerIndex];
      // nextPlayer.drawn = false;
      // nextPlayer.discarded = false;

      // io.to(roomId).emit("turnEnded", {
      //   message: `Melds laid down by ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
      //   currentPlayerId: nextPlayer.userId,
      // });

      // io.to(nextPlayer.socketId).emit("yourTurn", {
      //   message: `It's your turn, ${nextPlayer.userName}`,
      // });
    } catch (error) {
      console.error("Error in layDownMelds event:", error);
      socket.emit("turnError", { message: "An unexpected error occurred." });
    }
  });

  socket.on("dropGame", async () => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

      /* const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      ); */

      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );
      let game = await getGame(roomId);

      if (!roomId || !game) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }

      //  without redis

      /*    if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }
      const game = activeGames[roomId]; */

      const userId = socket.user._id;

      // without redis
      // const playerIndex = game.players.findIndex((p) => p.userId === userId);

      const playerIndex = game.players.findIndex(
        (p) => String(p.userId) === String(userId)
      );

      if (playerIndex === -1) {
        return socket.emit("turnError", {
          message: "Player not found in the game.",
        });
      }

      const player = game.players[playerIndex];

      const penalty = player.drawn ? 40 : 20;
      player.score = penalty;

      await User.findByIdAndUpdate(
        userId,
        {
          $set: { score: penalty },
          currentGameStatus: "finished",
        },
        { new: true }
      );

      // redis
      await setUserGameState(userId, {
        currentGameStatus: "finished",
        hasDropped: true,
        dropType: "drop",
        melds: player.melds || [],
        score: player.score || penalty,
        dealScore: player.dealScore || 0,
      });

      io.to(roomId).emit("playerDropped", {
        message: `${player.userName} has dropped from the game.`,
        playerId: player.userId,
        penalty,
        scores: [
          ...game.players.map((p) => ({
            // playerId: p.userId,
            score: p.score,
            status: "active",
          })),

          {
            playerId: player.userId,
            score: player.score,
            status: "dropped",
          },
        ],
      });

      console.log(`Player ${player.userName} dropped from game ${roomId}`);

      // Remove player from active game
      game.players.splice(playerIndex, 1);

      //  updated game to Redis
      await setGame(roomId, game);

      if (game.players.length === 1) {
        const winner = game.players[0];

        io.to(roomId).emit("gameOver", {
          message: `🎉 ${winner.userName} wins! All other players have dropped.`,
          winnerId: winner.userId,
          scores: [
            ...game.players.map((p) => ({
              playerId: p.userId,
              score: p.score,
            })),
            {
              playerId: player.userId,
              score: player.score,
            },
          ],
        });

        // delete activeGames[roomId];
        // cleanupTimers(roomId, activeGames);

        await delGame(roomId);
        // redis
        cleanupTimers(roomId);
        // await setGame(roomId, game);
        return;
      }

      if (game.players.length === 0) {
        // delete activeGames[roomId];
        await delGame(roomId);

        cleanupTimers(roomId);

        // Save updated game to Redis
        await setGame(roomId, game);
        return;
      }

      // If the dropped player was the current player, pass turn
      if (game.currentPlayerIndex >= game.players.length) {
        game.currentPlayerIndex = 0;
      }
      if (playerIndex < game.currentPlayerIndex) {
        game.currentPlayerIndex--;
      }

      // If the dropped player was the current player, move turn and start timer
      if (game.players.length > 0 && game.players[game.currentPlayerIndex]) {
        const nextPlayer = game.players[game.currentPlayerIndex];
        nextPlayer.drawn = false;
        nextPlayer.discarded = false;

        io.to(roomId).emit("turnEnded", {
          message: `Turn passed due to drop. Now it's ${nextPlayer.userName}'s turn`,
          currentPlayerId: nextPlayer.userId,
        });

        io.to(nextPlayer.socketId).emit("yourTurn", {
          message: `It's your turn, ${nextPlayer.userName}`,
        });

        startTurnTimer(io, roomId, activeGames);
      }

      io.to(roomId).emit("gameContinues", {
        message: "The game continues with the remaining players.",
        remainingPlayers: game.players.map((p) => ({
          playerId: p.userId,
          userName: p.userName,
          score: p.score,
        })),
      });
    } catch (error) {
      console.error("Error in dropGame event:", error);
      socket.emit("turnError", { message: "An unexpected error occurred." });
    }
  });
  
  socket.on("leaveRoom", async () => {
  const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
  for (const roomId of rooms) {
    let game = await getGame(roomId);
    if (!game) continue;

    const playerIndex = game.players.findIndex(
      (p) => p.socketId === socket.id
    );

    if (playerIndex !== -1) {
      const leavingPlayer = game.players[playerIndex];
      game.players.splice(playerIndex, 1);

      // if (game.players.length === 1) {
      //   const winner = game.players[0];
      //   io.to(winner.socketId).emit("gameOver", {
      //     message: `🎉 You win ${leavingPlayer.userName} left the game.`,
      //     winnerId: winner.userId,
      //   });
      //   await delGame(roomId);
      //   cleanupTimers(roomId);
      // } 
      if (game.players.length === 1) {
        const winner = game.players[0];
      
        // Prevent double execution using a game.status flag or Redis lock
        if (!game.status || game.status !== "ended") {
          game.status = "ended";
          await handleGameOver(roomId, winner.userId, winner.userName, game);
        }
      }
      else if (game.players.length === 0) {
        await delGame(roomId);
        cleanupTimers(roomId);
      } else {
        if (game.currentPlayerIndex >= game.players.length){
          game.currentPlayerIndex = 0;
        }
        if (playerIndex < game.currentPlayerIndex) {
          game.currentPlayerIndex--;
        }
        if (
          game.players.length > 0 &&
          game.players[game.currentPlayerIndex]
        ) {
          const nextPlayer = game.players[game.currentPlayerIndex];
          nextPlayer.drawn = false;
          nextPlayer.discarded = false;

          io.to(roomId).emit("turnEnded", {
            message: `Turn passed due to player leaving. Now it's ${nextPlayer.userName}'s turn`,
            currentPlayerId: nextPlayer.userId,
          });

          io.to(nextPlayer.socketId).emit("yourTurn", {
            message: `It's your turn, ${nextPlayer.userName}`,
          });

          startTurnTimer(io, roomId);
        }

        io.to(roomId).emit("playerLeft", {
          message: `${leavingPlayer.userName} left the game.`,
          playerId: leavingPlayer.userId,
        });

        await setGame(roomId, game);
      }
      break;
    }
  }
  });

  socket.on("reconnectToRoom", async () => {
  try {
    const userId = socket.user?._id?.toString();
    console.log("RECONNECT event:", { userId });
    if (!userId)
      return socket.emit("turnError", { message: "Unauthorized." });
    console.log("disconnectedPlayers at reconnect:", disconnectedPlayers);
    const info = disconnectedPlayers.get(userId); 
    if (!info) {
      return socket.emit("turnError", { message: "No game to reconnect." });
    }

    const { roomId, timeout } = info;
    let game = await getGame(roomId);
    if (!game) {
      disconnectedPlayers.delete(userId);
      return socket.emit("turnError", { message: "Game not found." });
    }

    const player = game.players.find(
      (p) => String(p.userId) === String(userId)
    );

    if (player) {
      player.socketId = socket.id;
      socket.roomId = roomId;
      socket.join(roomId);
      await setGame(roomId, game);
      
      clearTimeout(timeout);
      disconnectedPlayers.delete(userId);
     
      socket.emit("reconnected", {
        message: "Reconnected to the game.",
        // game,
        // playerHand: player.hand,
        game: { ...game, players: game.players.map(p => ({ ...p, hand: p.userId === userId ? p.hand : [] })) },
        playerHand: player.hand,
        melds: player.melds,
      });
    
      io.to(roomId).emit("playerReconnected", {
        playerId: userId,
        userName: player.userName,
        message: `${player.userName} has rejoined the game.`,
      });
    
      console.log(`Player ${player.userName} (${userId}) reconnected to room ${roomId}`);
    } else {
      socket.emit("turnError", { message: "Player not found in game." });
    }
  } catch (err) {
    console.error("Error in reconnectToRoom:", err);
    socket.emit("turnError", { message: "Failed to reconnect." });
  }
  
  });

  socket.on("disconnect", async () => {
  const userId = socket.user?._id?.toString();
  const roomId = socket.roomId;

  console.log("DISCONNECT event:", { userId, roomId });

  if (!userId || !roomId) {
    console.warn("User ID or Room ID missing on disconnect. Aborting.");
    return;
  }
  
  try {
    const previousDisconnect = disconnectedPlayers.get(userId);
    if (previousDisconnect?.timeout) {
      clearTimeout(previousDisconnect.timeout);
      console.log(`Cleared previous disconnect timeout for user ${userId}`);
    }

    io.to(roomId).emit("playerDisconnected", {
      playerId: userId,
      message: `Player ${socket.user?.userName || 'Unknown'} disconnected. Waiting for reconnection...`,
    });

    const RECONNECTION_TIMEOUT_MS = 60000;

    const timeout = setTimeout(async () => {
      console.log(`Reconnection timeout for user ${userId} in room ${roomId} expired.`);
      disconnectedPlayers.delete(userId);

      const game = await getGame(roomId);
      if (!game) {
        console.warn(`Game not found for room ${roomId} after disconnect timeout.`);
        return;
      }

      const playerIndex = game.players.findIndex((p) => p.userId?.toString() === userId);

      if (playerIndex === -1) {
        console.log(`Player ${userId} not found in game ${roomId}.`);
        return;
      }

      const leavingPlayer = game.players[playerIndex];
      game.players.splice(playerIndex, 1);

      console.log(`Player ${leavingPlayer.userName} (ID: ${userId}) permanently removed from room ${roomId}.`);
      await handlePlayerRemoval(io, game, roomId, leavingPlayer, playerIndex);
      console.log("Disconnected player processed. Current disconnectedPlayers:", disconnectedPlayers);
    }, RECONNECTION_TIMEOUT_MS);

    disconnectedPlayers.set(userId, { roomId, timeout });
    console.log("Player disconnect timeout set. Current disconnectedPlayers:", disconnectedPlayers);

  } catch (err) {
    console.error("Error during disconnect handling:", {
      userId,
      roomId,
      error: err.message,
      stack: err.stack,
    });
  }
  });

  // Handle wallet transactions
  socket.on("walletTransaction", async ({ type, amount, remarks = "" }) => {
    try {
      const { _id: userId } = socket.user;
      
      if (!userId) {
        return socket.emit("walletError", { message: "Unauthorized access." });
      }

      if (!["deposit", "withdraw"].includes(type)) {
        return socket.emit("walletError", { message: "Invalid transaction type." });
      }

      if (amount <= 0) {
        return socket.emit("walletError", { message: "Amount must be greater than 0." });
      }

      const user = await User.findById(userId);
      if (!user) {
        return socket.emit("walletError", { message: "User not found." });
      }

      // Check for withdrawal limits
      if (type === "withdraw" && user.wallet < amount) {
        return socket.emit("walletError", { 
          message: `Insufficient balance. Available: ₹${user.wallet}` 
        });
      }

      // Calculate new balance
      const newBalance = type === "deposit" 
        ? user.wallet + amount 
        : user.wallet - amount;

      // Create transaction record
      const transaction = {
        type,
        amount: type === "deposit" ? amount : -amount,
        balanceAfter: newBalance,
        status: "success",
        remarks: remarks || `${type} transaction`,
      };

      // Update user wallet and add transaction
      await User.findByIdAndUpdate(userId, {
        wallet: newBalance,
        $push: { transactions: transaction }
      });

      socket.emit("walletTransactionSuccess", {
        type,
        amount,
        newBalance,
        transaction,
        message: `₹${amount} ${type === "deposit" ? "added to" : "withdrawn from"} wallet successfully.`
      });

      console.log(`Wallet ${type}: ₹${amount} for user ${userId}. New balance: ₹${newBalance}`);

    } catch (error) {
      console.error("walletTransaction error:", error);
      socket.emit("walletError", { message: "Transaction failed." });
    }
  });

  // Get wallet balance and transaction history
// make sure it's imported

  socket.on("getWalletInfo", async () => {
    try {
      const { _id: userId } = socket.user;
  
      if (!userId) {
        return socket.emit("walletError", { message: "Unauthorized access." });
      }
  
      // ✅ Get user's wallet balance
      const user = await User.findById(userId).select("wallet");
      if (!user) {
        return socket.emit("walletError", { message: "User not found." });
      }
  
      // ✅ Fetch last 50 transactions from the separate Transaction collection
      const transactions = await Transaction.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
  
      // ✅ Emit combined wallet info
      socket.emit("walletInfo", {
        balance: user.wallet,
        transactions, // already sorted and limited
      });
  
    } catch (error) {
      console.error("getWalletInfo error:", error);
      socket.emit("walletError", { message: "Failed to fetch wallet info." });
    }
  });
  

  // Handle prize distribution when game ends
  socket.on("distributePrize", async ({ roomId, winnerId, winnerPrize }) => {
    try {
      const game = await getGame(roomId);
      if (!game || !game.prizePool) {
        return;
      }

      const winner = await User.findById(winnerId);
      if (!winner) {
        console.error(`Winner ${winnerId} not found for prize distribution`);
        return;
      }

      const newBalance = winner.wallet + winnerPrize;
      
      // Create transaction record for winner
      const transaction = {
        type: "gameWin",
        amount: winnerPrize,
        balanceAfter: newBalance,
        status: "success",
        remarks: `Prize money from room ${roomId}`,
      };

      // Update winner's wallet
      await User.findByIdAndUpdate(winnerId, {
        wallet: newBalance,
        $push: { transactions: transaction }
      });

      // Notify winner
      const winnerSocket = [...io.sockets.sockets.values()].find(s => s.user?._id?.toString() === winnerId.toString());
      if (winnerSocket) {
        winnerSocket.emit("prizeWon", {
          amount: winnerPrize,
          newBalance,
          message: `Congratulations! You won ₹${winnerPrize}!`
        });
      }

      // Notify all players in room
      io.to(roomId).emit("prizeDistributed", {
        winnerId,
        amount: winnerPrize,
        message: `Prize of ₹${winnerPrize} distributed to winner!`
      });

      console.log(`Prize ₹${winnerPrize} distributed to winner ${winnerId} in room ${roomId}`);

    } catch (error) {
      console.error("distributePrize error:", error);
    }
  });

  // Handle refund when game is cancelled
  socket.on("refundEntryFee", async ({ roomId }) => {
    try {
      const game = await getGame(roomId);
      if (!game || !game.entryFee) {
        return;
      }

      // Refund entry fee to all players
      for (const player of game.players) {
        const user = await User.findById(player.userId);
        if (user && player.entryFeePaid) {
          const newBalance = user.wallet + player.entryFeePaid;
          
          const transaction = {
            type: "deposit",
            amount: player.entryFeePaid,
            balanceAfter: newBalance,
            status: "success",
            remarks: `Refund for cancelled game in room ${roomId}`,
          };

          await User.findByIdAndUpdate(player.userId, {
            wallet: newBalance,
            $push: { transactions: transaction }
          });

          // Notify player
          const playerSocket = [...io.sockets.sockets.values()].find(s => s.user?._id?.toString() === player.userId.toString());
          if (playerSocket) {
            playerSocket.emit("refundReceived", {
              amount: player.entryFeePaid,
              newBalance,
              message: `₹${player.entryFeePaid} refunded due to game cancellation.`
            });
          }
        }
      }

      io.to(roomId).emit("gameRefunded", {
        message: "Entry fees refunded due to game cancellation."
      });

      console.log(`Entry fees refunded for cancelled game in room ${roomId}`);

    } catch (error) {
      console.error("refundEntryFee error:", error);
    }
  });

  const saveGameToMongo = async (roomId, game) => {
    try {
      console.log("this is game:", game);
  
      // Upsert Game (update if exists, insert if not)
      const updatedGame = await Game.updateOne(
        { roomId: roomId },
        {
          $set: {
            createdBy: game.createdBy,
            gameType: game.gameType,
            poolLimit: game.poolLimit,
            round: game.round,
            started: game.started,
            playersCount: game.players.length,
            entryFee: game.entryFee,
            prizePool: game.prizePool,
            gameStatus: game.gameStatus || "finished",
            winnerId: game.winnerId,
            winnerName: game.winnerName,
            prizeWon: game.prizeWon,
            deck: game.deck,
            discardPile: game.discardPile,
            wildCard: game.wildCard,
          },
        },
        { upsert: true }
      );
  
      // Optional: retrieve the saved/updated game ID (for players)
      const savedGame = await Game.findOne({ roomId });
  
      // Save Players
      for (const player of game.players) {
        await PlayerInGame.create({
          gameId: savedGame._id,
          userId: player.userId,
          userName: player.userName,
          socketId: player.socketId,
          score: player.score,
          hand: player.hand,
          melds: player.melds,
        });
  
        if (player.entryFeePaid) {
          const user = await User.findById(player.userId);
          await Transaction.create({
            userId: player.userId,
            type: "gameLoss",
            amount: -player.entryFeePaid,
            balanceAfter: user.wallet,
            remarks: `Entry fee for game ${roomId}`,
          });
        }
      }
  
      console.log(`Game ${roomId} saved/updated in MongoDB.`);
    } catch (err) {
      console.error("Error saving game to Mongo:", err);
    }
  };
  

  // const saveGameToMongo = async (roomId, game) => {
  //   try {
  //     // Save Game
  //     console.log("this is game :",game);
      
  //     const savedGame = await Game.create({
  //       roomId: roomId,
  //       createdBy: game.createdBy,
  //       gameType: game.gameType,
  //       poolLimit: game.poolLimit,
  //       round: game.round,
  //       started: game.started,
  //       playersCount: game.players.length,
  //       entryFee: game.entryFee,
  //       prizePool: game.prizePool,
  //       gameStatus: game.gameStatus || "finished",
  //       winnerId: game.winnerId,
  //       winnerName: game.winnerName,
  //       prizeWon: game.prizeWon,
  //       deck: game.deck,
  //       discardPile: game.discardPile,
  //       wildCard: game.wildCard,
  //     });
  
  //     // Save Players
  //     for (const player of game.players) {
  //       await PlayerInGame.create({
  //         gameId: savedGame._id,
  //         userId: player.userId,
  //         userName: player.userName,
  //         socketId: player.socketId,
  //         score: player.score,
  //         hand: player.hand,
  //         melds: player.melds,
  //       });
  
  //       // Optionally: Save transaction if entryFee exists
  //       if (player.entryFeePaid) {
  //         const user = await User.findById(player.userId);
  //         await Transaction.create({
  //           userId: player.userId,
  //           type: "gameLoss", // or "gameWin" if winner
  //           amount: -player.entryFeePaid,
  //           balanceAfter: user.wallet,
  //           remarks: `Entry fee for game ${roomId}`,
  //         });
  //       }
  //     }

  //     await Game.updateOne(
  //       { roomId: game.roomId },     // Match by roomId
  //       { $set: game },              // Set new data
  //       { upsert: true }             // Insert if doesn't exist
  //     );
  
  //     console.log(`Game ${roomId} saved to MongoDB.`);
  //   } catch (err) {
  //     console.error("Error saving game to Mongo:", err);
  //   }
  // };
  

};


  //  without redis
        /*  const game = (activeGames[roomId] ||= {
          players: [],
          started: false,
          createdAt: new Date(),
          createdBy: userId,
          gameType,
          poolLimit,
          round: 1,
        }); */