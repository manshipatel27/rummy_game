const TURN_TIMEOUT_MS = 30000;
const TURN_DURATION_SECONDS = TURN_TIMEOUT_MS / 2000;
const WARNING_TIME_MS = 10000;

// exports.isValidMeld = (meld, wildCard) => {

//   try {
//     if (meld.length < 3) {
//       console.log(" Meld must have at least 3 cards.");
//       return false;
//     }

//     const ranks = [];
//     const suits = [];
//     let jokerCount = 0;

//     const rankOrder = [
//       "A",
//       "2",
//       "3",
//       "4",
//       "5",
//       "6",
//       "7",
//       "8",
//       "9",
//       "10",
//       "J",
//       "Q",
//       "K",
//     ];

//     const cardSet = new Set(meld);
//     if (cardSet.size !== meld.length) {
//       console.log("Duplicate cards are not allowed.");
//       return false;
//     }

//     for (const card of meld) {
//       if (card === "🃏" || card === wildCard) {
//         jokerCount++;
//       } else {
//         const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
//         if (!match) {
//           console.log(" Invalid card format:", card);
//           return false;
//         }
//         const [, suit, rank] = match;

//         if (!rankOrder.includes(rank)) {
//           console.log("Invalid card rank:", card);
//           return false;
//         }

//         ranks.push(rank);
//         suits.push(suit);
//       }
//     }
//     const uniqueRanks = new Set(ranks);
//     const uniqueSuits = new Set(suits);

//     //  FIX: Prevent joker-only or excessive joker melds
// /*     if (jokerCount >= meld.length - jokerCount) {
//       console.log(" Too many jokers: Not enough real cards.");
//       return false;
//     } */

//     //  FIX: Ensure suits in a set are unique (no duplicates allowed)
//     const hasUniqueSuits = suits.length === new Set(suits).size;

//     const isSet =
//       uniqueRanks.size === 1 && // All same rank
//       hasUniqueSuits &&
//       uniqueSuits.size + jokerCount === meld.length &&
//       (meld.length === 3 || meld.length === 4) &&
//       ((meld.length === 3 && jokerCount <= 1) ||
//         (meld.length === 4 && jokerCount <= 2));

//     if (isSet) {
//       console.log("Valid Set:", meld);
//       return true;
//     }

//     if (uniqueSuits.size === 1) {
//       const sortedIndices = ranks
//         .map((r) => rankOrder.indexOf(r))
//          .sort((a, b) => a - b);

//       // Special Q-K-A run check
//       // const isSpecialQKA =
//       // meld.length === 3 && // changes
//       // ranks.includes("Q") && ranks.includes("K") && ranks.includes("A");

//       // // ✅fixed this
//       // sortedIndices.toString() === [rankOrder.indexOf("Q"), rankOrder.indexOf("K"), rankOrder.indexOf("A")].toString();

//       const isSpecialQKA =
//         meld.length === 3 &&
//         ranks.includes("Q") &&
//         ranks.includes("K") &&
//         ranks.includes("A") &&
//         sortedIndices.toString() ===
//           [
//             rankOrder.indexOf("Q"),
//             rankOrder.indexOf("K"),
//             rankOrder.indexOf("A"),
//           ].toString();

//       if (isSpecialQKA && meld.length === 3) {
//         console.log("✅ Special Run Q-K-A:", meld);
//         return true;
//       }

//       // Block K-A-2 wraparound
//       const hasKA2 =
//         ranks.includes("K") && ranks.includes("A") && ranks.includes("2");
//       if (hasKA2) {
//         console.log(" Invalid sequence: K-A-2 is not allowed.");
//         return false;
//       }

//       let gaps = 0;
//       for (let i = 1; i < sortedIndices.length; i++) {
//         const diff = sortedIndices[i] - sortedIndices[i - 1];
//         if (diff === 0) return false; // Duplicates in run
//         if (diff > 1) gaps += diff - 1; // Count missing cards
//       }

//       if (gaps <= jokerCount) {
//         console.log(" Valid Run:", meld);
//         return true;
//       }
//     }

//     console.log(" Not a valid Set or Run:", meld);
//     return false;
//   } catch (error) {
//     console.error(" Error in isValidMeld:", error);
//     return false;
//   }
// }

// work proper but, calculatePenaltyPoints bug

// exports.calculatePenaltyPoints =(hand, wildCard) => {
//   try {
//     const pointValues = {
//       A: 10,
//       2: 2,
//       3: 3,
//       4: 4,
//       5: 5,
//       6: 6,
//       7: 7,
//       8: 8,
//       9: 9,
//       10: 10,
//       J: 10,
//       Q: 10,
//       K: 10,
//     };
//     // return hand.reduce((total, card) => {
//       const totalPoints = hand.reduce((total, card) => {
//       if (card === "🃏" || card === wildCard) return total + 50;
//       const rank = card.match(/^\D*(\d+|[JQKA])/)?.[1];
//       return total + (pointValues[rank] || 0);
//     }, 0);

//     return Math.min(totalPoints, 80);

//   } catch (error) {
//     console.error("Error calculating penalty points:", error);
//     return 0;
//   }

// };

//                              // 2-5-25

//

//

