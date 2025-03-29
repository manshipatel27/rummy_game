const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const { isValidMeld, calculatePenaltyPoints } = require("../utils/isValidMeld");


const activeGames = {};

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



socket.on("startGame", ({ roomId }) => {
  try {
    console.log("Starting game for room:", roomId); // Debug log
    console.log("Active games:", activeGames); // Debug log

    if (!activeGames[roomId]) {
      socket.emit("error", { message: "Room not found." });
      return;
    }

    const game = activeGames[roomId];
    console.log("Players in room:", game.players); // Debug log

    if (game.players.length < 2) {
      socket.emit("error", { 
        message: "At least 2 players are required to start the game." 
      });
      return;
    }

    // Initialize game state
    game.deck = createDeck();
    game.deck = shuffleDeck(game.deck);
    game.discardPile = [game.deck.pop()];
    game.currentPlayerIndex = 0;

    // Deal cards to players
    game.players.forEach((player) => {
      player.hand = game.deck.splice(0, 13);
      
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
        handSize: 13
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

    if (game.players[game.currentPlayerIndex].userId !== playerId) {
      socket.emit("turnError", { message: "It's not your turn." });
      return;
    }

    let drawnCard;

    if (drawFrom === "deck") {
      if (game.deck.length === 0) {
        socket.emit("error", { message: "No Cards, Deck is empty." });
        return;
      }
      drawnCard = game.deck.shift();
    } else if (drawFrom === "discard") {
      if (game.discardPile.length === 0) {
        socket.emit("error", { message: "Discard pile is empty." });
        return;
      }

      /*   Testing part for the DiscardPile. ===============  Pop or the Shift Method  ===============>    */


      // drawnCard = game.discardPile.pop();
      drawnCard = game.discardPile.shift();

    } else {
      socket.emit("error", { message: "Invalid draw source." });
      return;
    }
  
    player.drawn = true;
    player.hand.push(drawnCard);

    io.to(roomId).emit("cardDrawn", {
      playerId,
      drawnCard,
      playerHand: player.hand,
      deckSize: game.deck.length,
      discardPile: game.discardPile,
    });
  });

  // ======================== cardDiscarded from the user Event ======================== >

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

    if (game.players[game.currentPlayerIndex].userId !== playerId) {
      socket.emit("turnError", { message: "It's not your turn." });
      return;
    }

    const cardIndex = player.hand.findIndex((c) => c === card);
    if (cardIndex === -1) {
      socket.emit("error", { message: "Card not found in player's hand." });
      return;
    }

    const discardedCard = player.hand.splice(cardIndex, 1)[0];
    game.discardPile.push(discardedCard);
     
    
     player.discarded = true;

    io.to(roomId).emit("cardDiscarded", {
      playerId,
      discardedCard,
      playerHand: player.hand,
      discardPile: game.discardPile,
    });
  });

  // ======================== endTurn Event Handler ======================== > 

  socket.on("endTurn", ({ roomId, playerId }) => {
    const game = activeGames[roomId];
    console.log("Received endTurn event:", { roomId, playerId });

    if (!game) {
        socket.emit("error", { message: "Game not found." });
        return;
    }

    const currentPlayer = game.players.find((p) => p.userId === playerId);

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

    io.to(roomId).emit("turnEnded", {
        message: `Turn ended for ${currentPlayer.userName}. Now it's ${nextPlayer.userName}'s turn.`,
        currentPlayerId: nextPlayer.userId,
    });
})


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
//     player.score = (player.score || 0) + points; //

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
      playerHand: player.hand,
    });
  } catch (error) {
    console.error("Error in layDownMelds event:", error);
    socket.emit("error", { message: "An unexpected error occurred." });
  }
});
};
  