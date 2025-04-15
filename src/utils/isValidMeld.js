const TURN_TIMEOUT_MS = 60000; 
const TURN_DURATION_SECONDS = TURN_TIMEOUT_MS / 1000;
const WARNING_TIME_MS = 10000;

function isValidMeld(meld) {
  try {
    if (meld.length < 3) {
      console.log("Meld is too short:", meld);
      return false;
    }
    const ranks = [];
    const suits = [];
    let jokerCount = 0;

    for (const card of meld) {
      if (card === "🃏") {
        jokerCount++;
      } else {
        const suit = card.slice(0, 1).trim();
        const rank = card.slice(1).trim();
        ranks.push(rank);
        suits.push(suit);
      }
    }

    console.log("🔹 Checking Meld:", meld);
    console.log(" Extracted Ranks:", ranks);
    console.log(" Extracted Suits:", suits);
    console.log(" Joker Count:", jokerCount);

    const uniqueRanks = new Set(ranks);
    const uniqueSuits = new Set(suits);

    const isSet = uniqueRanks.size === 1 && (uniqueSuits.size + jokerCount === meld.length);
    console.log("Is Set?", isSet);

    const rankOrder = [ "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const sortedRanks = ranks
      .map((rank) => rankOrder.indexOf(rank))
      .filter((index) => index !== -1)
      .sort((a, b) => a - b);

    let missingCards = 0;
    for (let i = 1; i < sortedRanks.length; i++) {
      if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
        missingCards++;
      }
    }

    const isRun = uniqueSuits.size === 1 && missingCards <= jokerCount;
    console.log("Is Run?", isRun);
    return isSet || isRun;
  } catch (error) {
    console.error("Error validating meld:", error);
    return false;
  }
}

function calculatePenaltyPoints(hand) {
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
    return hand.reduce((total, card) => {
      if (card === "🃏") return total;
      const rank = card.match(/^\D*(\d+|[JQKA])/)?.[1];
      return total + (pointValues[rank] || 0);
    }, 0);
  } catch (error) {
    console.error("Error calculating penalty points:", error);
    return 0;
  }
}
 


// ======================= all the timing based functions =======================
// by defual discard the cards.

// function handleTurnTimeout(io, roomId, activeGames) {
//   try {
//     const game = activeGames[roomId];
//     if (!game || game.gameEnded) return;

//     const currentPlayer = game.players[game.currentPlayerIndex];
//     let discardedCard = null;

//     if (currentPlayer.hand.length > 0) {
//       const cardsWithValues = currentPlayer.hand.map(card => ({
//         card,
//         value: calculateCardPenalty(card)
//       })).sort((a, b) => b.value - a.value);
      
//       discardedCard = cardsWithValues[0].card;
//       const cardIndex = currentPlayer.hand.indexOf(discardedCard);
//       currentPlayer.hand.splice(cardIndex, 1);
//       game.discardPile.push(discardedCard);
//     }

//     currentPlayer.drawn = false;
//     currentPlayer.discarded = false;

  
//     game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
//     const nextPlayer = game.players[game.currentPlayerIndex];

//     console.log(`Timeout occurred for ${currentPlayer.userName} in room ${roomId}`);

//     io.to(roomId).emit("timeout", {
//       playerId: currentPlayer.userId,
//       nextPlayerId: nextPlayer.userId,
//       discardedCard,
//       timeLeft: TURN_DURATION_SECONDS
//     });

//     //  for the next player timing
//     startTurnTimer(io, roomId, activeGames);
//   } catch (error) {
//     console.error(`Timeout handler error in room ${roomId}:`, error);
//     io.to(roomId).emit("error", {
//       message: "Turn timeout failed, please try again",
//     });
//   }
// }

// function calculateCardPenalty(card) {
//   if (card === "🃏") return 0;

//   const pointValues = {
//     A: 10,
//     J: 10,
//     Q: 10,
//     K: 10,
//     10: 10,
//     9: 9,
//     8: 8,
//     7: 7,
//     6: 6,
//     5: 5,
//     4: 4,
//     3: 3,
//     2: 2,
//   };

//   const match = card.match(/([A-Z]+|\d+)/);
//   const rank = match ? match[0] : null;

//   return pointValues[rank] || 0;
// }

// function startTurnTimer(io, roomId, activeGames) {
//   const game = activeGames[roomId];
//   if (!game || game.gameEnded) return;

//   clearTimeout(game.turnTimer);
//   clearTimeout(game.warningTimer);

//   io.to(roomId).emit('turnTimeUpdate', {
//     timeLeft: TURN_DURATION_SECONDS,
//     currentPlayerId: game.players[game.currentPlayerIndex].userId
//   });

//   game.warningTimer = setTimeout(() => {
//     if (!game.gameEnded) {
//       const currentPlayer = game.players[game.currentPlayerIndex];
//       io.to(currentPlayer.socketId).emit("turnWarning", {
//         message: "10 seconds remaining!",
//         timeLeft: WARNING_TIME_MS / 1000,
//       });
//     }
//   }, TURN_TIMEOUT_MS - WARNING_TIME_MS);

//   game.turnTimer = setTimeout(() => {
//     if (!game.gameEnded) {
//       clearTimeout(game.warningTimer);
//       handleTurnTimeout(io, roomId, activeGames);
//     }
//   }, TURN_TIMEOUT_MS);
// }

// function cleanupTimers(roomId, activeGames) {
//   const game = activeGames[roomId];
//   if (!game) return;

//   clearTimeout(game.turnTimer);
//   clearTimeout(game.warningTimer);
//   game.gameEnded = true;
// }

module.exports = { isValidMeld, calculatePenaltyPoints, };

// handleTurnTimeout, cleanupTimers, startTurnTimer, calculateCardPenalty, TURN_DURATION_SECONDS

