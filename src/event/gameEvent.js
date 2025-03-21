const { createDeck, shuffleDeck } = require("../utils/deckUtils");

module.exports = (io, socket) => {
  const activeGames = {};

  // ========================  joinRoom Event Handler  ======================== >

  //   socket.on("joinRoom", ({ roomId, userId, userName }) => {
  //     if (!userId || !userName) {
  //       socket.emit("error", {
  //         message: "Invalid data. userId and userName are required.",
  //       });
  //       return;
  //     }

  //     // If no roomId is provided, find an existing room with space
  //     if (!roomId) {
  //       for (const [existingRoomId, game] of Object.entries(activeGames)) {
  //         if (game.players.length < 2) {
  //           roomId = existingRoomId;
  //           break;
  //         }
  //       }

  //       // If no available room, create a new one
  //       if (!roomId) {
  //         roomId = `room_${Object.keys(activeGames).length + 1}`;
  //         activeGames[roomId] = { players: [] };
  //       }
  //     }

  //     console.log(`User ${userName} (${userId}) is joining room: ${roomId}`);

  //     socket.join(roomId);

  //     // Track users in the room, with room limit check
  //     if (!activeGames[roomId]) {
  //       activeGames[roomId] = { players: [] };
  //     }

  //     if (activeGames[roomId].players.length < 2) {
  //       activeGames[roomId].players.push({ userId, userName });

  //       // Notify all players in the room (including sender)
  //       io.to(roomId).emit("userJoined", {
  //         roomId,
  //         userId,
  //         userName,
  //         message: `${userName} has joined the room.`,
  //       });

  //       // Send confirmation to the joining user
  //       socket.emit("joinedRoom", {
  //         roomId,
  //         message: `You have joined room: ${roomId}`,
  //         players: activeGames[roomId].players,
  //       });
  //     } else {
  //       socket.emit("error", { message: "Room is full." });
  //       // socket.leave(roomId);
  //     }

  //   // ========================  startGame Event Handler  ======================== >

  //   socket.on("startGame", ({ roomId }) => {
  //     if (!roomId) {
  //         socket.emit("error", { message: "roomId is required to start the game." });
  //         return;
  //     }

  //     // Check if the room exists
  //     if (!activeGames[roomId]) {
  //         socket.emit("error", { message: "Room not found. Players must join first." });
  //         return;
  //     }

  //     const game = activeGames[roomId];

  //     // Check if there are at least 2 players
  //     if (game.players.length < 2) {
  //         socket.emit("error", { message: "At least 2 players are required to start the game." });
  //         return;
  //     }

  //     game.deck = createDeck();
  //     game.deck = shuffleDeck(game.deck);

  //     // Deal 13 cards to each player at the start
  //     for (const player of game.players) {
  //         player.hand = game.deck.splice(0, 13);
  //     }

  //     console.log(`Game started in room: ${roomId}`);

  //     // Send game start event to all players in the room
  //     io.to(roomId).emit("gameStarted", {
  //         message: "Game has started!",
  //         players: game.players,
  //     });
  // });

  //   // // Draw Card Event
  //   // socket.on("drawCard", ({ roomId, playerId }) => {
  //   //   const game = activeGames[roomId];

  //   //   if (!game) {
  //   //     socket.emit("error", { message: "Game not found." });
  //   //     return;
  //   //   }

  //   //   if (!game.players[playerId]) {
  //   //     socket.emit("error", { message: "Player not found." });
  //   //     return;
  //   //   }

  //   //   if (game.deck.length === 0) {
  //   //     socket.emit("error", { message: "Deck is empty, no more cards to draw." });
  //   //     return;
  //   //   }

  //   //   // Draw the top card from the deck
  //   //   const drawnCard = game.deck.shift();
  //   //   game.players[playerId].hand.push(drawnCard);

  //   //   // Send updated hand to the player
  //   //   socket.emit("cardDrawn", {
  //   //     drawnCard,
  //   //     remainingDeckSize: game.deck.length,
  //   //     playerHand: game.players[playerId].hand,
  //   //   });

  //   //   console.log(`Player ${playerId} drew a card: ${drawnCard}`);
  //   // });

  //   });


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
        activeGames[roomId].players.push({userId, userName });

        
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

    // ======================== Draw Card Event ======================== >
  
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
  };

