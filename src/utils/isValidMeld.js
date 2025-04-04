// ============ 1111
// function isValidMeld(meld) {
//     try {
//         if (meld.length < 3) return false;

//         const ranks = [];
//         const suits = [];
//         let jokerCount = 0;

//         for (const card of meld) {
//             if (card === "🃏") {
//                 jokerCount++;
//             } else {
//                 ranks.push(card.slice(0, -1));
//                 suits.push(card.slice(-1));
//             }
//         }

//         const isSet = new Set(ranks).size <= 1 && new Set(suits).size <= meld.length - jokerCount;

//         const rankOrder = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
//         const sortedRanks = ranks.map(rank => rankOrder.indexOf(rank)).sort((a, b) => a - b);
//         const isRun = new Set(suits).size === 1 && sortedRanks.every((num, i, arr) => i === 0 || num === arr[i - 1] + 1);

//         const isRunWithJoker = new Set(suits).size === 1 && sortedRanks.length + jokerCount >= 3;

//         return isSet || isRun || isRunWithJoker;
//     } catch (error) {
//         console.error("Error validating meld:", error);
//         return false;
//     }
// }

//   =========== 2222

/* isValidMeld    */

// function isValidMeld(meld) {
//     try {
//         if (meld.length < 3) {
//             console.log(" Meld is too short:", meld);
//             return false;
//         }

//         const ranks = [];
//         const suits = [];
//         let jokerCount = 0;

//         for (const card of meld) {
//             if (card === "🃏") {
//                 jokerCount++; // Count jokers
//             } else {
//                 const suit = card.slice(0, 1);
//                 const rank = card.slice(1);
//                 ranks.push(rank);
//                 suits.push(suit);
//             }
//         }

//         const uniqueRanks = new Set(ranks);
//         const uniqueSuits = new Set(suits);
//         const isSet = (uniqueRanks.size === 1) || (uniqueSuits.size + jokerCount === meld.length);

//         console.log(" Is Set?", isSet);

//         const rankOrder = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
//         const sortedRanks = ranks.map(rank => rankOrder.indexOf(rank)).sort((a, b) => a - b);

//         let missingCards = 0;
//         for (let i = 1; i < sortedRanks.length; i++) {
//             if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
//                 missingCards++;
//             }
//         }

//         const isRun = new Set(suits).size === 1 && missingCards <= jokerCount;

//         console.log(" Is Run?", isRun);

//         return isSet || isRun;
//     } catch (error) {
//         console.error(" Error validating meld:", error);
//         return false;
//     }

// }

// ============ 1111
// function calculateMeldPoints(meld) {
//     try {
//         const pointValues = { "A": 10, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 10, "Q": 10, "K": 10 };
//         return meld.reduce((total, card) => {
//             const rank = card.match(/^\D*(\d+|[JQKA])/)?.[1];
//             return total + (pointValues[rank] || 0);
//         }, 0);
//     } catch (error) {
//         console.error("Error calculating meld points:", error);
//         return 0;
//     }
// }

//  calculate Parttern

function isValidMeld(meld) {
  try {
    if (meld.length < 3) {
      console.log(" Meld is too short:", meld);
      return false;
    }

    const ranks = [];
    const suits = [];
    let jokerCount = 0;

    for (const card of meld) {
      if (card === "🃏") {
        jokerCount++; // Count jokers
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
   
 // const isSet = (uniqueRanks.size === 1) && (uniqueSuits.size + jokerCount === meld.length);

  const isSet = uniqueRanks.size === 1 && (uniqueSuits.size + jokerCount === meld.length);
  console.log(" Is Set?", isSet);

    const rankOrder = ["A","2","3","4","5","6","7","8","9","10","J","Q","K",];
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


module.exports = { isValidMeld, calculatePenaltyPoints };

/* =========================== Testing Code ===========================> */

/*
function isValidMeld(meld) {
    try {
        if (meld.length < 3) {
            console.log(" Meld is too short:", meld);
            return false; 
        }

        const ranks = [];
        const suits = [];
        let jokerCount = 0;

        for (const card of meld) {
            if (card === "🃏") {
                jokerCount++; // Count jokers
            } else {
                // Fix rank extraction by removing invisible characters
                const suit = card.charAt(0); // First character is the suit
                const rank = card.slice(1).replace(/[^A-Z0-9]/gi, "").trim(); // Remove unwanted characters
                ranks.push(rank);
                suits.push(suit);
            }
        }



        const uniqueRanks = new Set(ranks);
        const uniqueSuits = new Set(suits);
        const isSet = (uniqueRanks.size === 1) && (uniqueSuits.size + jokerCount === meld.length);

        console.log("Is Set ? ", isSet);

        // Fixed rank order lookup
        const rankOrder = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
        const sortedRanks = ranks
            .map(rank => rankOrder.indexOf(rank))
            .filter(index => index !== -1)  
            .sort((a, b) => a - b);

        console.log("👉 Sorted Rank Indexes:", sortedRanks);

        let missingCards = 0;
        for (let i = 1; i < sortedRanks.length; i++) {
            if (sortedRanks[i] !== sortedRanks[i - 1] + 1) {
                missingCards++;
            }
        }

        const isRun = uniqueSuits.size === 1 && (missingCards <= jokerCount);

        console.log(" Is Run?", isRun);

        return isSet || isRun;
    } catch (error) {
        console.error(" Error validating meld:", error);
        return false;
    }
}

*/
