const { getGame, setGame, delGame} = require("../../config/redis");
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

    // const wildCardRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
    // const wildCardRank = wildCard.match(/^([A2-9JQK]|10)([SHDC])$/)?.[1];
    // const wildCardRank = wildCard.match(/^([SHDC])([A2-9JQK]|10)$/)?.[2];//11
    
    const wildValue = typeof wildCard === "string" ? wildCard : wildCard?.value;
    const wildCardRank = wildValue?.match(/^([SHDC])([A2-9JQK]|10)$/)?.[2];


    // const nonJokerCards = meld.filter((card) => card !== "JOKER"); //(card) => card !== "🃏"
    // const nonJokerSet = new Set(nonJokerCards);
    // if (nonJokerSet.size !== nonJokerCards.length) {
    //   console.log("Duplicate cards are not allowed.");
    //   return false;
    // }

    const nonJokerCards = meld
      .map((card) => typeof card === "string" ? card : card?.value)
      .filter((value) => value !== "JOKER");

    const nonJokerSet = new Set(nonJokerCards);
    if (nonJokerSet.size !== nonJokerCards.length) return false;


    // for (const card of meld) {
    //   // if (card === "🃏") 
    //   if (card === "JOKER")
    //     {
    //     jokerCount++;
    //     continue;
    //   }

    //   // const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
    //   // const match = card.match(/^([A2-9JQK]|10)([SHDC])$/);
    //   const match = card.match(/^([SHDC])([A2-9JQK]|10)$/);

    //   if (!match) {
    //     console.log("Invalid card format:", card);
    //     return false;
    //   }

    //   const [, suit, rank] = match;

    //   // Check if the card is a wild card
    //   if (rank === wildCardRank) {
    //     jokerCount++;
    //   } else {
    //     if (!rankOrder.includes(rank)) {
    //       console.log("Invalid card rank:", card);
    //       return false;
    //     }
    //     ranks.push(rank);
    //     suits.push(suit);
    //   }
    // }  
  
    for (const card of meld) {
      const cardValue = typeof card === "string" ? card : card?.value;
      if (!cardValue) return false;

      if (cardValue === "JOKER") {
        jokerCount++;
        continue;
      }

      const match = cardValue.match(/^([SHDC])([A2-9JQK]|10)$/);
      if (!match) return false;

      const [, suit, rank] = match;

      if (rank === wildCardRank) {
        jokerCount++;
      } else {
        if (!rankOrder.includes(rank)) return false;
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

    // suits in a set are unique no duplicates allowed
    const hasUniqueSuits = suits.length === new Set(suits).size;

    const isSet =
      uniqueRanks.size === 1 &&
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

      // const isSpecialQKA =
      //   meld.length === 3 &&
      //   ranks.includes("Q") &&
      //   ranks.includes("K") &&
      //   ranks.includes("A") &&
      //   sortedIndices.toString() ===
      //     [
      //       rankOrder.indexOf("Q"),
      //       rankOrder.indexOf("K"),
      //       rankOrder.indexOf("A"),
      //     ].toString();

      // ✅ Fix Q-K-A check
const isSpecialQKA =
meld.length === 3 &&
ranks.includes("Q") &&
ranks.includes("K") &&
ranks.includes("A") &&
uniqueSuits.size === 1;

if (isSpecialQKA) return true;


      if (isSpecialQKA && meld.length === 3) {
        console.log("✅ Special Run Q-K-A:", meld);
        return true;
      }

      // Block K-A-2
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
      } else if (jokerCount === meld.length) {
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
      10: 10,
      J: 10,
      Q: 10,
      K: 10,
    };

    console.log("Calculating penalty for hand:", hand);
    console.log("Wild card:", wildCard);
    console.log("Player melds:", playerMelds);

    // Flatten all cards from melds
    // const meldedCards = new Set(playerMelds.flat().map((card) => card.trim()));
    // console.log("Melded cards:", [...meldedCards]);

    const meldedCards = new Set(playerMelds.flat().map((card) =>
      (typeof card === "string" ? card : card.value)?.trim()
    ));

    // const unmeldedCards = hand.filter((card) => !meldedCards.has(card.trim()));
    // console.log("Unmelded cards for penalty calculation:", unmeldedCards);

    const unmeldedCards = hand.filter((card) => {
      const cardVal = typeof card === "string" ? card : card?.value;
      return !meldedCards.has(cardVal?.trim());
    });
    

    const totalPoints = unmeldedCards.reduce((total, card) => {
      // if (card === "🃏") 
      // if (card === "JOKER")
      const cardValue = typeof card === "string" ? card : card?.value;
if (!cardValue) return total;

if (cardValue === "JOKER")

        {
        console.log("Joker card - 0 points");
        return total + 0;
      }

      // Check if this is a wild card
      const isWild = isWildCard(card, wildCard);
      if (isWild) {
        console.log(`Wild card ${cardValue} - 50 points`);
        return total + 50;
      }

      // const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
      // const match = cardValue.match(/^([A2-9JQK]|10)([SHDC])$/);
      const match = cardValue.match(/^([SHDC])([A2-9JQK]|10)$/);

      if (!match) {
        console.log("Invalid card format in penalty calculation:", card);
        return total;
      }

      const rank = match[2];
      console.log(`Card ${cardValue} rank ${rank} - ${pointValues[rank]} points`);
      return total + (pointValues[rank] || 0);
    }, 0);

    console.log("Total penalty points:", totalPoints);
    return Math.min(totalPoints, 80);
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



// exports.hasPureSequence = (melds, wildCard) => {
//   for (const meld of melds) {
//     if (meld.length >= 3 && exports.isSequence(meld, wildCard, true)) {
//       return true;
//     }
//   }
//   return false;
// };

// exports.countSequences = (melds, wildCard) => {
//   let sequenceCount = 0;
//   for (const meld of melds) {
//     if (meld.length >= 3 && exports.isSequence(meld, wildCard, false)) {
//       sequenceCount++;
//     }
//   }
//   return sequenceCount;
// };

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

  // for (const card of meld) {
  //   // if (card === "🃏") 
  //   if (card === "JOKER")
  for (const cardObj of meld) {
    const card = typeof cardObj === "string" ? cardObj : cardObj?.value;
    if (!card) return false;
  
    if (card === "JOKER")  
       {
      if (pureCheck) return false;
      jokerCount++;
    } else if (isWildCard(card, wildCard)) {
      if (pureCheck) return false;
      jokerCount++;
    } else {
      // const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
      // const match = card.match(/^([A2-9JQK]|10)([SHDC])$/);
      const match = card.match(/^([SHDC])([A2-9JQK]|10)$/);

      if (!match) return false;
      const [, suit, rank] = match;
      suits.push(suit);
      ranks.push(rank);
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

// function isWildCard(card, wildCard) {
//   if (!card || !wildCard) return false;

//   // if (card === "🃏") 
//   if (card === "JOKER")
//     return true;

//   // const wildRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
//   // const cardRank = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
//   const wildRank = wildCard.match(/^([A2-9JQK]|10)[SHDC]$/)?.[1];
//   const cardRank = card.match(/^([A2-9JQK]|10)[SHDC]$/)?.[1];


//   return wildRank === cardRank;
// }

function isWildCard(card, wildCard) {
  if (!card || !wildCard) return false;

  const wildValue = typeof wildCard === "string" ? wildCard : wildCard?.value;
  const cardValue = typeof card === "string" ? card : card?.value;

  if (cardValue === "JOKER") return true;

  // 🔧 FIX HERE: Match suit first, then rank
  const wildRank = wildValue?.match(/^([SHDC])([A2-9JQK]|10)$/)?.[2];
  const cardRank = cardValue?.match(/^([SHDC])([A2-9JQK]|10)$/)?.[2];

  return wildRank === cardRank;
}


const timersByRoomId = {};

/*
 exports.handleTurnTimeout = (io, roomId, activeGames) => {
  try {
    const game = activeGames[roomId];
    if (!game || game.gameEnded) return;

    const currentPlayer = game.players[game.currentPlayerIndex];
  
    currentPlayer.drawn = false;
    currentPlayer.discarded = false;
    
    game.currentPlayerIndex =
      (game.currentPlayerIndex + 1) % game.players.length;
    const nextPlayer = game.players[game.currentPlayerIndex];

    console.log(`Turn timeout for ${currentPlayer.userName}. Passing turn to ${nextPlayer.userName}.`);
    
    io.to(roomId).emit("timeout", {
      playerId: currentPlayer.userId,
      nextPlayerId: nextPlayer.userId,
      message: `${currentPlayer.userName}'s turn was skipped due to timeout.`,
    });

    exports.startTurnTimer(io, roomId, activeGames);
  } catch (error) {
    console.error(`Error in handleTurnTimeout for room ${roomId}:`, error);
    io.to(roomId).emit("error", {
      message: "Turn timeout failed, please try again.",
    });
  }
 };
 */

/* 
 exports.startTurnTimer = (io, roomId) => {
  // const game = activeGames[roomId];
  const game = getGame[roomId];
   
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
      exports.handleTurnTimeout(io, roomId, activeGames);
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

*/

// bug
// exports.handleTurnTimeout = async (io, roomId) => {
//   try {
//     const game = await getGame(roomId);
//     if (!game || game.gameEnded) return;

//     const currentPlayer = game.players[game.currentPlayerIndex];

//     currentPlayer.drawn = false;
//     currentPlayer.discarded = false;

//     game.currentPlayerIndex =
//       (game.currentPlayerIndex + 1) % game.players.length;
//     const nextPlayer = game.players[game.currentPlayerIndex];

//     console.log(
//       `Turn timeout for ${currentPlayer.userName}. Passing turn to ${nextPlayer.userName}.`
//     );

//     io.to(roomId).emit("timeout", {
//       playerId: currentPlayer.userId,
//       nextPlayerId: nextPlayer.userId,
//       message: `${currentPlayer.userName}'s turn was skipped due to timeout.`,
//     });

//     // Save updated game state to Redis
//     const { setGame } = require("../../config/redis");
//     await setGame(roomId, game);

//     exports.startTurnTimer(io, roomId);
//   } catch (error) {
//     console.error(`Error in handleTurnTimeout for room ${roomId}:`, error);
//     io.to(roomId).emit("error", {
//       message: "Turn timeout failed, please try again.",
//     });
//   }
// };

exports.handleTurnTimeout = async (io, roomId) => {
  try {
    const game = await getGame(roomId);
    if (!game || game.gameEnded) return;
    const currentPlayer = game.players[game.currentPlayerIndex];

    if (currentPlayer.drawn && !currentPlayer.discarded) {
      const returnedCard = currentPlayer.hand.pop();
      game.discardPile.unshift(returnedCard);
      io.to(currentPlayer.socketId).emit("updateHand", currentPlayer.hand);
      io.to(roomId).emit("updateDiscardPile", game.discardPile);
    }

    currentPlayer.drawn = false;
    currentPlayer.discarded = false;

    game.currentPlayerIndex =
      (game.currentPlayerIndex + 1) % game.players.length;
    const nextPlayer = game.players[game.currentPlayerIndex];

    console.log(
      `Turn timeout for ${currentPlayer.userName}. Passing turn to ${nextPlayer.userName}.`
    );

    io.to(roomId).emit("timeout", {
      playerId: currentPlayer.userId,
      nextPlayerId: nextPlayer.userId,
      message: `${currentPlayer.userName}'s turn was skipped due to timeout.`,
    });

    const { setGame } = require("../../config/redis");
    await setGame(roomId, game);

    exports.startTurnTimer(io, roomId);
  } catch (error) {
    console.error(`Error in handleTurnTimeout for room ${roomId}:`, error);
    io.to(roomId).emit("error", {
      message: "Turn timeout failed, please try again.",
    });
  }
};

exports.startTurnTimer = (io, roomId) => {
  getGame(roomId).then((game) => {
    if (!game || game.gameEnded) return;

    if (timersByRoomId[roomId]) {
      clearTimeout(timersByRoomId[roomId].turnTimer);
      clearTimeout(timersByRoomId[roomId].warningTimer);
    }
    timersByRoomId[roomId] = {};

    io.to(roomId).emit("turnTimeUpdate", {
      timeLeft: TURN_DURATION_SECONDS,
      currentPlayerId: game.players[game.currentPlayerIndex].userId,
    });

    timersByRoomId[roomId].warningTimer = setTimeout(() => {
      if (!game.gameEnded) {
        const currentPlayer = game.players[game.currentPlayerIndex];
        io.to(currentPlayer.socketId).emit("turnWarning", {
          message: "10 seconds remaining!",
          timeLeft: WARNING_TIME_MS / 1000,
        });
      }
    }, TURN_TIMEOUT_MS - WARNING_TIME_MS);

    timersByRoomId[roomId].turnTimer = setTimeout(() => {
      if (!game.gameEnded) {
        clearTimeout(timersByRoomId[roomId].warningTimer);
        exports.handleTurnTimeout(io, roomId);
      }
    }, TURN_TIMEOUT_MS);
  });
};

exports.cleanupTimers = (roomId) => {
  if (timersByRoomId[roomId]) {
    clearTimeout(timersByRoomId[roomId].turnTimer);
    clearTimeout(timersByRoomId[roomId].warningTimer);
    delete timersByRoomId[roomId];
  }
};

exports.handlePlayerRemoval = async (io,game,roomId,leavingPlayer,removedPlayerIndex) => {
  const remainingPlayers = game.players.length;

  if (remainingPlayers === 0) {
    console.log(`No players left in room ${roomId}. Deleting game.`);
    await delGame(roomId);
    this.cleanupTimers(roomId);
  } else if (remainingPlayers === 1) {
    const winner = game.players[0];
    console.log(
      `Player ${winner.userName} wins in room ${roomId} as ${leavingPlayer.userName} disconnected.`
    );

    io.to(winner.socketId).emit("gameOver", {
      message: `🎉 You win! ${leavingPlayer.userName} disconnected.`,
      winnerId: winner.userId,
    });

    await delGame(roomId);
    exports.cleanupTimers(roomId);
  } else {
    await exports.adjustCurrentPlayerAndNotify(
      io,
      game,
      roomId,
      leavingPlayer,
      removedPlayerIndex
    );
    await setGame(roomId, game);
  }
};

exports.adjustCurrentPlayerAndNotify = async (
  io,
  game,
  roomId,
  leavingPlayer,
  removedPlayerIndex
) => {
  if (removedPlayerIndex < game.currentPlayerIndex) {
    game.currentPlayerIndex--;
  }
  if (game.currentPlayerIndex >= game.players.length) {
    game.currentPlayerIndex = 0;
  }

  const nextPlayer = game.players[game.currentPlayerIndex];
  if (nextPlayer) {
    nextPlayer.drawn = false;
    nextPlayer.discarded = false;

    const turnPassedMessage = `Turn passed to ${nextPlayer.userName} as ${leavingPlayer.userName} disconnected.`;
    io.to(roomId).emit("turnEnded", {
      message: turnPassedMessage,
      currentPlayerId: nextPlayer.userId,
    });
    io.to(nextPlayer.socketId).emit("yourTurn", {
      message: `It's your turn, ${nextPlayer.userName}!`,
    });
    exports.startTurnTimer(io, roomId);
    console.log(turnPassedMessage);
  }

  io.to(roomId).emit("playerLeft", {
    message: `${leavingPlayer.userName} has left the game.`,
    playerId: leavingPlayer.userId,
  });
};

exports.resetGameForNextRound = (game, io, roomId) => {
  const numDecks = game.players.length <= 6 ? 2 : 3;
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
  } while (game.discardPile[0] === "JOKER");
  // while (game.discardPile[0] === "🃏");

  game.currentPlayerIndex = 0;

  game.players.forEach(async (player) => {
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

// ...existing code...

// In-memory timers map (should be at module scope)
