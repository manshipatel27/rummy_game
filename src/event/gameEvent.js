const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const { isValidMeld, calculatePenaltyPoints, countSequences,hasPureSequence } = require("../utils/isValidMeld");

// startTurnTimer, cleanupTimers, TURN_DURATION_SECONDS

const User = require("../../model/userModel");
const { updateUser, updateMelds } = require("../userService");
const activeGames = {};
const MAX_PLAYERS = 4;

const isValidString = (param) =>
  typeof param === "string" && param.trim() !== "";

module.exports = (io, socket) => {

  socket.on("joinRoom", async ({ roomId }) => {
    try {
      const { _id: userId, name: userName } = socket.user;

      socket.userId = userId;
      socket.roomId = roomId;

      socket.join(roomId);
      // const game = (activeGames[roomId] ||= { players: [], started: false });

      const game = (activeGames[roomId] ||= {
        players: [],
        started: false,
        createdAt: new Date(),
        createdBy: userId,
      });

      if (game.players.find((p) => p.userId == userId)) {
        return socket.emit("turnError", {
          message: "User already joined the room.",
        });
      }

      if (game.players.length >= MAX_PLAYERS) {
        return socket.emit("turnError", { message: "Room is full." });
      }
      const player = { userId, userName, socketId: socket.id };
      game.players.push(player);

      await updateUser(userId, { currentGameStatus: "waiting" });

      // io.to(roomId).emit("userJoined", {
      //   userId,
      //   userName,
      //   message: `${userName} has joined the room.`,
      // });

      const payload = {
        players: game.players,
        message: `${userName} has joined the room.`,
      };

      //   io.to(roomId).emit("userJoined", {
      //     players: game.players,
      //     // players,
      //     message: `${userName} has joined the room.`,
      //   });

      // io.to(roomId).emit("joinedRoom", {
      //   roomId,
      //   players: game.players,
      //   // players,
      //   message: `${userName} has joined room: ${roomId}`,
      // });

      // Notify users
      io.to(roomId).emit("userJoined", payload);
      io.to(roomId).emit("joinedRoom", { ...payload, roomId });
    } catch (err) {
      console.error("joinRoom error:", err);
      socket.emit("turnError", { message: "Unexpected error in joinRoom." });
    }
  });

  socket.on("startGame", async ({ roomId }) => {
    try {
      if (!isValidString(roomId)) {
        socket.emit("error", { message: "Invalid room ID." });
        return;
      }
      if (!activeGames[roomId]) {
        socket.emit("turnError", { message: "Room not found." });
        return;
      }
      const game = activeGames[roomId];

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

      // let deck = createDeck();
      // deck = shuffleDeck(deck);
      // game.deck = deck;

      // CHANGE - Dynamically determine number of decks
      let numPlayers = game.players.length;
      let numDecks = numPlayers <= 6 ? 2 : 3;

      let deck = createDeck(numDecks);
      deck = shuffleDeck(deck);
      game.deck = deck;

      console.log(`Number of Players: ${numPlayers}`);
      console.log(`Number of Decks Used: ${numDecks}`);
      console.log(`Total Number of Cards After Shuffling: ${deck.length}`);

      let cardsPerPlayer =
        game.players.length === 2 ? 13 : game.players.length <= 4 ? 10 : 7;

      /*  if (game.deck.length < game.players.length * cardsPerPlayer + 1) {
        socket.emit("turnError", {
          message: "Not enough cards in deck to start the game.",
        });
        return;
      } */

      if (game.deck.length < game.players.length * cardsPerPlayer + 5) {
        socket.emit("turnError", {
          message: "Not enough cards in deck to start the game.",
        });
        return;
      }
      // Select a wild card
      const wildCard = game.deck.pop();
      game.wildCard = wildCard;

      do {
        game.discardPile = [game.deck.pop()];
      } while (game.discardPile[0] === "🃏");

      game.currentPlayerIndex = 0;

      for (const player of game.players) {
        await updateUser(player.userId, {
          $inc: { gamesPlayed: 1 },
          currentGameStatus: "playing",
          dealScore: 0,
          melds: [],
        });
      }

      game.players.forEach((player) => {
        player.hand = game.deck.splice(0, cardsPerPlayer);
        player.initialHandCount = player.hand.length;
        io.to(player.socketId).emit("playerHand", {
          hand: player.hand,
        });
      });

      // startTurnTimer(io, roomId, activeGames);

      io.to(roomId).emit("gameStarted", {
        message: "Game has started",
        players: game.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          handSize: cardsPerPlayer,
        })),
        discardPile: game.discardPile,
        currentPlayerIndex: game.currentPlayerIndex,
        wildCard: game.wildCard,
        // timeLeft: TURN_DURATION_SECONDS,
      });

      console.log(`Game successfully started in room: ${roomId}`);
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("turnError", { message: "An unexpected error occurred" });
    }
  });

  /* wild jocker implemention */

  // socket.on("startGame", async ({ roomId }) => {
  //   try {
  //     if (!isValidString(roomId)) {
  //       socket.emit("error", { message: "Invalid room ID." });
  //       return;
  //     }
  //     if (!activeGames[roomId]) {
  //       socket.emit("turnError", { message: "Room not found." });
  //       return;
  //     }
  //     const game = activeGames[roomId];

  //     if (game.started) {
  //       socket.emit("turnError", { message: "Game has already started." });
  //       return;
  //     }

  //     if (game.players.length < 2) {
  //       socket.emit("turnError", {
  //         message: "At least 2 players are required to start the game.",
  //       });
  //       return;
  //     }

  //     game.started = true;

  //     // Dynamically determine number of decks
  //     let numPlayers = game.players.length;
  //     let numDecks = numPlayers <= 6 ? 2 : 3;

  //     let deck = createDeck(numDecks);
  //     deck = shuffleDeck(deck);
  //     game.deck = deck;

  //     console.log(`Number of Players: ${numPlayers}`);
  //     console.log(`Number of Decks Used: ${numDecks}`);
  //     console.log(`Total Number of Cards After Shuffling: ${deck.length}`);

  //     let cardsPerPlayer = game.players.length === 2 ? 13 : game.players.length <= 4 ? 10 : 7;

  //     if (game.deck.length < game.players.length * cardsPerPlayer + 5) {
  //       socket.emit("turnError", {
  //         message: "Not enough cards in deck to start the game.",
  //       });
  //       return;
  //     }

  //     // Select a wild card
  //     const wildCard = game.deck.pop();
  //     game.wildCard = wildCard;
  //     console.log(`Wild Card: ${wildCard}`);

  //     do {
  //       game.discardPile = [game.deck.pop()];
  //     } while (game.discardPile[0] === "🃏");

  //     game.currentPlayerIndex = 0;

  //     for (const player of game.players) {
  //       await updateUser(player.userId, {
  //         $inc: { gamesPlayed: 1 },
  //         currentGameStatus: "playing",
  //         dealScore: 0,
  //         melds: [],
  //       });
  //     }

  //     game.players.forEach((player) => {
  //       player.hand = game.deck.splice(0, cardsPerPlayer);
  //       player.initialHandCount = player.hand.length;
  //       io.to(player.socketId).emit("playerHand", {
  //         hand: player.hand,
  //       });
  //     });

  //     // startTurnTimer(io, roomId, activeGames);

  //     // Notify players about the wild card
  //     io.to(roomId).emit("gameStarted", {
  //       message: "Game has started",
  //       players: game.players.map((p) => ({
  //         userId: p.userId,
  //         userName: p.userName,
  //         handSize: cardsPerPlayer,
  //       })),
  //       discardPile: game.discardPile,
  //       currentPlayerIndex: game.currentPlayerIndex,
  //       wildCard: game.wildCard, // Broadcast the wild card
  //       timeLeft: TURN_DURATION_SECONDS,
  //     });

  //     console.log(`Game successfully started in room: ${roomId}`);
  //     console.log(`Wild Card: ${wildCard}`);
  //   } catch (error) {
  //     console.error("Error in startGame:", error);
  //     socket.emit("turnError", { message: "An unexpected error occurred" });
  //   }
  // });


  socket.on("drawCard", async ({ drawFrom }) => {
    try {
      // 1. Authentication check
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

      // 2. Get room ID from socket's joined rooms
      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );
      if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }
      const game = activeGames[roomId];
      const userId = socket.user._id;

      // 3. Find player and validate turn
      const player = game.players.find((p) => p.userId === userId);
      if (!player) {
        return socket.emit("turnError", { message: "Player not found." });
      }

      if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      if (player.drawn) {
        return socket.emit("AlreadyDrawnCard", {
          message: "You've already drawn a card this turn.",
        });
      }

      // 4. Handle deck reshuffling if needed
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

      // 5 Draw card logic
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

      // 6. Update game state
      player.drawn = true;
      player.hand.push(drawnCard);

      // 7. Emit updates
      io.to(player.socketId).emit("cardDrawn", {
        drawnCard,
        hand: player.hand,
        deckSize: game.deck.length,
      });

      if (drawFrom === "discard") {
        io.to(roomId).emit("updateDiscardPile", game.discardPile);
      }

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

      if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }
      const game = activeGames[roomId];
      const userId = socket.user._id;

      const player = game.players.find((p) => p.userId === userId);
      if (!player) {
        return socket.emit("turnError", { message: "Player data not found." });
      }

      if (player.discarded) {
        return socket.emit("turnError", {
          message: "Already discarded this turn.",
        });
      }

      //  it's the player's turn
      if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      // Allow discarding the last card even if the player hasn't drawn a card
      if (!player.drawn && player.hand.length > 1) {
        return socket.emit("turnError", {
          message: "You must draw a card before discarding.",
        });
      }

      // Find the card index in the player's hand
      const cardIndex = player.hand.findIndex((c) => c.trim() === card.trim());
      if (cardIndex === -1) {
        return socket.emit("turnError", { message: "Card not found in hand." });
      }

      // Discard the card and add it to the discard pile
      const discardedCard = player.hand.splice(cardIndex, 1)[0];
      game.discardPile.unshift(discardedCard);
      player.discarded = true;

      // Update the discard pile and player's hand for everyone
      io.to(roomId).emit("updateDiscardPile", game.discardPile);
      io.to(player.socketId).emit("updateHand", player.hand);

      if (player.hand.length === 0) {
        console.log(
          "Player has no cards left after discard! Declaring winner:",
          player.userId
        );
        player.score = 0;

        await User.findByIdAndUpdate(
          player.userId,
          {
            $inc: { gamesWon: 1 },
            currentGameStatus: "finished",
          },
          { new: true }
        );

        game.players.forEach((p) => {
          if (p.userId !== player.userId) {
            p.score = calculatePenaltyPoints(p.hand);
          }
        });

        io.to(roomId).emit("gameOver", {
          winner: player.userId,
          scores: game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          })),
        });

        cleanupTimers?.(roomId);
        delete activeGames[roomId];
        return;
      }

      // // Regular turn logic
      // player.drawn = false;
      // player.discarded = false;

      // Update the current player index
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 1) % game.players.length;
      const nextPlayer = game.players[game.currentPlayerIndex];

      nextPlayer.drawn = false;
      nextPlayer.discarded = false;

      // Notify the Next player
      io.to(nextPlayer.socketId).emit("turnEnded", {
        message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
        currentPlayerId: nextPlayer.userId,
      });

      io.to(nextPlayer.socketId).emit("yourTurn", {
        message: `It's your turn, ${nextPlayer.userName}`,
      });

      await User.findByIdAndUpdate(
        userId,
        { score: player.score },
        { new: true }
      );

      console.log("Discarded:", card, "by", player.userName);
    } catch (error) {
      console.error("Discard card error:", error);
      socket.emit("turnError", { message: "Failed to discard card" });
    }
  });

  socket.on("layDownMelds", async ({ melds }) => {

    // console.log("Received meld:", melds);
    // console.log("Socket userId:", socket.userId);
    // console.log("Socket roomId:", socket.roomId);

    
    try {
      const playerId = socket.userId;
      const roomId = socket.roomId;
      const game = activeGames[roomId];

      if (!game) {
        socket.emit("error", { message: "Game not found." });
        return;
      }

      const player = game.players.find((p) => p.userId === playerId);
      if (!player) {
        socket.emit("error", { message: "Player not found." });
        return;
      }

      if (game.players[game.currentPlayerIndex].userId !== playerId) {
        socket.emit("turnError", { message: "It's not your turn." });
        return;
      }

      if (!Array.isArray(melds) || melds.length === 0) {
        socket.emit("turnError", { message: "Invalid melds format." });
        return;
      }

      for (const meld of melds) {
        if (!isValidMeld(meld, game.wildCard)) {
          socket.emit("turnError", { message: "Invalid meld detected." });
          return;
        }
      }

      const hasPure = hasPureSequence(melds, game.wildCard);
      const totalSequences = countSequences(melds, game.wildCard);

      if (!hasPure || totalSequences < 2) {
        console.log(" Wrong Declaration by player:", playerId);

        const wrongPenalty = Math.min(calculatePenaltyPoints(player.hand, game.wildCard), 80 );

        player.score = wrongPenalty;

        io.to(roomId).emit("wrongDeclaration", {
          playerId: playerId,
          penaltyPoints: wrongPenalty,
        });

        await User.findByIdAndUpdate(
          playerId,
          { $inc: { wrongDeclarations: 1 } },
          { new: true }
        );

        // Give 0 points to other players
        game.players.forEach((p) => {
          if (p.userId !== playerId) {
            p.score = 0;
          }
        });

        io.to(roomId).emit("gameOver", {
          winner: null,
          wrongDeclarer: playerId,
          scores: game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          })),
        });

        cleanupTimers(roomId);
        delete activeGames[roomId];
        return;
      }

      // Remove cards from player's hand
      melds.flat().forEach((card) => {
        const index = player.hand.indexOf(card);
        if (index !== -1) {
          player.hand.splice(index, 1);
        }
      });

      if (!player.melds) player.melds = [];
      player.melds.push(...melds);

      const updatedUser = await updateMelds(playerId, {
        $set: { melds: player.melds },
      });
      console.log("User updated with melds:", updatedUser);

      if (player.hand.length === 0) {
        console.log(
          "Player has no cards left after melds! Declaring winner:",
          playerId
        );
        player.score = 0;

        await User.findByIdAndUpdate(
          playerId,
          { $inc: { gamesWon: 1 } },
          { new: true }
        );

        game.players.forEach((p) => {
          if (p.userId !== playerId) {
            p.score = calculatePenaltyPoints(p.hand, game.wildCard);
          }
        });

        io.to(roomId).emit("gameOver", {
          winner: playerId,
          scores: game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          })),
        });

        cleanupTimers(roomId);
        delete activeGames[roomId];
        return;
      }

      io.to(roomId).emit("meldsLaidDown", {
        playerId,
        melds: player.melds,
      });
    } catch (error) {
      console.error("Error in layDownMelds event:", error);
      socket.emit("turnError", { message: "An unexpected error occurred." });
    }
  });

  /* socket.on("dropGame", async () => {
  try {
    
    if (!socket.user?._id) {
      return socket.emit("turnError", { message: "Unauthorized access." });
    }

    
    const roomId = Array.from(socket.rooms).find((room) => room !== socket.id);
    if (!roomId || !activeGames[roomId]) {
      return socket.emit("turnError", {
        message: "You're not in an active game.",
      });
    }

    const game = activeGames[roomId];
    const userId = socket.user._id;

    
    const playerIndex = game.players.findIndex((p) => p.userId === userId);
    if (playerIndex === -1) {
      return socket.emit("turnError", { message: "Player not found in the game." });
    }

    const player = game.players[playerIndex];

    // Determine the penalty based on whether the player has drawn a card
    const penalty = player.drawn ? 40 : 20;

    
    // player.score = (player.score || 0) + penalty;
    

    // Remove the player from the game
    game.players.splice(playerIndex, 1);

    // Update the player's status in the database
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: { score: penalty },
        currentGameStatus: "dropped",
      },
      { new: true }
    );

    // Broadcast the updated scores and player status to all players
    io.to(roomId).emit("playerDropped", {
      message: `${player.userName} has dropped from the game.`,
      playerId: player.userId,
      penalty,
      scores: game.players.map((p) => ({
        playerId: p.userId,
        score: p.score,
      })),
    });

    console.log(`Player ${player.userName} dropped from the game in room ${roomId}.`);

    if (game.players.length === 1) {
      const winner = game.players[0];
      
      io.to(roomId).emit("gameOver", {
        message: `🎉 ${winner.userName} wins! All other players have dropped.`,
        winnerId: winner.userId,
        scores: game.players.map((p) => ({
          playerId: p.userId,
          score: p.score,
        })),
      });
     
      startTurnTimer?.(roomId); 
      delete activeGames[roomId];
      return;
    }

    // If no players are left, clean up the game
    if (game.players.length === 0) {
      delete activeGames[roomId];
      return;
    }

    // If more than 1 player remains, continue the game
    io.to(roomId).emit("gameContinues", {
      message: "The game continues with the remaining players.",
      remainingPlayers: game.players.map((p) => ({
        playerId: p.userId,
        userName: p.userName,
      })),
    });
  } catch (error) {
    console.error("Error in dropGame event:", error);
    socket.emit("turnError", { message: "An unexpected error occurred." });
  }

  }); */

  socket.on("dropGame", async () => {
    try {
      // Authentication check
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

      // Room validation
      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );
      if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }

      const game = activeGames[roomId];
      const userId = socket.user._id;

      const playerIndex = game.players.findIndex((p) => p.userId === userId);
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
        },
        { new: true }
      );

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

      // Handle game end if only 1 player remains
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

        delete activeGames[roomId];
        return;
      }

      // Cleanup if no players left (unlikely case)
      if (game.players.length === 0) {
        delete activeGames[roomId];
        return;
      }

      // Continue game with remaining players
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

  /* modifyed LeaveRoom event few changes in this events

  1. pure sequence and impure sequence, 
  2.  wild cards functionality.
  3.  wrong declaration and penalty points.

  */

  socket.on("leaveRoom", () => {
    console.log(`GameEvent: User disconnected: ${socket.id}`);
    for (const roomId in activeGames) {
      const game = activeGames[roomId];
      const playerIndex = game.players.findIndex(
        (p) => p.socketId === socket.id
      );

      if (playerIndex !== -1) {
        const leavingPlayer = game.players[playerIndex];
        game.players.splice(playerIndex, 1);

        // clearTimeout(game.turnTimer);
        // clearTimeout(game.warningTimer);

        if (game.players.length === 1) {
          const winner = game.players[0];

          io.to(winner.socketId).emit("gameOver", {
            message: `🎉 You win ${leavingPlayer.userName} left the game.`,
            winnerId: winner.userId,
          });

          console.log(
            ` ${winner.userName} wins. ${leavingPlayer.userName} left.`
          );

          delete activeGames[roomId];
        } else if (game.players.length === 0) {
          delete activeGames[roomId];
        } else {
          io.to(roomId).emit("playerLeft", {
            message: `${leavingPlayer.userName} left the game.`,
            playerId: leavingPlayer.userId,
          });
        }

        break;
      }
    }
  });

  socket.on("disconnect", () => {});
};