/*   exports.isValidMeld = (meld, wildCard) => {
    try {
      if (meld.length < 3) {
        console.log(" Meld must have at least 3 cards.");
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
  
      // Extract the rank of the wild card
      const wildCardRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
  
      const cardSet = new Set(meld);
      if (cardSet.size !== meld.length) {
        console.log("Duplicate cards are not allowed.");
        return false;
      }
  
      for (const card of meld) {
        const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
        if (!match) {
          console.log(" Invalid card format:", card);
          return false;
        }
  
        const [, suit, rank] = match;
  
        // Check if the card is a joker or a wild card
        if (card === "🃏" || rank === wildCardRank) {
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
  
      const uniqueRanks = new Set(ranks);
      const uniqueSuits = new Set(suits);
  
      // Ensure suits in a set are unique (no duplicates allowed)
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
  
      if (uniqueSuits.size === 1) {
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
          console.log(" Invalid sequence: K-A-2 is not allowed.");
          return false;
        }
  
        let gaps = 0;
        for (let i = 1; i < sortedIndices.length; i++) {
          const diff = sortedIndices[i] - sortedIndices[i - 1];
          if (diff === 0) return false; // Duplicates in run
          if (diff > 1) gaps += diff - 1; // Count missing cards
        }
  
        if (gaps <= jokerCount) {
          console.log(" Valid Run:", meld);
          return true;
        }
      }
  
      console.log(" Not a valid Set or Run:", meld);
      return false;
    } catch (error) {
      console.error(" Error in isValidMeld:", error);
      return false;
    }
  }; */

/* modfiction 5-5-25   */
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

    // Extract the rank of the wild card
    const wildCardRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];

    // Check for duplicates, but allow printed jokers
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

    // Ensure suits in a set are unique (no duplicates allowed)
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

    // Check for run (sequence)
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

/*   exports.calculatePenaltyPoints = (hand, wildCard, playerMelds = []) => {
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

    // Flatten all cards from melds
    const meldedCards = new Set(playerMelds.flat().map(card => card.trim()));
    console.log("Melded cards:", [...meldedCards]);

    // Only count cards that are not part of any valid meld
    const unmeldedCards = hand.filter(card => !meldedCards.has(card.trim()));
    console.log("Unmelded cards for penalty calculation:", unmeldedCards);

    // Calculate points only for cards not in melds
    const totalPoints = unmeldedCards.reduce((total, card) => {
      if (card === "🃏") return total; // Jokers have no penalty

      // Fix the wildCard check
      if (isWildCard(card, wildCard)) return total + 50;

      const match = card.match(/^[\u2000-\u3300\uD83C-\uD83E]+([A2-9JQK]|10)$/);
      if (!match) {
        console.log("Invalid card format in penalty calculation:", card);
        return total;
      }

      const rank = match[1];
      return total + (pointValues[rank] || 0);
    }, 0);

    console.log("Total penalty points:", totalPoints);
    return Math.min(totalPoints, 80); // Cap penalty points at 80
  } catch (error) {
    console.error("Error calculating penalty points:", error);
    return 0;
  }


  }; */

/* 5-5-25 modifiction code with calculatePenaltyPoint */
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
    const meldedCards = new Set(playerMelds.flat().map((card) => card.trim()));
    console.log("Melded cards:", [...meldedCards]);

    // Only count cards that are not part of any valid meld
    const unmeldedCards = hand.filter((card) => !meldedCards.has(card.trim()));
    console.log("Unmelded cards for penalty calculation:", unmeldedCards);

    // Calculate points only for cards not in melds
    const totalPoints = unmeldedCards.reduce((total, card) => {
      if (card === "🃏") {
        console.log("Joker card - 0 points");
        return total + 0; // Jokers have no penalty
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

/* exports.isSequence = (meld, wildCard, pureCheck = false) => {
  const rankOrder = [
    "A", "2", "3", "4", "5", "6", "7",
    "8", "9", "10", "J", "Q", "K",
  ];

  const ranks = [];
  const suits = [];
  let jokerCount = 0;

  for (const card of meld) {
    if (card === "🃏" || card === wildCard) {
      if (pureCheck) return false; // Joker not allowed if checking for pure
      jokerCount++;
    } else {
      const match = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/);
      if (!match) return false;
      const [, suit, rank] = match;
      ranks.push(rank);
      suits.push(suit);
    }
  }


  if (new Set(suits).size > 1) return false; // must be same suit

  const sortedIndices = ranks.map(r => rankOrder.indexOf(r)).sort((a, b) => a - b);

  let gaps = 0;
  for (let i = 1; i < sortedIndices.length; i++) {
    const diff = sortedIndices[i] - sortedIndices[i - 1];
    if (diff === 0) return false; // duplicate ranks invalid
    if (diff > 1) gaps += diff - 1;
  }

  if (pureCheck) {
    return gaps === 0;
  } else {
    return gaps <= jokerCount;
  }

}; */

//  Completed**
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

/*   function isWildCard(card, wildCard) {

  if (!card || !wildCard) return false;

  if (card === "🃏") return true;

  const wildRank = wildCard.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
  const cardRank = card.match(/^([♠️♥️♦️♣️]+)([A2-9JQK]|10)$/)?.[2];
  
  return wildRank === cardRank;

  } */

// modification ========>  //  5-5-25
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
