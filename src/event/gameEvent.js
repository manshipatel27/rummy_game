const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const {
  isValidMeld,
  calculatePenaltyPoints,
  countSequences,
  hasPureSequence,
} = require("../utils/isValidMeld");
// startTurnTimer, cleanupTimers, TURN_DURATION_SECONDS

const { updateUser, updateMelds } = require("../userService");
const User = require("../../model/userModel");
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

      const payload = {
        players: game.players,
        message: `${userName} has joined the room.`,
      };

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
          score: 0,
          melds: [],
        });
      }

      // game.players.forEach((player) => {
      //   player.hand = game.deck.splice(0, cardsPerPlayer);
      //   player.initialHandCount = player.hand.length;
      //   io.to(player.socketId).emit("playerHand", {
      //     hand: player.hand,
      //   });
      // });

      game.players.forEach((player) => {
        player.hand = game.deck.splice(0, cardsPerPlayer);
        player.score = 0;
        player.melds = [];
        io.to(player.socketId).emit("playerHand", { hand: player.hand });
      });

      // startTurnTimer(io, roomId, activeGames);

      // io.to(roomId).emit("gameStarted", {
      //   message: "Game has started",
      //   players: game.players.map((p) => ({
      //     userId: p.userId,
      //     userName: p.userName,
      //     handSize: cardsPerPlayer,
      //   })),
      //   discardPile: game.discardPile,
      //   currentPlayerIndex: game.currentPlayerIndex,
      //   wildCard: game.wildCard,
      //   // timeLeft: TURN_DURATION_SECONDS,
      // });

      io.to(roomId).emit("gameStarted", {
        message: "Game has started",
        gameType: game.gameType,
        poolLimit: game.poolLimit || null,
        players: game.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          handSize: cardsPerPlayer,
        })),
        discardPile: game.discardPile,
        currentPlayerIndex: game.currentPlayerIndex,
        wildCard: game.wildCard,
      });

      console.log(`Game successfully started in room: ${roomId}`);
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("turnError", { message: "An unexpected error occurred" });
    }
  });

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

  socket.on("layDownMelds", async ({ melds }) => {                
    console.log("Received meld:", melds);

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
        socket.emit("error", { message: "Player not found." });
        return;
      }

      if (game.players[game.currentPlayerIndex].userId !== userId) {
        socket.emit("turnError", { message: "It's not your turn." });
        return;
      }

      if (!Array.isArray(melds) || melds.length === 0) {
        socket.emit("turnError", { message: "Invalid melds format." });
        return;
      }
      console.log("Player's hand before melding:", player.hand);

      let remainingCards = [...player.hand];

      const allMeldCards = melds.flat();
      console.log("All cards in melds:", allMeldCards);

      for (const meldCard of allMeldCards) {
        const cardIndex = remainingCards.findIndex(
          (handCard) => handCard.trim() === meldCard.trim()
        );

        if (cardIndex === -1) {
          console.log(`Card ${meldCard} not found in player's hand`);
          socket.emit("turnError", {
            message: `Card ${meldCard} not found in your hand.`,
          });
          return;
        }
        remainingCards.splice(cardIndex, 1);
      }

      // Validate all melds
      for (const meld of melds) {
        if (!isValidMeld(meld, game.wildCard)) {
          socket.emit("turnError", { message: "Invalid meld detected." });
          return;
        }
      }

      if (!player.melds) player.melds = [];
      player.melds.push(...melds);

      // Update player's hand with remaining cards
      player.hand = remainingCards;
      console.log("Player's hand after melding:", player.hand);

      const updatedUser = await updateMelds(userId, {
        $set: { melds: player.melds },
      });
      console.log("User updated with melds:", updatedUser);

      // Emit updated hand to player
      io.to(player.socketId).emit("updateHand", player.hand);

      // Check if this was a complete meld (all cards except one for discard)
      if (player.hand.length === 1) {
        console.log(
          "Player has one card left after melds! Awaiting discard to win."
        );
      } else if (player.hand.length === 0) {
        console.log(
          "Player has no cards left after melds! Declaring winner:",
          userId
        );
        player.score = 0;

        await User.findByIdAndUpdate(
          userId,
          { $inc: { gamesWon: 1 } },
          { new: true }
        );

        game.players.forEach((p) => {
          if (p.userId !== userId) {
            p.score = calculatePenaltyPoints(
              p.hand,
              game.wildCard,
              p.melds || []
            );
          }
        });

        io.to(roomId).emit("gameOver", {
          winner: userId,
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
        playerId: userId,
        melds: player.melds,
      });
    } catch (error) {
      console.error("Error in layDownMelds event:", error);
      socket.emit("turnError", { message: "An unexpected error occurred." });
    }
  });

  /* socket.on("discardCard", async ({ card }) => {
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
  
      if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }
  
      // Modified this condition to allow discarding without drawing if player has melded
      if (!player.drawn && player.hand.length > 1 && !player.melds?.length) {
        return socket.emit("turnError", {
          message: "You must draw a card before discarding.",
        });
      }
  
      // Log player's hand before discarding
      console.log("Player's hand before discarding:", player.hand);
      console.log("Card to discard:", card);
      
      const cardIndex = player.hand.findIndex((c) => c.trim() === card.trim());
      if (cardIndex === -1) {
        return socket.emit("turnError", { message: "Card not found in hand." });
      }
  
      const discardedCard = player.hand.splice(cardIndex, 1)[0];
      game.discardPile.unshift(discardedCard);
      player.discarded = true;
  
      // Log player's hand after discarding
      console.log("Player's hand after discarding:", player.hand);
  
      io.to(roomId).emit("updateDiscardPile", game.discardPile);
      io.to(player.socketId).emit("updateHand", player.hand);
  
      // Check if player has won after discarding the last card
      if (player.hand.length === 0) {
        console.log("Player has discarded their last card! Declaring winner:", player.userId);
        
        // For final verification, log the player's melds to check if they're valid
        console.log("Player's final melds:", player.melds);
        
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
            p.score = calculatePenaltyPoints(p.hand, game.wildCard);
          }
        });
  
        io.to(roomId).emit("gameOver", {
          winner: player.userId,
          scores: game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          })),
        });
  
        cleanupTimers(roomId);
        delete activeGames[roomId];
        return;
      }
  
      // Update the current player index
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 1) % game.players.length;
      const nextPlayer = game.players[game.currentPlayerIndex];
  
      nextPlayer.drawn = false;
      nextPlayer.discarded = false;
  
      io.to(roomId).emit("turnEnded", {
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
  }); */

                /* 5-5-25 */
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

      if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      // Modified this condition to allow discarding without drawing if player has melded
      if (!player.drawn && player.hand.length > 1 && !player.melds?.length) {
        return socket.emit("turnError", {
          message: "You must draw a card before discarding.",
        });
      }

      // Log player's hand before discarding
      console.log("Player's hand before discarding:", player.hand);
      console.log("Card to discard:", card);

      const cardIndex = player.hand.findIndex((c) => c.trim() === card.trim());
      if (cardIndex === -1) {
        return socket.emit("turnError", { message: "Card not found in hand." });
      }

      const discardedCard = player.hand.splice(cardIndex, 1)[0];
      game.discardPile.unshift(discardedCard);
      player.discarded = true;

      // Log player's hand after discarding
      console.log("Player's hand after discarding:", player.hand);

      io.to(roomId).emit("updateDiscardPile", game.discardPile);
      io.to(player.socketId).emit("updateHand", player.hand);

      if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
        if (player.score >= game.poolLimit) {
          console.log(
            `Player ${player.userName} eliminated for exceeding pool limit.`
          );
          game.players = game.players.filter((p) => p.userId !== userId);

          io.to(roomId).emit("playerEliminated", {
            playerId: userId,
            message: `${player.userName} has been eliminated for exceeding the pool limit.`,
          });

          if (game.players.length === 1) {
            const winner = game.players[0];
            io.to(roomId).emit("gameOver", {
              winner: winner.userId,
              message: `${winner.userName} wins the game!`,
            });
            delete activeGames[roomId];
            return;
          }
        }
      }

      // Check if player has melds and if they meet winning conditions when discarding last card
      if (player.hand.length === 0) {
        console.log(
          "Player has discarded their last card! Checking win conditions:",
          player.userId
        );

        // For final verification, log the player's melds to check if they're valid
        console.log("Player's final melds:", player.melds);

        // Check if player has the required melds to win
        const hasPure = hasPureSequence(player.melds || [], game.wildCard);
        const totalSequences = countSequences(
          player.melds || [],
          game.wildCard
        );

        if (!hasPure || totalSequences < 2) {
          console.log("Wrong Declaration by player:", userId);

          // Calculate penalty for wrong declaration
          const wrongPenalty = Math.min(
            calculatePenaltyPoints(
              player.hand.concat(player.melds.flat()),
              game.wildCard,
              []
            ),
            80
          );

          player.score = wrongPenalty;

          io.to(roomId).emit("wrongDeclaration", {
            playerId: userId,
            penaltyPoints: wrongPenalty,
          });

          await User.findByIdAndUpdate(
            userId,
            {
              $inc: { wrongDeclarations: 1 },
              $set: { score: wrongPenalty, currentGameStatus: "finished" },
            },
            { new: true }
          );

          game.players.forEach((p) => {
            if (p.userId !== userId) {
              p.score = 0;
            }
          });

          io.to(roomId).emit("gameOver", {
            winner: null,
            wrongDeclarer: userId,
            scores: game.players.map((p) => ({
              playerId: p.userId,
              score: p.score,
            })),
          });

          cleanupTimers(roomId);
          delete activeGames[roomId];
          return;
        }

        // Player has valid melds and has discarded their last card - they win!
        player.score = 0;

        await User.findByIdAndUpdate(
          player.userId,
          {
            $inc: { gamesWon: 1 },
            $set: { score: 0, currentGameStatus: "finished" },
          },
          { new: true }
        );

        // Calculate scores for other players, considering their valid melds
        for (const p of game.players) {
          if (p.userId !== player.userId) {
            // Use the fixed penalty calculation
            p.score = calculatePenaltyPoints(
              p.hand,
              game.wildCard,
              p.melds || []
            );
            console.log(
              `Calculated score for player ${p.userId}: ${p.score} points`
            );

            // Update losing player's score in database
            await User.findByIdAndUpdate(
              p.userId,
              {
                $set: {
                  score: p.score,
                  currentGameStatus: "finished",
                },
              },
              { new: true }
            ).catch((err) =>
              console.error("Error updating losing player score:", err)
            );
          }
        }

        // Log the final scores before sending to clients
        console.log(
          "Final scores:",
          game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          }))
        );

        io.to(roomId).emit("gameOver", {
          winner: player.userId,
          scores: game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          })),
        });

        cleanupTimers(roomId);
        delete activeGames[roomId];
        return;
      }

      // Continue with regular turn flow if game hasn't ended
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 1) % game.players.length;
      const nextPlayer = game.players[game.currentPlayerIndex];

      nextPlayer.drawn = false;
      nextPlayer.discarded = false;

      io.to(roomId).emit("turnEnded", {
        message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
        currentPlayerId: nextPlayer.userId,
      });

      io.to(nextPlayer.socketId).emit("yourTurn", {
        message: `It's your turn, ${nextPlayer.userName}`,
      });

      console.log("Discarded:", card, "by", player.userName);
    } catch (error) {
      console.error("Discard card error:", error);
      socket.emit("turnError", { message: "Failed to discard card" });
    }
  });

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
          currentGameStatus: "finished",
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

