const { updateUser } = require("../userService");
const { shuffleDeck, createDeck } = require("./deckUtils");
const TURN_TIMEOUT_MS = 30000;
const TURN_DURATION_SECONDS = TURN_TIMEOUT_MS / 2000;
const WARNING_TIME_MS = 10000;

exports.isValidMeld = (meld, wildCard) => {
  try {
    if (meld.length < 3) {
      console.log("Meld must have at least 3 cards.");
      return false;
    }

    const ranks = [];
    const suits = [];
    let jokerCount = 0;

    const rankOrder = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];

    
    const wildCardRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];

    const nonJokerCards = meld.filter((card) => card !== "🃏");
    const nonJokerSet = new Set(nonJokerCards);
    if (nonJokerSet.size !== nonJokerCards.length) {
      console.log("Duplicate cards are not allowed.");
      return false;
    }

    for (const card of meld) {
      // Special handling for joker
      if (card === "🃏") {
        jokerCount++;
        continue;
      }

      const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
      if (!match) {
        console.log("Invalid card format:", card);
        return false;
      }

      const [, suit, rank] = match;

      // Check if the card is a wild card
      if (rank === wildCardRank) {
        jokerCount++;
      } else {
        if (!rankOrder.includes(rank)) {
          console.log("Invalid card rank:", card);
          return false;
        }        
        ranks.push(rank);
        suits.push(suit);
      }
    }

    console.log("Processed meld:", {
      originalMeld: meld,
      jokerCount,
      ranks,
      suits,
    });

    const uniqueRanks = new Set(ranks);
    const uniqueSuits = new Set(suits);

    // suits in a set are unique (no duplicates allowed)
    const hasUniqueSuits = suits.length === new Set(suits).size;

    const isSet =
      uniqueRanks.size === 1 && // All same rank
      hasUniqueSuits &&
      uniqueSuits.size + jokerCount === meld.length &&
      (meld.length === 3 || meld.length === 4) &&
      ((meld.length === 3 && jokerCount <= 1) ||
        (meld.length === 4 && jokerCount <= 2));

    if (isSet) {
      console.log("Valid Set:", meld);
      return true;
    }

    
    if (
      uniqueSuits.size === 1 ||
      (uniqueSuits.size === 0 && jokerCount === meld.length)
    ) {
      const sortedIndices = ranks
        .map((r) => rankOrder.indexOf(r))
        .sort((a, b) => a - b);

      // Special Q-K-A run check
      const isSpecialQKA =
        meld.length === 3 &&
        ranks.includes("Q") &&
        ranks.includes("K") &&
        ranks.includes("A") &&
        sortedIndices.toString() ===
          [
            rankOrder.indexOf("Q"),
            rankOrder.indexOf("K"),
            rankOrder.indexOf("A"),
          ].toString();

      if (isSpecialQKA && meld.length === 3) {
        console.log("✅ Special Run Q-K-A:", meld);
        return true;
      }

      // Block K-A-2 wraparound
      const hasKA2 =
        ranks.includes("K") && ranks.includes("A") && ranks.includes("2");
      if (hasKA2) {
        console.log("Invalid sequence: K-A-2 is not allowed.");
        return false;
      }

      let gaps = 0;

      // If we have at least one non-joker card
      if (sortedIndices.length > 0) {
        for (let i = 1; i < sortedIndices.length; i++) {
          const diff = sortedIndices[i] - sortedIndices[i - 1];
          if (diff === 0) return false; // Duplicates in run
          if (diff > 1) gaps += diff - 1; // Count missing cards
        }

        if (gaps <= jokerCount) {
          console.log("Valid Run with jokers:", meld);
          return true;
        }
      }
      // Special case: all jokers, which is invalid
      else if (jokerCount === meld.length) {
        console.log("Invalid: Cannot create a meld with only jokers");
        return false;
      }
    }

    console.log("Not a valid Set or Run:", meld);
    return false;
  } catch (error) {
    console.error("Error in isValidMeld:", error);
    return false;
  }
};

