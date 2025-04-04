const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const { isValidMeld, calculatePenaltyPoints } = require("../utils/isValidMeld");


const activeGames = {};

const isValidString = (param) => typeof param === 'string' && param.trim() !== '';


module.exports = (io, socket) => {
  
  // ======================== joinRoom Event Handler ======================== >

  /* codeeeeeeeee 

  // socket.on("joinRoom", ({ roomId, userId, userName }) => {
  //   if (!userId || !userName) {
  //     socket.emit("error", {
  //       message: "Invalid data. userId and userName are required.",
  //     });
  //     return;
  //   }

  //   if (!roomId) { 
  //     for (const [existingRoomId, game] of Object.entries(activeGames)) {
  //       if (game.players.length < 2) {
  //         roomId = existingRoomId;
  //         break;
  //       }
  //     }

  //     if (!roomId) {
  //       roomId = `room_${Object.keys(activeGames).length + 1}`;
  //       activeGames[roomId] = { players: [] };
  //     }
  //   }

  //   console.log(`User ${userName} (${userId}) is joining room: ${roomId}`);

  //   socket.join(roomId);

  //   if (!activeGames[roomId]) {
  //     activeGames[roomId] = { players: [] };
  //   }

  //   if (activeGames[roomId].players.length < 2) {
  //     activeGames[roomId].players.push({ userId, userName });

  //     io.to(roomId).emit("userJoined", {
  //       userId,
  //       userName,
  //       message: `${userName} has joined the room.`,
  //     });

  //     socket.emit("joinedRoom", {
  //       roomId,
  //       message: `You have joined room: ${roomId}`,
  //       players: activeGames[roomId].players,
  //     });
  //   } else {
  //     socket.emit("error", { message: "Room is full." });
  //     socket.leave(roomId);
  //   }
  // });


  */
//   ======================== C ??? joinRoom  ========================>>>
  socket.on("joinRoom", ({ roomId, userId, userName }) => {
    try {
      // Validate required parameters
      if (!isValidString(roomId) || !isValidString(userId) || !isValidString(userName)) {
        socket.emit("error", { message: "Invalid parameters provided." });
        return;
      }

      console.log(`User ${userName} (${userId}) is joining room: ${roomId}`);
      // console.log("Current active games:", activeGames); 
      socket.join(roomId);

      if (!activeGames[roomId]) {
        activeGames[roomId] = { players: [], started: false };
      }
      
      const game = activeGames[roomId];

          if (game.players.find(p => p.userId === userId)) {
            socket.emit("error", { message: "User already joined the room." });
            return;
          }

      const MAX_PLAYERS = 4;
      
      if (game.players.length >= MAX_PLAYERS) {
        socket.emit("error", { message: "Room is full." });
        return;
      }    
          game.players.push({
            userId,
            userName,
            socketId: socket.id
          });

      io.to(roomId).emit("userJoined", {
        userId,
        userName,
        message: `${userName} has joined the room.`,
      });

      // Emit to everyone in the room
      io.to(roomId).emit("joinedRoom", {
        roomId,
        message: `${userName} has joined room: ${roomId}`,
        players: activeGames[roomId].players,
      });

      console.log(`Room ${roomId} players:`, activeGames[roomId].players); 
    } catch (error) {
      console.error("Error in joinRoom:", error);
      socket.emit("error", { message: "An unexpected error occurred" });
    }
  });

  socket.on("startGame", ({ roomId }) => {
    try {
      console.log("Starting game for room:", roomId); 
      console.log("Active games:", activeGames); 
  
      if (!isValidString(roomId)) {
        socket.emit("error", { message: "Invalid room ID." });
        return;
      }
      console.log("Starting game for room:", roomId);
  
      if (!activeGames[roomId]) {
        socket.emit("error", { message: "Room not found." });
        return;
      }
  
      const game = activeGames[roomId];
      console.log("Players in room:", game.players); 
  
  
      if (game.started) {
        socket.emit("error", { message: "Game has already started." });
        return;
      }
  
  
      if (game.players.length < 2) {
        socket.emit("error", { 
          message: "At least 2 players are required to start the game." 
        });
        return;
      }
  
      game.started = true;
  
      let deck = createDeck();
      deck = shuffleDeck(deck);
      game.deck = deck;

      let cardsPerPlayer;

      if (game.players.length === 2) {
        cardsPerPlayer = 13;
      } else if (game.players.length <= 4) {
        cardsPerPlayer = 10;
      } else {
        cardsPerPlayer = 7;
      }
  
      if (game.deck.length < game.players.length * cardsPerPlayer + 1) { 
        socket.emit("error", { message: "Not enough cards in deck to start the game." });
        return;
      }

      do {
        game.discardPile = [game.deck.pop()];
    } while (game.discardPile[0] === "🃏"); 
  
        // game.discardPile = [game.deck.pop()];

        game.currentPlayerIndex = 0;
  
  
      // Deal cards to players
      game.players.forEach((player) => {
        player.hand = game.deck.splice(0, cardsPerPlayer);
        
        // Send private hand information to each player
        io.to(player.socketId).emit("playerHand", {
          hand: player.hand
        });
      });
  
  
      // Send public game state to all players
      io.to(roomId).emit("gameStarted", {
        message: "Game has started!",
        players: game.players.map(p => ({
          userId: p.userId,
          userName: p.userName,
          handSize: cardsPerPlayer
        })),
        discardPile: game.discardPile,
        currentPlayerIndex: game.currentPlayerIndex,
      });
  
      console.log(`Game successfully started in room: ${roomId}`);
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("error", { message: "An unexpected error occurred" });
    }
  });


  // ======================== startGame Event Handler ======================== >
  // socket.on("startGame", ({ roomId }) => {
  //   if (!roomId) {
  //     socket.emit("error", {
  //       message: "roomId is required to start the game.",
  //     });
  //     return;6
  //   }

  //   if (!activeGames[roomId]) {
  //     socket.emit("error", {
  //       message: "Room not found. Players must join first.",
  //     });
  //     return;
  //   }

  //   const game = activeGames[roomId];

  //   // Check if there are at least 2 players
  //   if (game.players.length < 2) {
  //     socket.emit("error", {
  //       message: "At least 2 players are required to start the game.",
  //     });
  //     return;
  //   }

  //   game.deck = createDeck();
  //   game.deck = shuffleDeck(game.deck);
  //   game.discardPile = [game.deck.pop()];
  //   game.currentPlayerIndex = 0;

  //   // Deal 13 cards
  //   game.players.forEach((player) => {
  //     player.hand = game.deck.splice(0, 13);
  //   });
  //   console.log(`Game started in room: ${roomId}`);

  //   io.to(roomId).emit("gameStarted", {
  //     message: "Game has started!",
  //     players: game.players,
  //     discardPile: game.discardPile,
  //     currentPlayerIndex: game.currentPlayerIndex,
  //   });
  // });



// ============================ CurosrstartGame Event  ============================>>>> 

  // socket.on("startGame", ({ roomId }) => {
  // try {
  //   console.log("Starting game for room:", roomId); 
  //   console.log("Active games:", activeGames); 

  //   if (!isValidString(roomId)) {
  //     socket.emit("error", { message: "Invalid room ID." });
  //     return;
  //   }
  //   console.log("Starting game for room:", roomId);

  //   if (!activeGames[roomId]) {
  //     socket.emit("error", { message: "Room not found." });
  //     return;
  //   }

  //   const game = activeGames[roomId];
  //   console.log("Players in room:", game.players); 


  //   if (game.started) {
  //     socket.emit("error", { message: "Game has already started." });
  //     return;
  //   }


  //   if (game.players.length < 2) {
  //     socket.emit("error", { 
  //       message: "At least 2 players are required to start the game." 
  //     });
  //     return;
  //   }

  //   game.started = true;

  //   // Initialize game state
  //   // game.deck = createDeck();
  //   // game.deck = shuffleDeck(game.deck);
  //   // game.discardPile = [game.deck.pop()];
  //   // game.currentPlayerIndex = 0;

  //   let deck = createDeck();
  //   deck = shuffleDeck(deck);
  //   game.deck = deck;


  //   const cardsPerPlayer = 13;
  //     if (game.deck.length < game.players.length * cardsPerPlayer + 1) { 
  //       socket.emit("error", { message: "Not enough cards in deck to start the game." });
  //       return;
  //     }

  //     game.discardPile = [game.deck.pop()];
  //     game.currentPlayerIndex = 0;


  //   // Deal cards to players
  //   game.players.forEach((player) => {
  //     player.hand = game.deck.splice(0, cardsPerPlayer);
      
  //     // Send private hand information to each player
  //     io.to(player.socketId).emit("playerHand", {
  //       hand: player.hand
  //     });
  //   });


  //   // Send public game state to all players
  //   io.to(roomId).emit("gameStarted", {
  //     message: "Game has started!",
  //     players: game.players.map(p => ({
  //       userId: p.userId,
  //       userName: p.userName,
  //       handSize: cardsPerPlayer
  //     })),
  //     discardPile: game.discardPile,
  //     currentPlayerIndex: game.currentPlayerIndex,
  //   });

  //   console.log(`Game successfully started in room: ${roomId}`);
  // } catch (error) {
  //   console.error("Error in startGame:", error);
  //   socket.emit("error", { message: "An unexpected error occurred" });
  // }
  // });

  // ======================== drawCard Event ======================== >

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

  //   let drawnCard;

  //   if (drawFrom === "deck") {
  //     if (game.deck.length === 0) {
  //       socket.emit("error", { message: "No Cards, Deck is empty." });
  //       return;
  //     }
  //     drawnCard = game.deck.shift();
  //   } else if (drawFrom === "discard") {
  //     if (game.discardPile.length === 0) {
  //       socket.emit("error", { message: "Discard pile is empty." });
  //       return;
  //     }

  //     /*   Testing part for the DiscardPile. ===============  Pop or the Shift Method  ===============>    */


  //    // drawnCard = game.discardPile.pop();
  //     drawnCard = game.discardPile.shift();

  //   } else { 
  //     socket.emit("error", { message: "Invalid draw source." });
  //     return;
  //   }
  
  //   player.drawn = true;
  //   player.hand.push(drawnCard);

    
  //     io.to(player.socketId).emit("cardDrawn", {
  //     playerId,
  //     drawnCard,
  //     playerHand: player.hand,
  //     deckSize: game.deck.length,
  //     discardPile: game.discardPile,
  //   });
  // });


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
  
    if (game.players[game.currentPlayerIndex].userId !== playerId) {
        socket.emit("turnError", { message: "It's not your turn." });
        return;
    }
  
    if (player.drawn) {
        socket.emit("AlreadyDrawnCard", { message: "You have already selected a card." });
        return;
    }
  
    let drawnCard;
  
    if (game.deck.length === 0 && game.discardPile.length > 1) {
        console.log("Deck is empty. Automatically reshuffling discard pile...");
        const reshufflePile = game.discardPile.slice(0, -1);
        game.deck = shuffleDeck(reshufflePile);
        game.discardPile = [game.discardPile[game.discardPile.length - 1]];
  
        io.to(roomId).emit("deckReshuffled", {
            message: "The discard pile has been reshuffled into the deck.",
        });
    }
  
    if (drawFrom === "deck") {
        if (game.deck.length === 0) {
            socket.emit("error", { message: "No cards left to draw." });
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
  
    player.drawn = true;
    player.hand.push(drawnCard);
  
    // Send updated hand to the player who drew the card
    io.to(player.socketId).emit("cardDrawn", {
        playerId,
        drawnCard,
        playerHand: player.hand,
        deckSize: game.deck.length,
        discardPile: game.discardPile,
    });
  
    // Broadcast updated discard pile to all players if drawn from discard
    if (drawFrom === "discard") {
        io.to(roomId).emit("updateDiscardPile", { discardPile: game.discardPile });
    }
  });



  // ======================== cardDiscarded from the user Event ======================== >

  // socket.on("discardCard", ({ roomId, playerId, card }) => {
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

  //   const cardIndex = player.hand.findIndex((c) => c === card);
  //   if (cardIndex === -1) {
  //     socket.emit("error", { message: "Card not found in player's hand." });
  //     return;
  //   }

  //   const discardedCard = player.hand.splice(cardIndex, 1)[0];
  //   game.discardPile.push(discardedCard);
     
    
  //    player.discarded = true;

  //   io.to(roomId).emit("cardDiscarded", {
  //     playerId,
  //     discardedCard,
  //     playerHand: player.hand,
  //     discardPile: game.discardPile,
  //   });

  //   io.to(roomId).emit("updateGameState", {
  //     currentTurn: game.players[game.currentPlayerIndex].userId,
  //     discardPile: game.discardPile,
  //     players: game.players.map(p => ({
  //       userId: p.userId,
  //       handSize: p.hand.length, 
  //     }))
  //   });


  // });


  socket.on("discardCard", ({ roomId, playerId, card }) => {
    try {
    const game = activeGames[roomId];

    if (!game) {
      socket.emit("error", { message: "Game not found." });
      return;
    }

    const player = game.players.find((p) => p.userId === playerId);

    if (!player) {
      // socket.emit("error", { message: "Player not found." });
      // return;
      throw new Error("Player not found.");
    }

    if (game.players[game.currentPlayerIndex].userId !== playerId) {
      socket.emit("turnError", { message: "It's not your turn." });
      return;
    }

    if (player.discarded) {
      throw new Error("You have already discarded a card");
  }

    const cardIndex = player.hand.findIndex((c) => c === card);
    if (cardIndex === -1) {
      socket.emit("error", { message: "Card not found in player's hand." });
      return;
    }

    const discardedCard = player.hand.splice(cardIndex, 1)[0]; 
    game.discardPile.unshift(discardedCard); 
    
    player.discarded = true;
    
    io.to(player.socketId).emit("cardDiscarded", {
      playerId,
      updatedHand: player.hand,
  });

  // Notify all players about the discarded card
  io.to(roomId).emit("cardDiscarded", {
      playerId,
      discardedCard,
      discardPile: game.discardPile,
  });
   
    io.to(roomId).emit("updateGameState", {
      currentTurn: game.players[game.currentPlayerIndex].userId,
      discardPile: game.discardPile,
      players: game.players.map(p => ({
        userId: p.userId,
        handSize: p.hand.length,
      }))
    });
  } catch (error) {
    console.error("Error in discardCard event:", error.message);
  }
});


  // ======================== endTurn Event Handler ======================== > 

  socket.on("endTurn", ({ roomId, playerId }) => {
    const game = activeGames[roomId];
    // console.log("Received endTurn event:", { roomId, playerId });

    if (!game) {
        socket.emit("error", { message: "Game not found." });
        return;
    }

    const playersMap = new Map();
    game.players.forEach((p) => playersMap.set(p.userId, p));

    // const currentPlayer = game.players.find((p) => p.userId === playerId);

    const currentPlayer = playersMap.get(playerId);

    if (!currentPlayer) {
        socket.emit("error", { message: "Player not found." });
        return;
    }

    if (game.players[game.currentPlayerIndex].userId !== playerId) {
        socket.emit("turnError", { message: "It's not your turn." });
        return;
    }

    if (!currentPlayer.drawn) {
        socket.emit("turnError", { message: "You must draw a card before ending your turn." });
        return; 
    }

    if (!currentPlayer.discarded) {
        socket.emit("turnError", { message: "You must discard a card before ending your turn." });
        return;
    }

    currentPlayer.drawn = false;
    currentPlayer.discarded = false;

    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;

    const nextPlayer = game.players[game.currentPlayerIndex];

    // io.to(roomId).emit("turnEnded", {
    //     message: `Turn ended for ${currentPlayer.userName} Now it's ${nextPlayer.userName}'s turn`,
    //     currentPlayerId: nextPlayer.userId,
    // });

    io.to(currentPlayer.socketId).emit("turnEnded", {
      message: `Your turn is over. Now it's ${nextPlayer.userName}'s turn.`,
      currentPlayerId: nextPlayer.userId,
    });
  
    // Emit "turnEnded" for the next player
    io.to(nextPlayer.socketId).emit("turnEnded", {
      message: `It's your turn, ${nextPlayer.userName}!`,
      currentPlayerId: nextPlayer.userId,
    });



    // optional right now =============== ?????????????  
    if (game.players.length === 1) {
      io.to(roomId).emit("gameOver", { message: "The game is over, as there is only one player left." });
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

//     // Check if it's the player's turn
//     if (game.players[game.currentPlayerIndex].userId !== playerId) {
//       socket.emit("turnError", { message: "It's not your turn." });
//       return;
//     }

//     // Validate the melds format
//     if (!Array.isArray(melds) || melds.length === 0) {
//       socket.emit("error", { message: "Invalid melds format." });
//       return;
//     }

//     // Validate each meld
//     for (const meld of melds) {
//       if (!isValidMeld(meld)) {
//         socket.emit("error", { message: "Invalid meld detected." });
//         return;
//       }
//     }

//     // Remove meld cards from player's hand
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

//     // Calculate the points for the new melds
//     const points = melds.reduce((total, meld) => total + calculateMeldPoints(meld), 0);  
//     player.score = (player.score || 0) + points; 

//     // Emit the event to update the game state for all players in the room
//     io.to(roomId).emit("meldsLaidDown", {
//       playerId,
//       melds: player.melds,
//       playerHand: player.hand,
//       playerScore: player.score,
//     });
  //   } catch (error) {
  //     console.error("Error in layDownMelds event:", error);
  //     socket.emit("error", { message: "An unexpected error occurred." });
  //   }
  // });


socket.on("layDownMelds", ({ roomId, playerId, melds }) => {
  try {
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

    // Validate melds format
    if (!Array.isArray(melds) || melds.length === 0) {
      socket.emit("error", { message: "Invalid melds format." });
      return;
    }

    // Validate each meld
    for (const meld of melds) {
      if (!isValidMeld(meld)) { 
        socket.emit("error", { message: "Invalid meld detected." });
        return;
      }
    }

    melds.flat().forEach((card) => {
      const index = player.hand.indexOf(card);
      if (index !== -1) {
        player.hand.splice(index, 1);
      }
    });

    if (!player.melds) {
      player.melds = [];
    }
    player.melds.push(...melds);

    if (player.hand.length === 0) {
      player.score = 0; 

      game.players.forEach((p) => {
        if (p.userId !== playerId) {
          p.score = calculatePenaltyPoints(p.hand);
        }
      });

      io.to(roomId).emit("gameOver", {
        winner: playerId,
        scores: game.players.map(p => ({ playerId: p.userId, score: p.score })),
      });
      
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

};
  




