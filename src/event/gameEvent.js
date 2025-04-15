const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const { isValidMeld, calculatePenaltyPoints } = require("../utils/isValidMeld");
// startTurnTimer,cleanupTimers,TURN_DURATION_SECONDS
const User = require("../../model/userModel");

const activeGames = {};
const MAX_PLAYERS = 4;

// function getUserRoomId(userId) {
//   for (const [roomId, game] of Object.entries(activeGames)) {
//     if (game.players.some((p) => p.userId === userId)) {
//       return roomId;
//     }
//   }
//   return null;
// }

const isValidString = (param) =>
  typeof param === "string" && param.trim() !== "";

module.exports = (io, socket) => {
  //   ========================  joinRoom  ========================>>>

  socket.on("ChooseGame", ({ type }) => {
    console.log(type);

    if (type === "classic") {
      socket.emit("gameType", { message: "classic Game started" });
      console.log("classic Game started");
    }

    if (type === "pool") {
      socket.emit("gameType", { message: "pool Game started" });
      console.log("pool Game started");
    }

    if (type === "point") {
      socket.emit("gameType", { message: "point Game started" });
      console.log("poin Game started");
    }
  });

  socket.on("joinRoom", ({ roomId }) => {
    try {
      const { _id: userId, name: userName } = socket.user;

      // if (!isValidString(roomId)) {
      //   return socket.emit("error", { message: "Invalid room ID." });
      // }

      socket.userId = userId;
      socket.roomId = roomId;

      socket.join(roomId);
      const game = (activeGames[roomId] ||= { players: [], started: false });

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

      io.to(roomId).emit("userJoined", {
        userId,
        userName,
        message: `${userName} has joined the room.`,
      });

      io.to(roomId).emit("joinedRoom", {
        roomId,
        players: game.players,
        message: `${userName} has joined room: ${roomId}`,
      });

      console.log(`✅ User ${userName} joined room ${roomId}`, game.players);
    } catch (err) {
      console.error("joinRoom error:", err);
      socket.emit("turnError", { message: "Unexpected error in joinRoom." });
    }
  });

  socket.on("startGame", async ({ roomId }) => {
    try {
      console.log("Starting game for room:", roomId);

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

      let deck = createDeck();
      deck = shuffleDeck(deck);
      game.deck = deck;

      let cardsPerPlayer =
        game.players.length === 2 ? 13 : game.players.length <= 4 ? 10 : 7;

      if (game.deck.length < game.players.length * cardsPerPlayer + 1) {
        socket.emit("turnError", {
          message: "Not enough cards in deck to start the game.",
        });
        return;
      }

      do {
        game.discardPile = [game.deck.pop()];
      } while (game.discardPile[0] === "🃏");

      game.currentPlayerIndex = 0;

      for (const player of game.players) {
        try {
          await User.findByIdAndUpdate(player.userId, {
            currentGameStatus: "playing",
          });
        } catch (err) {
          console.error(
            `Failed to update status for user ${player.userId}:`,
            err
          );
        }
      }

      game.players.forEach((player) => {
        player.hand = game.deck.splice(0, cardsPerPlayer);
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
        // timeLeft: TURN_DURATION_SECONDS,
      });

      console.log(`Game successfully started in room: ${roomId}`);
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("turnError", { message: "An unexpected error occurred" });
    }
  });

  // socket.on("drawCard", ({ roomId, playerId, drawFrom }) => {
  //   const game = activeGames[roomId];

  //   if (!game) {
  //     socket.emit("error", { message: "Game not found." });
  //     return;
  //   }

  //   const player = game.players.find((p) => p.userId === playerId);

  //   if (!player) {
  //     socket.emit("error", { message: "Player not found." });
  //     return;
  //   }

  //   if (game.players[game.currentPlayerIndex].userId !== playerId) {
  //     socket.emit("turnError", { message: "It's not your turn." });
  //     return;
  //   }

  //   if (player.drawn) {
  //     socket.emit("AlreadyDrawnCard", {
  //       message: "You have already selected a card.",
  //     });
  //     return;
  //   }

  //   let drawnCard;

  //   if (game.deck.length === 0 && game.discardPile.length > 1) {
  //     console.log("Deck is empty. Automatically reshuffling discard pile...");

  //     const reshufflePile = game.discardPile.slice(0, -1);
  //     game.deck = shuffleDeck(reshufflePile);
  //     game.discardPile = [game.discardPile[game.discardPile.length - 1]];

  //     io.to(roomId).emit("deckReshuffled", {
  //       message: "The discard pile has been reshuffled into the deck.",
  //     });
  //   }

  //   if (drawFrom === "deck") {
  //     if (game.deck.length === 0) {
  //       socket.emit("error", { message: "No cards left to draw." });
  //       return;
  //     }
  //     drawnCard = game.deck.shift();
  //   } else if (drawFrom === "discard") {
  //     if (game.discardPile.length === 0) {
  //       socket.emit("error", { message: "Discard pile is empty." });
  //       return;
  //     }

  //     drawnCard = game.discardPile.pop();
  //   } else {
  //     socket.emit("error", { message: "Invalid draw source." });
  //     return;
  //   }

  //   player.drawn = true;
  //   player.hand.push(drawnCard);

  //   io.to(player.socketId).emit("cardDrawn", {
  //     playerId,
  //     drawnCard,
  //     playerHand: player.hand,
  //     deckSize: game.deck.length,
  //     discardPile: game.discardPile,
  //   });

  //   // Broadcast updated discard pile to all players if drawn from discard
  //   if (drawFrom === "discard") {
  //     io.to(roomId).emit("updateDiscardPile", {
  //       discardPile: game.discardPile,
  //     });
  //   }
  // });

  socket.on("drawCard", ({ drawFrom }) => {
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
        drawnCard = game.discardPile.pop();
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
    } catch (turnError) {
      console.error("Draw card error:", error);
      socket.emit("turnError", { message: "Failed to draw card" });
    }
  });

  
  /* ------------------- test case 1 ----------------- */

  // socket.on("discardCard", ({ roomId, playerId, card }) => {
  //   try {
  //     const game = activeGames[roomId];

  //     if (!game) {
  //       socket.emit("turnError", { message: "Game not found." });
  //       return;
  //     }

  //     const player = game.players.find((p) => p.userId === playerId);

  //     if (!player) {
  //       throw new Error("Player not found.");
  //     }

  //     if (game.players[game.currentPlayerIndex].userId !== playerId) {
  //       socket.emit("turnError", { message: "It's not your turn." });
  //       return;
  //     }

  //     if (player.discarded) {
  //       throw new Error("You have already discarded a card");
  //     }

  //     const cardIndex = player.hand.findIndex((c) => c === card);
  //     if (cardIndex === -1) {
  //       socket.emit("error", { message: "Card not found in player's hand." });
  //       return;
  //     }

  //     const discardedCard = player.hand.splice(cardIndex, 1)[0];
  //     game.discardPile.unshift(discardedCard);

  //     player.discarded = true;

  //     io.to(player.socketId).emit("cardDiscarded", {
  //       playerId,
  //       updatedHand: player.hand,
  //     });

  //     io.to(roomId).emit("cardDiscarded", {
  //       playerId,
  //       discardedCard,
  //       discardPile: game.discardPile,
  //     });

  //     io.to(roomId).emit("updateGameState", {
  //       currentTurn: game.players[game.currentPlayerIndex].userId,
  //       discardPile: game.discardPile,
  //       players: game.players.map((p) => ({
  //         userId: p.userId,
  //         handSize: p.hand.length,
  //       })),
  //     });

  //     // Added gameOver logic inside discardCard
  //     if (player.hand.length === 0) {
  //       console.log(
  //         "Player has no cards left after discard! Declaring winner:",
  //         playerId
  //       );
  //       player.score = 0;

  //       game.players.forEach((p) => {
  //         if (p.userId !== playerId) {
  //           p.score = calculatePenaltyPoints(p.hand);
  //         }
  //       });

  //       io.to(roomId).emit("gameOver", {
  //         winner: playerId,
  //         scores: game.players.map((p) => ({
  //           playerId: p.userId,
  //           score: p.score,
  //         })),
  //       });

  //       clearTimeout(game.turnTimer);
  //       clearTimeout(game.warningTimer);
  //       delete activeGames[roomId];
  //       return; // Prevents further processing
  //     }
  //   } catch (error) {
  //     console.error("Error in discardCard event:", error.message);
  //   }
  // });

  /* ---------------- test case 2 ------------------ */
  // socket.on("discardCard", ({ card }) => {
  // try {
  //   // 1. Authentication check
  //   if (!socket.user?._id) {
  //     return socket.emit("error", { message: "Unauthorized access." });
  //   }

  //   // 2. Get room ID from socket's joined rooms
  //   const roomId = Array.from(socket.rooms).find(room => room !== socket.id);
  //   if (!roomId || !activeGames[roomId]) {
  //     return socket.emit("error", { message: "You're not in an active game." });
  //   }

  //   const game = activeGames[roomId];
  //   const userId = socket.user._id;

  //   // 3. Find player
  //   const player = game.players.find(p => p.userId === userId);
  //   if (!player) {
  //     return socket.emit("error", { message: "Player not found." });
  //   }

  //   // 4. Turn and discard validations
  //   if (game.players[game.currentPlayerIndex].userId !== userId) {
  //     return socket.emit("turnError", { message: "It's not your turn." });
  //   }

  //   if (player.discarded) {
  //     return socket.emit("error", { message: "You already discarded this turn." });
  //   }

  //   const cardIndex = player.hand.findIndex(c => c === card);
  //   if (cardIndex === -1) {
  //     return socket.emit("error", { message: "Card not in your hand." });
  //   }

  //   // 5. Discard card
  //   const discardedCard = player.hand.splice(cardIndex, 1)[0];
  //   game.discardPile.unshift(discardedCard);
  //   player.discarded = true;

  //   // 6. Stop timers if any

  //   // clearTimeout(game.turnTimer);
  //   // clearTimeout(game.warningTimer);

  //   // 7. response to player and room

  //   io.to(player.socketId).emit("cardDiscarded", {
  //     updatedHand: player.hand,
  //   });

  //   io.to(roomId).emit("updateDiscardPile", {
  //     discardPile: game.discardPile,
  //   });

  //   // 8. Win condition
  //   if (player.hand.length === 0) {
  //     player.score = 0;
  //     game.players.forEach(p => {
  //       if (p.userId !== userId) {
  //         p.score = calculatePenaltyPoints(p.hand);
  //       }
  //     });

  //     io.to(roomId).emit("gameOver", {
  //       winner: userId,
  //       scores: game.players.map(p => ({
  //         playerId: p.userId,
  //         score: p.score
  //       })),
  //     });

  //     cleanupTimers(roomId, activeGames);
  //     delete activeGames[roomId];
  //     return;
  //   }

  //   // 9. General game state update
  //   io.to(roomId).emit("updateGameState", {
  //     currentTurn: game.players[game.currentPlayerIndex].userId,
  //     discardPile: game.discardPile,
  //     players: game.players.map(p => ({
  //       userId: p.userId,
  //       handSize: p.hand.length,
  //     })),
  //   });

  // } catch (error) {
  //   console.error("Discard error:", error);
  //   socket.emit("error", { message: "Discard failed." });
  // }
  // });



  
  /*---------------- test case 3 ------------------ */
  socket.on("discardCard", ({ card }) => {
    try {
      // Ensure the user is authenticated
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }
  
      // Get the room ID the player is currently in
      const roomId = Array.from(socket.rooms).find((room) => room !== socket.id);
      if (!roomId || !activeGames[roomId]) {
        return socket.emit("turnError", {
          message: "You're not in an active game.",
        });
      }
  
      const game = activeGames[roomId];
      const userId = socket.user._id;
  
      // Find the player in the game using the authenticated user's ID
      const player = game.players.find((p) => p.userId === userId);
      if (!player) {
        return socket.emit("turnError", { message: "Player data not found." });
      }
  
      // Ensure it's the player's turn
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
  
      // Check for win condition (last card discarded)
      if (player.hand.length === 0) {
        io.to(roomId).emit("playerWon", {
          message: `${player.userName} has won the game!`,
          winnerId: player.userId,
        });
  
        delete activeGames[roomId];
        return;
      }
  
      // Regular turn logic
      player.drawn = false;
      player.discarded = false;
  
      // Update the current player index
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 1) % game.players.length;
      const nextPlayer = game.players[game.currentPlayerIndex];
  
      // Notify the next player
      io.to(nextPlayer.socketId).emit("turnEnded", {
        message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
        currentPlayerId: nextPlayer.userId,
      });
  
      io.to(nextPlayer.socketId).emit("yourTurn", {
        message: `It's your turn, ${nextPlayer.userName}!`,
      });
  
      console.log("Discarded:", card, "by", player.userName);
    } catch (error) {
      console.error("Discard card error:", error);
      socket.emit("turnError", { message: "Failed to discard card" });
    }
  });



  // socket.on("endTurn", ({ roomId }) => {
  //   try {
  //     const game = activeGames[roomId];
  //     if (!game) {
  //       socket.emit("error", { message: "Game not found." });
  //       return;
  //     }

  //     const currentPlayer = game.players[game.currentPlayerIndex];
  //     if (!currentPlayer) {
  //       socket.emit("error", { message: "Player not found." });
  //       return;
  //     }

  //     if (!currentPlayer.drawn) {
  //       socket.emit("turnError", {
  //         message: "You must draw a card before ending your turn.",
  //       });
  //       return;
  //     }

  //     if (!currentPlayer.discarded) {
  //       socket.emit("turnError", {
  //         message: "You must discard a card before ending your turn.",
  //       });
  //       return;
  //     }

  //     clearTimeout(game.turnTimer);
  //     clearTimeout(game.warningTimer);

  //     currentPlayer.drawn = false;
  //     currentPlayer.discarded = false;

  //     game.currentPlayerIndex =
  //       (game.currentPlayerIndex + 1) % game.players.length;
  //     const nextPlayer = game.players[game.currentPlayerIndex];

  //     // Start timer for next player
  //     startTurnTimer(io, roomId, activeGames);

  //     io.to(roomId).emit("turnEnded", {
  //       message: `Turn ended for ${currentPlayer.userName}. Now it's ${nextPlayer.userName}'s turn`,
  //       currentPlayerId: nextPlayer.userId,
  //       timeLeft: TURN_DURATION_SECONDS,
  //     });

  //     io.to(nextPlayer.socketId).emit("yourTurn", {
  //       message: `It's your turn, ${nextPlayer.userName}!`,
  //       timeLeft: TURN_DURATION_SECONDS,
  //     });
  //   } catch (error) {
  //     console.error("Error in endTurn:", error);
  //     socket.emit("error", { message: "An unexpected error occurred" });
  //   }
  // });

  // socket.on("endTurn", ({ roomId }) => {
  //   try {

  //     const game = activeGames[roomId];

  //     if (!game) {
  //       socket.emit("error", { message: "Game not found." });
  //       return;
  //     }

  //     const currentPlayer = game.players[game.currentPlayerIndex];
  //     if (!currentPlayer) {
  //       socket.emit("error", { message: "Player not found." });
  //       return;
  //     }

  //     if (currentPlayer.socketId !== socket.id) {
  //       socket.emit("error", { message: "It's not your turn." });
  //       return;
  //     }

  //     if (!currentPlayer.drawn) {
  //       socket.emit("turnError", {
  //         message: "You must draw a card before ending your turn.",
  //       });
  //       return;
  //     }

  //     if (!currentPlayer.discarded) {
  //       socket.emit("turnError", {
  //         message: "You must discard a card before ending your turn.",
  //       });
  //       return;
  //     }

  //     // clearTimeout(game.turnTimer);
  //     // clearTimeout(game.warningTimer);

  //     currentPlayer.drawn = false;
  //     currentPlayer.discarded = false;

  //     game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  //     const nextPlayer = game.players[game.currentPlayerIndex];

  //     // startTurnTimer(io, roomId, activeGames);

  //     console.log("Turn ended for:", currentPlayer.userName, currentPlayer.socketId);
  //     console.log("Next turn for:", nextPlayer.userName, nextPlayer.socketId);

  //     io.to(nextPlayer.socketId).emit("turnEnded", {
  //       message: `Turn ended for ${currentPlayer.userName}. Now it's ${nextPlayer.userName}'s turn`,
  //       currentPlayerId: nextPlayer.userId,
  //       // timeLeft: TURN_DURATION_SECONDS,
  //     });

  //     io.to(nextPlayer.socketId).emit("yourTurn", {
  //       message: `It's your turn, ${nextPlayer.userName}!`,
  //       // timeLeft: TURN_DURATION_SECONDS,
  //     });
  //   } catch (error) {
  //     console.error("Error in endTurn:", error);
  //     socket.emit("error", { message: "An unexpected error occurred" });
  //   }
  // });

  // socket.on("endTurn", () => {

  //   try {
  //     // 1. Auth check
  //     if (!socket.user?._id) {
  //       return socket.emit("error", { message: "Unauthorized access." });
  //     }

  //     // 2. Get room ID from joined rooms
  //     const roomId = Array.from(socket.rooms).find((room) => room !== socket.id);
  //     if (!roomId || !activeGames[roomId]) {
  //       return socket.emit("error", { message: "You're not in an active game." });
  //     }

  //     const game = activeGames[roomId];
  //     const userId = socket.user._id;

  //     const currentPlayer = game.players[game.currentPlayerIndex];
  //     if (!currentPlayer || currentPlayer.userId !== userId) {
  //       return socket.emit("turnError", { message: "It's not your turn." });
  //     }

  //     if (!currentPlayer.drawn) {
  //       return socket.emit("turnError", {
  //         message: "You must draw a card before ending your turn.",
  //       });
  //     }

  //     if (!currentPlayer.discarded) {
  //       return socket.emit("turnError", {
  //         message: "You must discard a card before ending your turn.",
  //       });
  //     }

  //     // Reset current player turn state
  //     currentPlayer.drawn = false;
  //     currentPlayer.discarded = false;

  //     // Move to next player
  //     game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  //     const nextPlayer = game.players[game.currentPlayerIndex];

  //     // Emit events
  //     console.log("Turn ended for:", currentPlayer.userName, currentPlayer.socketId);
  //     console.log("Next turn for:", nextPlayer.userName, nextPlayer.socketId);

  //     io.to(nextPlayer.socketId).emit("turnEnded", {
  //       message: `Turn ended for ${currentPlayer.userName}. Now it's ${nextPlayer.userName}'s turn`,
  //       currentPlayerId: nextPlayer.userId,
  //     });

  //     io.to(nextPlayer.socketId).emit("yourTurn", {
  //       message: `It's your turn, ${nextPlayer.userName}!`,
  //     });

  //   } catch (error) {
  //     console.error("Error in endTurn:", error);
  //     socket.emit("error", { message: "An unexpected error occurred" });
  //   }
  // });

  // socket.on("endGame", ({ roomId }) => {
  //   try {
  //     const game = activeGames[roomId];
  //     if (!game) {
  //       socket.emit("error", { message: "Game not found." });
  //       return;
  //     }

  //     // clearTimeout(game.turnTimer);
  //     // clearTimeout(game.warningTimer);
  //     delete activeGames[roomId];

  //     io.to(roomId).emit("gameEnded", {
  //       message: "Game has been ended.",
  //     });

  //     console.log(`Game ended and cleaned up for room: ${roomId}`);
  //   } catch (error) {
  //     console.error("Error in endGame:", error);
  //     socket.emit("error", { message: "An unexpected error occurred" });
  //   }
  // });



  socket.on("endGame", () => {
    try {
      // 1. Auth check
      if (!socket.user?._id) {
        return socket.emit("error", { message: "Unauthorized access." });
      }

      // 2. Get room ID from joined rooms
      const roomId = Array.from(socket.rooms).find(
        (room) => room !== socket.id
      );
      if (!roomId || !activeGames[roomId]) {
        return socket.emit("error", { message: "Game not found." });
      }

      const game = activeGames[roomId];

      // clearTimeout(game.turnTimer);
      // clearTimeout(game.warningTimer);

      delete activeGames[roomId];

      io.to(roomId).emit("gameEnded", {
        message: "Game has been ended.",
      });

      console.log(`Game ended and cleaned up for room: ${roomId}`);
    } catch (error) {
      console.error("Error in endGame:", error);
      socket.emit("error", { message: "An unexpected error occurred" });
    }
  });


  // socket.on("layDownMelds", ({ roomId, playerId, melds }) => {
  //   try {
  //     const game = activeGames[roomId];

  //     if (!game) {
  //       socket.emit("error", { message: "Game not found." });
  //       return;
  //     }

  //     const player = game.players.find((p) => p.userId === playerId);
  //     if (!player) {
  //       socket.emit("error", { message: "Player not found." });
  //       return;
  //     }

  //     if (game.players[game.currentPlayerIndex].userId !== playerId) {
  //       socket.emit("turnError", { message: "It's not your turn." });
  //       return;
  //     }

  //     if (!Array.isArray(melds) || melds.length === 0) {
  //       socket.emit("error", { message: "Invalid melds format." });
  //       return;
  //     }

  //     for (const meld of melds) {
  //       if (!isValidMeld(meld)) {
  //         socket.emit("error", { message: "Invalid meld detected." });
  //         return;
  //       }
  //     }

  //     melds.flat().forEach((card) => {
  //       const index = player.hand.indexOf(card);
  //       if (index !== -1) {
  //         player.hand.splice(index, 1);
  //       }
  //     });

  //     if (!player.melds) {
  //       player.melds = [];
  //     }

  //     player.melds.push(...melds);

  //     if (player.hand.length === 0) {
  //       console.log(
  //         "Player has no cards left after melds! Declaring winner:",
  //         playerId
  //       );

  //       player.score = 0;

  //       game.players.forEach((p) => {
  //         if (p.userId !== playerId) {
  //           p.score = calculatePenaltyPoints(p.hand);
  //         }
  //       });

  //       io.to(roomId).emit("gameOver", {
  //         winner: playerId,
  //         scores: game.players.map((p) => ({
  //           playerId: p.userId,
  //           score: p.score,
  //         })),
  //       });

  //       // clearTimeout(game.turnTimer);
  //       // clearTimeout(game.warningTimer);
  //       cleanupTimers(roomId);
  //       delete activeGames[roomId];

  //       return;
  //     }

  //     io.to(roomId).emit("meldsLaidDown", {
  //       playerId,
  //       melds: player.melds,
  //     });
  //   } catch (error) {
  //     console.error("Error in layDownMelds event:", error);
  //     socket.emit("error", { message: "An unexpected error occurred." });
  //   }
  // });



  socket.on("layDownMelds", ({ melds }) => {
    console.log("Received meld:", melds);
    console.log("Socket userId:", socket.userId);
    console.log("Socket roomId:", socket.roomId);
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
        socket.emit("error", { message: "Invalid melds format." });
        return;
      }

      for (const meld of melds) {
        if (!isValidMeld(meld)) {
          socket.emit("error", { message: "Invalid meld detected." });
          return;
        }
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

      if (player.hand.length === 0) {
        console.log(
          "Player has no cards left after melds! Declaring winner:",
          playerId
        );
        player.score = 0;

        game.players.forEach((p) => {
          if (p.userId !== playerId) {
            p.score = calculatePenaltyPoints(p.hand);
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
      socket.emit("error", { message: "An unexpected error occurred." });
    }
  });





  socket.on("disconnect", () => {
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
          delete activeGames[roomId]; // Clean up
        } else if (game.players.length === 0) {
          delete activeGames[roomId]; // No one left
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
};