exports.calculatePenaltyPoints = (hand, wildCard, playerMelds = []) => {
  try {
    const pointValues = {
      A: 10,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      8: 8,
      9: 9,
      10:10,
      J: 10,
      Q: 10,
      K: 10,
    };

    console.log("Calculating penalty for hand:", hand);
    console.log("Wild card:", wildCard);
    console.log("Player melds:", playerMelds);

    // Flatten all cards from melds
    const meldedCards = new Set(playerMelds.flat().map((card) => card.trim()));
    console.log("Melded cards:", [...meldedCards]);

    
    const unmeldedCards = hand.filter((card) => !meldedCards.has(card.trim()));
    console.log("Unmelded cards for penalty calculation:", unmeldedCards);

    
    const totalPoints = unmeldedCards.reduce((total, card) => {
      if (card === "🃏") {
        console.log("Joker card - 0 points");
        return total + 0; 
      }

      // Check if this is a wild card
      const isWild = isWildCard(card, wildCard);
      if (isWild) {
        console.log(`Wild card ${card} - 50 points`);
        return total + 50;
      }

      const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
      if (!match) {
        console.log("Invalid card format in penalty calculation:", card);
        return total;
      }

      const rank = match[2]; // Changed from match[1] to match[2] - this is crucial!
      console.log(`Card ${card} rank ${rank} - ${pointValues[rank]} points`);
      return total + (pointValues[rank] || 0);
    }, 0);

    console.log("Total penalty points:", totalPoints);
    return Math.min(totalPoints, 80); // Cap penalty points at 80
  } catch (error) {
    console.error("Error calculating penalty points:", error);
    return 0;
  }
};

exports.hasPureSequence = (melds, wildCard) => {
  for (const meld of melds) {
    if (meld.length >= 3 && exports.isSequence(meld, wildCard, true)) {
      return true;
    }
  }
  return false;
};

exports.countSequences = (melds, wildCard) => {
  let sequenceCount = 0;
  for (const meld of melds) {
    if (meld.length >= 3 && exports.isSequence(meld, wildCard, false)) {
      sequenceCount++;
    }
  }
  return sequenceCount;
};

exports.isSequence = (meld, wildCard, pureCheck = false) => {
  const rankOrder = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];

  const ranks = [];
  const suits = [];
  let jokerCount = 0;

  for (const card of meld) {
    if (card === "🃏") {
      if (pureCheck) return false;
      jokerCount++;
    } else if (isWildCard(card, wildCard)) {
      if (pureCheck) return false;
      jokerCount++;
    } else {
      const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
      if (!match) return false;
      const [, suit, rank] = match;
      ranks.push(rank);
      suits.push(suit);
    }
  }

  if (new Set(suits).size > 1) return false;
  if (suits.length === 0) return false;

  const sortedIndices = ranks
    .map((r) => rankOrder.indexOf(r))
    .sort((a, b) => a - b);

  const isSpecialQKA =
    meld.length === 3 &&
    ranks.includes("Q") &&
    ranks.includes("K") &&
    ranks.includes("A") &&
    sortedIndices.toString() ===
      [
        rankOrder.indexOf("Q"),
        rankOrder.indexOf("K"),
        rankOrder.indexOf("A"),
      ].toString();

  if (isSpecialQKA) {
    return pureCheck ? true : true;
  }

  let gaps = 0;
  for (let i = 1; i < sortedIndices.length; i++) {
    const diff = sortedIndices[i] - sortedIndices[i - 1];
    if (diff === 0) return false;
    if (diff > 1) gaps += diff - 1;
  }

  if (pureCheck) {
    return gaps === 0;
  } else {
    return gaps <= jokerCount;
  }
};

function isWildCard(card, wildCard) {
  if (!card || !wildCard) return false;

  if (card === "🃏") return true;

  const wildRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
  const cardRank = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];

  return wildRank === cardRank;
}

exports.handleTurnTimeout = (io, roomId, activeGames) => {
  try {
    const game = activeGames[roomId];
    if (!game || game.gameEnded) return;

    const currentPlayer = game.players[game.currentPlayerIndex];

    // Reset player's turn state
    currentPlayer.drawn = false;
    currentPlayer.discarded = false;

    // Move to the next player
    game.currentPlayerIndex =
      (game.currentPlayerIndex + 1) % game.players.length;
    const nextPlayer = game.players[game.currentPlayerIndex];

    console.log(
      `Turn timeout for ${currentPlayer.userName}. Passing turn to ${nextPlayer.userName}.`
    );

    // Notify all players about the timeout and the next player's turn
    io.to(roomId).emit("timeout", {
      playerId: currentPlayer.userId,
      nextPlayerId: nextPlayer.userId,
      message: `${currentPlayer.userName}'s turn was skipped due to timeout.`,
    });

    // Start the timer for the next player
    startTurnTimer(io, roomId, activeGames);
  } catch (error) {
    console.error(`Error in handleTurnTimeout for room ${roomId}:`, error);
    io.to(roomId).emit("error", {
      message: "Turn timeout failed, please try again.",
    });
  }
};

