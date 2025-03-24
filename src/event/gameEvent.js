const { createDeck, shuffleDeck } = require("../utils/deckUtils");

module.exports = (io, socket) => {
  const activeGames = {};

  // ======================== joinRoom Event Handler ======================== >

  socket.on("joinRoom", ({ roomId, userId, userName }) => {
    if (!userId || !userName) {
      socket.emit("error", {
        message: "Invalid data. userId and userName are required.",
      });
      return;
    }

    if (!roomId) {
      for (const [existingRoomId, game] of Object.entries(activeGames)) {
        if (game.players.length < 2) {
          roomId = existingRoomId;
          break;
        }
      }

      if (!roomId) {
        roomId = `room_${Object.keys(activeGames).length + 1}`;
        activeGames[roomId] = { players: [] };
      }
    }

    console.log(`User ${userName} (${userId}) is joining room: ${roomId}`);

    socket.join(roomId);

    if (!activeGames[roomId]) {
      activeGames[roomId] = { players: [] };
    }

    if (activeGames[roomId].players.length < 2) {
      activeGames[roomId].players.push({ userId, userName });

      io.to(roomId).emit("userJoined", {
        roomId,
        userId,
        userName,
        message: `${userName} has joined the room.`,
      });

      socket.emit("joinedRoom", {
        roomId,
        message: `You have joined room: ${roomId}`,
        players: activeGames[roomId].players,
      });
    } else {
      socket.emit("error", { message: "Room is full." });
      socket.leave(roomId);
    }
  });

  // ======================== startGame Event Handler ======================== >
  socket.on("startGame", ({ roomId }) => {
    if (!roomId) {
      socket.emit("error", {
        message: "roomId is required to start the game.",
      });
      return;
    }

    if (!activeGames[roomId]) {
      socket.emit("error", {
        message: "Room not found. Players must join first.",
      });
      return;
    }

    const game = activeGames[roomId];

    // Check if there are at least 2 players
    if (game.players.length < 2) {
      socket.emit("error", {
        message: "At least 2 players are required to start the game.",
      });
      return;
    }

    game.deck = createDeck();
    game.deck = shuffleDeck(game.deck);
    game.discardPile = [game.deck.pop()];
    game.currentPlayerIndex = 0;

    // Deal 13 cards
    game.players.forEach((player) => {
      player.hand = game.deck.splice(0, 13);
    });
    console.log(`Game started in room: ${roomId}`);

    io.to(roomId).emit("gameStarted", {
      message: "Game has started!",
      players: game.players,
      discardPile: game.discardPile,
      currentPlayerIndex: game.currentPlayerIndex,
    });
  });

  // ======================== drawCard Event ======================== >

  socket.on("drawCard", ({ roomId, playerId, drawFrom }) => {
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

    let drawnCard;

    if (drawFrom === "deck") {
      if (game.deck.length === 0) {
        socket.emit("error", { message: "Deck is empty." });
        return;
      }
      drawnCard = game.deck.shift();
    } else if (drawFrom === "discard") {
      if (game.discardPile.length === 0) {
        socket.emit("error", { message: "Discard pile is empty." });
        return;
      }
      drawnCard = game.discardPile.pop();
    } else {
      socket.emit("error", { message: "Invalid draw source." });
      return;
    }

    player.hand.push(drawnCard);

    io.to(roomId).emit("cardDrawn", {
      playerId,
      drawnCard,
      playerHand: player.hand,
      deckSize: game.deck.length,
      discardPile: game.discardPile,
    });
  });

  // ======================== cardDisCarded from the user Event ======================== >

  socket.on("discardCard", ({ roomId, playerId, card }) => {
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

    const cardIndex = player.hand.findIndex((c) => c === card);
    if (cardIndex === -1) {
      socket.emit("error", { message: "Card not found in player's hand." });
      return;
    }

    const discardedCard = player.hand.splice(cardIndex, 1)[0];
    game.discardPile.push(discardedCard);

    io.to(roomId).emit("cardDiscarded", {
      playerId,
      discardedCard,
      playerHand: player.hand,
      discardPile: game.discardPile,
    });
  });

  // ======================== endTurn Event Handler ======================== >

  socket.on("endTurn", ({ roomId, playerId }) => {
    // Retrieve the game instance based on the roomId
    
    const game = activeGames[roomId];

    if (!game) {
      socket.emit("error", { message: "Game not found." });
      return;
    }
  
    // Find the player based on playerId
    const player = game.players.find((p) => p.userId === playerId);
  
    // If the player is not found, emit an error message but don't disconnect
    if (!player) {
      socket.emit("error", { message: "Player not found." });
      return;
    }
  
    // Check if it is the current player's turn
    if (game.players[game.currentPlayerIndex].userId !== playerId) {
      // If it's not the player's turn, emit an error message but don't disconnect
      socket.emit("error", { message: "It's not your turn." });
      return;
    }
  
    // Proceed to the next player's turn
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  
    // Get the next player
    const nextPlayer = game.players[game.currentPlayerIndex];
  
    // Emit a "turnEnded" event to all players in the room, notifying them of the turn change
    io.to(roomId).emit("turnEnded", {
      message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn.`,
      currentPlayerId: nextPlayer.userId,
    });
  
    // Optionally log the turn change for debugging
    console.log(`Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn.`);
  });

};