exports.startTurnTimer = (io, roomId, activeGames) => {
  const game = activeGames[roomId];
  if (!game || game.gameEnded) return;

  clearTimeout(game.turnTimer);
  clearTimeout(game.warningTimer);

  io.to(roomId).emit("turnTimeUpdate", {
    timeLeft: TURN_DURATION_SECONDS,
    currentPlayerId: game.players[game.currentPlayerIndex].userId,
  });

  game.warningTimer = setTimeout(() => {
    if (!game.gameEnded) {
      const currentPlayer = game.players[game.currentPlayerIndex];
      io.to(currentPlayer.socketId).emit("turnWarning", {
        message: "10 seconds remaining!",
        timeLeft: WARNING_TIME_MS / 1000,
      });
    }
  }, TURN_TIMEOUT_MS - WARNING_TIME_MS);

  game.turnTimer = setTimeout(() => {
    if (!game.gameEnded) {
      clearTimeout(game.warningTimer);
      handleTurnTimeout(io, roomId, activeGames);
    }
  }, TURN_TIMEOUT_MS);
};

exports.cleanupTimers = (roomId, activeGames) => {
  const game = activeGames[roomId];
  if (!game) return;

  clearTimeout(game.turnTimer);
  clearTimeout(game.warningTimer);
  game.gameEnded = true;
};

exports.resetGameForNextRound = (game, io, roomId) => {
  const numDecks = game.players.length <= 6 ? 2 : 3 ;
  let deck = shuffleDeck(createDeck(numDecks));
  game.deck = deck;

  const cardsPerPlayer = 13;

  game.players.forEach((player) => {
    player.hand = game.deck.splice(0, cardsPerPlayer);
    player.melds = [];
    player.drawn = false;
    player.discarded = false;
  });

  
  const wildCard = game.deck.pop();
  game.wildCard = wildCard;

  do {
    game.discardPile = [game.deck.pop()];
  } while (game.discardPile[0] === "🃏");

  game.currentPlayerIndex = 0;

  
  game.players.forEach(async (player)  => {
    await updateUser(player.userId, {
      melds: [],
      currentGameStatus: "playing",
    });
    io.to(player.socketId).emit("playerHand", { hand: player.hand });
  });

  io.to(roomId).emit("nextRoundStarted", {
    gameStatus: "nextRound",
    round: game.round,
    message: `Round ${game.round} has started.`,
    players: game.players.map((p) => ({
      userId: p.userId,
      userName: p.userName,
      handSize: cardsPerPlayer,
      score: p.score,
    })),
    discardPile: game.discardPile,
    wildCard: game.wildCard,
    currentPlayerIndex: game.currentPlayerIndex,
  });
};

// exports.checkForWinCondition = async(player, game, roomId, io) => {
//   try {
//     const userId = player.userId;
//     const hasPure = hasPureSequence(player.melds, game.wildCard);
//     const totalSequences = countSequences(player.melds, game.wildCard);

//     if (!hasPure || totalSequences < 2) {
//       const wrongPenalty = Math.min(
//         calculatePenaltyPoints(
//           player.hand.concat(player.melds.flat()),
//           game.wildCard,
//           []
//         ),
//         80
//       );

//       player.score += wrongPenalty;

//       await updateUser(player.userId, {
//         score: player.score,
//         currentGameStatus: "playing",
//       });

//       io.to(roomId).emit("wrongDeclaration", {
//         playerId: userId,
//         penaltyPoints: wrongPenalty,
//       });
//       return false;
//     }
    
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
//       const eliminatedPlayers = game.players.filter(p => p.score >= poolLimit);
   
//       game.players = game.players.filter(p => p.score < poolLimit);

//       if (eliminatedPlayers.length > 0) {
//         io.to(roomId).emit("playerEliminated", {
//           eliminated: eliminatedPlayers.map(p => ({
//             playerId: p.userId,
//             userName: p.userName,
//           })),
//           message: `${eliminatedPlayers.map(p => p.userName).join(', ')} eliminated for exceeding pool limit.`,
//         });

//         for (const p of eliminatedPlayers) {
//           await updateUser(p.userId, {
//             currentGameStatus: "finished",
//           });
//         }
//       }

//       if (game.players.length === 1) {
//         const winner = game.players[0];
//         await updateUser(winner.userId, {
//           $inc: { gamesWon: 1 },
//           currentGameStatus: "finished",
//         });

//         io.to(roomId).emit("gameOver", {
//           gameStatus: "ended",
//           winner: winner.userId,
//           message: `${winner.userName} wins the Pool Rummy game!`,
//           scores: game.players.concat(eliminatedPlayers).map(p => ({
//             playerId: p.userId,
//             score: p.score,
//           })),
//         });
//         delete activeGames[roomId];
//         return true;
//       }

//       game.round += 1;
//       resetGameForNextRound(game, io, roomId);
//       return true; 
//     }
    
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
//       winner: userId,
//       message: `${player.userName} wins the game!`,
//       scores: game.players.map(p => ({
//         playerId: p.userId,
//         score: p.score,
//       })),
//     });

//     delete activeGames[roomId];
//     return true; 
//   } catch (error) {
//     console.error("Error in checkForWinCondition:", error);
//     return false;
//   }
// }