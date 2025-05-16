const { createDeck, shuffleDeck } = require("../utils/deckUtils");
const {
  isValidMeld,
  hasPureSequence,
  countSequences,
  calculatePenaltyPoints,
  resetGameForNextRound,
} = require("../utils/isValidMeld");
// startTurnTimer, cleanupTimers, TURN_DURATION_SECONDS

const { updateUser } = require("../userService");
const User = require("../../model/userModel");
const activeGames = {};
const MAX_PLAYERS = 4;

const isValidString = (param) =>
  typeof param === "string" && param.trim() !== "";

module.exports = (io, socket) => {
 
  socket.on("joinRoom", async ({ roomId, gameType = "pool101", poolLimit = null }) => {
      try {
        const { _id: userId, name: userName } = socket.user;

        socket.userId = userId;
        socket.roomId = roomId;

        socket.join(roomId);

        const game = (activeGames[roomId] ||= {
          players: [],
          started: false,
          createdAt: new Date(),
          createdBy: userId,
          gameType,
          poolLimit,
          round: 1,
        });

        if (game.players.length > 0 && game.gameType !== gameType) {
          return socket.emit("turnError", {
            message: `You cannot join this room with game type '${gameType}'. This room is already set to '${game.gameType}'.`,
          });
        }

        if (game.players.find((p) => p.userId == userId)) {
          return socket.emit("turnError", {
            message: "User already joined the room.",
          });
        }

        if (game.players.length >= MAX_PLAYERS) {
          return socket.emit("turnError", { message: "Room is full." });
        }

        const player = { userId, userName, socketId: socket.id, score: 0 };
        game.players.push(player);

        await updateUser(userId, { currentGameStatus: "waiting" });

        const payload = {
          players: game.players,
          message: `${userName} has joined the room.`,
        };

        io.to(roomId).emit("userJoined", payload);
        io.to(roomId).emit("joinedRoom", { ...payload, roomId });
      } catch (err) {
        console.error("joinRoom error:", err);
        socket.emit("turnError", { message: "Unexpected error in joinRoom." });
      }
    }
  );

  socket.on("startGame", async ({ roomId }) => {
    try {
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

      if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
        game.poolLimit =
          game.gameType === "pool61"
            ? 61
            : game.gameType === "pool101"
            ? 101
            : 201;
      }

      let numPlayers = game.players.length;
      let numDecks = numPlayers <= 6 ? 2 : 3;

      let deck = createDeck(numDecks);
      deck = shuffleDeck(deck);
      game.deck = deck;

      console.log(`Number of Players: ${numPlayers}`);
      console.log(`Number of Decks Used: ${numDecks}`);
      console.log(`Total Number of Cards After Shuffling: ${deck.length}`);

      let cardsPerPlayer = 13;

      if (game.deck.length < game.players.length * cardsPerPlayer + 5) {
        socket.emit("turnError", {
          message: "Not enough cards in deck to start the game.",
        });
        return;
      }

      const wildCard = game.deck.pop();
      game.wildCard = wildCard;

      do {
        game.discardPile = [game.deck.pop()];
      } while (game.discardPile[0] === "🃏");

      game.currentPlayerIndex = 0;

      for (const player of game.players) {
        await updateUser(player.userId, {
          $inc: { gamesPlayed: 1 },
          currentGameStatus: "playing",
          score: player.score || 0,
          melds: [],
        });
      }

      game.players.forEach((player) => {
        player.hand = game.deck.splice(0, cardsPerPlayer);
        player.melds = [];
        io.to(player.socketId).emit("playerHand", { hand: player.hand });
      });

      io.to(roomId).emit("gameStarted", {
        message: "Game has started",
        gameType: game.gameType,
        poolLimit: game.poolLimit || null,
        players: game.players.map((p) => ({
          userId: p.userId,
          userName: p.userName,
          handSize: cardsPerPlayer,
          score: p.score,
        })),
        discardPile: game.discardPile,
        currentPlayerIndex: game.currentPlayerIndex,
        wildCard: game.wildCard,
      });

      console.log(`Game successfully started in room: ${roomId}`);
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("turnError", { message: "An unexpected error occurred" });
    }
  });

  socket.on("drawCard", async ({ drawFrom }) => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

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

      let drawnCard;
      if (drawFrom === "deck") {
        if (!game.deck.length)
          return socket.emit("error", { message: "Deck is empty" });
        drawnCard = game.deck.shift();
      } else if (drawFrom === "discard") {
        if (!game.discardPile.length)
          return socket.emit("error", { message: "Discard pile is empty" });
        drawnCard = game.discardPile.shift();
      } else {
        return socket.emit("turnError", { message: "Invalid draw source" });
      }

      player.drawn = true;
      player.hand.push(drawnCard);

      io.to(player.socketId).emit("cardDrawn", {
        drawnCard,
        hand: player.hand,
        deckSize: game.deck.length,
      });

      if (drawFrom === "discard") {
        io.to(roomId).emit("updateDiscardPile", game.discardPile);
      }

      await User.findByIdAndUpdate(
        userId,
        { score: player.score },
        { new: true }
      );
    } catch (turnError) {
      console.error("Draw card error:", turnError);
      socket.emit("turnError", { message: "Failed to draw card" });
    }
  });

  // socket.on("discardCard", async ({ card }) => {
  // try {
  //   if (!socket.user?._id) {
  //     return socket.emit("turnError", { message: "Unauthorized access." });
  //   }
  //   const roomId = Array.from(socket.rooms).find(
  //     (room) => room !== socket.id
  //   );

  //   if (!roomId || !activeGames[roomId]) {
  //     return socket.emit("turnError", {
  //     message: "You're not in an active game.",
  //     });
  //   }

  //   const game = activeGames[roomId];
  //   const userId = socket.user._id;

  //   const player = game.players.find((p) => p.userId === userId);
  //   if (!player) {
  //     return socket.emit("turnError", { message: "Player data not found." });
  //   }

  //    if (!player.drawn) {
  //     return socket.emit("turnError", { message: "You must draw a card before discarding." });
  //    }

  //    if (player.discarded) {
  //     return socket.emit("turnError", {
  //       message: "Already discarded this turn.",
  //     });
  //   }

  //   if (game.players[game.currentPlayerIndex].userId !== userId) {
  //     return socket.emit("turnError", { message: "It's not your turn." });
  //   }

  //   const cardIndex = player.hand.findIndex((c) => c.trim() === card.trim());
  //   if (cardIndex === -1) {
  //     return socket.emit("turnError", { message: "Card not found in hand." });
  //   }

  //   const discardedCard = player.hand.splice(cardIndex, 1)[0];
  //   game.discardPile.unshift(discardedCard);
  //   player.discarded = true;

  //   io.to(roomId).emit("updateDiscardPile", game.discardPile);
  //   io.to(player.socketId).emit("updateHand", player.hand);

  //   game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  //   const nextPlayer = game.players[game.currentPlayerIndex];
  //   nextPlayer.drawn = false;
  //   nextPlayer.discarded = false;

  //   io.to(roomId).emit("turnEnded", {
  //     message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
  //     currentPlayerId: nextPlayer.userId,
  //   });

  //   io.to(nextPlayer.socketId).emit("yourTurn", {
  //     message: `It's your turn, ${nextPlayer.userName}`,
  //   });

  //   console.log("Discarded:", card, "by", player.userName);
  // } catch (error) {
  //   console.error("Discard card error:", error);
  //   socket.emit("turnError", { message: "Failed to discard card" });
  // }
  // });

  socket.on("discardCard", async ({ card }) => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }
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

      const player = game.players.find((p) => p.userId === userId);
      if (!player) {
        return socket.emit("turnError", { message: "Player data not found." });
      }

      if (!player.drawn) {
        return socket.emit("turnError", {
          message: "You must draw a card before discarding.",
        });
      }

      if (player.discarded) {
        return socket.emit("turnError", {
          message: "Already discarded this turn.",
        });
      }

      if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      const cardIndex = player.hand.findIndex((c) => c.trim() === card.trim());

      if (cardIndex === -1) {
        return socket.emit("turnError", { message: "Card not found in hand." });
      }

      const discardedCard = player.hand.splice(cardIndex, 1)[0];
      game.discardPile.unshift(discardedCard);
      player.discarded = true;

      io.to(roomId).emit("updateDiscardPile", game.discardPile);
      io.to(player.socketId).emit("updateHand", player.hand);

      if (player.hand.length === 0) {
        const hasPure = hasPureSequence(player.melds, game.wildCard);
        const totalSequences = countSequences(player.melds, game.wildCard);

        if (hasPure && totalSequences >= 2) {
          player.score += 0;

          for (const p of game.players) {
            if (p.userId !== userId) {
              p.score += Math.min(
                calculatePenaltyPoints(p.hand, game.wildCard, p.melds || []),
                80
              );
            }
          }

          for (const p of game.players) {
            await updateUser(p.userId, {
              score: p.score,
              currentGameStatus: "playing",
            });
          }

          if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
            const poolLimit = game.poolLimit;
            const eliminatedPlayers = game.players.filter(
              (p) => p.score >= poolLimit
            );

            // Remove eliminated players
            game.players = game.players.filter((p) => p.score < poolLimit);

            // Notify about eliminations
            if (eliminatedPlayers.length > 0) {
              io.to(roomId).emit("playerEliminated", {
                eliminated: eliminatedPlayers.map((p) => ({
                  playerId: p.userId,
                  userName: p.userName,
                })),
                message: `${eliminatedPlayers
                  .map((p) => p.userName)
                  .join(", ")} eliminated for exceeding pool limit.`,
              });

              // Update database for eliminated players
              for (const p of eliminatedPlayers) {
                await updateUser(p.userId, {
                  currentGameStatus: "finished",
                });
              }
            }

            // Check if only one player remains
            if (game.players.length === 1) {
              const winner = game.players[0];
              await updateUser(winner.userId, {
                $inc: { gamesWon: 1 },
                currentGameStatus: "finished",
              });

              io.to(roomId).emit("gameOver", {
                gameStatus: "ended",
                winner: winner.userId,
                message: `${winner.userName} wins the Pool Rummy game!`,
                scores: game.players.concat(eliminatedPlayers).map((p) => ({
                  playerId: p.userId,
                  score: p.score,
                })),
              });

              delete activeGames[roomId];
              return;
            }

            // Start next round
            game.round += 1;
            resetGameForNextRound(game, io, roomId);
            return;
          }

          // Point Rummy logic
          await updateUser(userId, {
            $inc: { gamesWon: 1 },
            currentGameStatus: "finished",
          });

          for (const p of game.players) {
            if (p.userId !== userId) {
              await updateUser(p.userId, {
                currentGameStatus: "finished",
              });
            }
          }

          io.to(roomId).emit("gameOver", {
            gameStatus: "ended",
            winner: userId,
            message: `${player.userName} wins the game!`,
            scores: game.players.map((p) => ({
              playerId: p.userId,
              score: p.score,
            })),
          });

          delete activeGames[roomId];
          return;
        } else {
          // Invalid show - player has no cards but doesn't meet win conditions
          const wrongPenalty = Math.min(
            calculatePenaltyPoints(
              player.hand.concat(player.melds.flat()),
              game.wildCard,
              []
            ),
            80
          );

          player.score += wrongPenalty;

          await updateUser(player.userId, {
            score: player.score,
            currentGameStatus: "playing",
          });

          io.to(roomId).emit("wrongDeclaration", {
            playerId: userId,
            penaltyPoints: wrongPenalty,
          });
        }
      }

      // Only proceed to next turn if game hasn't ended
      if (activeGames[roomId]) {
        game.currentPlayerIndex =
          (game.currentPlayerIndex + 1) % game.players.length;
        const nextPlayer = game.players[game.currentPlayerIndex];
        nextPlayer.drawn = false;
        nextPlayer.discarded = false;

        io.to(roomId).emit("turnEnded", {
          message: `Turn ended for ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
          currentPlayerId: nextPlayer.userId,
        });

        io.to(nextPlayer.socketId).emit("yourTurn", {
          message: `It's your turn, ${nextPlayer.userName}`,
        });
      }

      console.log("Discarded:", card, "by", player.userName);
    } catch (error) {
      console.error("Discard card error:", error);
      socket.emit("turnError", { message: "Failed to discard card" });
    }
  });

  socket.on("layDownMelds", async ({ melds }) => {
    try {
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

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

      const player = game.players.find((p) => p.userId === userId);
      if (!player) {
        return socket.emit("turnError", { message: "Player not found." });
      }

      if (game.players[game.currentPlayerIndex].userId !== userId) {
        return socket.emit("turnError", { message: "It's not your turn." });
      }

      if (!Array.isArray(melds) || melds.length === 0) {
        return socket.emit("turnError", { message: "Invalid melds format." });
      }

      const remainingCards = [...player.hand];
      const allMeldCards = melds.flat();

      for (const meldCard of allMeldCards) {
        const cardIndex = remainingCards.findIndex(
          (handCard) => handCard.trim() === meldCard.trim()
        );
        if (cardIndex === -1) {
          return socket.emit("turnError", {
            message: `Card ${meldCard} not found in your hand.`,
          });
        }
        remainingCards.splice(cardIndex, 1);
      }

      for (const meld of melds) {
        if (!isValidMeld(meld, game.wildCard)) {
          return socket.emit("turnError", {
            message: "Invalid meld detected.",
          });
        }
      }

      player.melds.push(...melds);
      player.hand = remainingCards;

      // Update database with melds
      await updateUser(userId, { melds: player.melds });

      if (player.hand.length === 0) {
        const hasPure = hasPureSequence(player.melds, game.wildCard);
        const totalSequences = countSequences(player.melds, game.wildCard);

        if (!hasPure || totalSequences < 2) {
          const wrongPenalty = Math.min(
            calculatePenaltyPoints(
              player.hand.concat(player.melds.flat()),
              game.wildCard,
              []
            ),
            80
          );

          player.score += wrongPenalty;

          await updateUser(player.userId, {
            score: player.score,
            currentGameStatus: "playing",
          });

          io.to(roomId).emit("wrongDeclaration", {
            playerId: userId,
            penaltyPoints: wrongPenalty,
          });

          // End turn, no game over
          // game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          // const nextPlayer = game.players[game.currentPlayerIndex];
          // nextPlayer.drawn = false;
          // nextPlayer.discarded = false;

          // io.to(roomId).emit("turnEnded", {
          //   message: `Wrong declaration by ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
          //   currentPlayerId: nextPlayer.userId,
          // });

          // io.to(nextPlayer.socketId).emit("yourTurn", {
          //   message: `It's your turn, ${nextPlayer.userName}`,
          // });
          // return;
        }

        // Valid show
        player.score += 0;

        // Calculate scores for other players
        for (const p of game.players) {
          if (p.userId !== userId) {
            p.score += Math.min(
              calculatePenaltyPoints(p.hand, game.wildCard, p.melds || []),
              80
            );
          }
        }

        // Update database with scores
        for (const p of game.players) {
          await updateUser(p.userId, {
            score: p.score,
            currentGameStatus: "playing",
          });
        }

        if (["pool61", "pool101", "pool201"].includes(game.gameType)) {
          const poolLimit = game.poolLimit;
          const eliminatedPlayers = game.players.filter(
            (p) => p.score >= poolLimit
          );

          // Remove eliminated players
          game.players = game.players.filter((p) => p.score < poolLimit);

          // Notify about eliminations
          if (eliminatedPlayers.length > 0) {
            io.to(roomId).emit("playerEliminated", {
              eliminated: eliminatedPlayers.map((p) => ({
                playerId: p.userId,
                userName: p.userName,
              })),
              message: `${eliminatedPlayers
                .map((p) => p.userName)
                .join(", ")} eliminated for exceeding pool limit.`,
            });

            // Update database for eliminated players
            for (const p of eliminatedPlayers) {
              await updateUser(p.userId, {
                currentGameStatus: "finished",
              });
            }
          }

          // Check if only one player remains
          if (game.players.length === 1) {
            const winner = game.players[0];
            await updateUser(winner.userId, {
              $inc: { gamesWon: 1 },
              currentGameStatus: "finished",
            });

            io.to(roomId).emit("gameOver", {
              gameStatus: "ended",
              winner: winner.userId,
              message: `${winner.userName} wins the Pool Rummy game!`,
              scores: game.players.concat(eliminatedPlayers).map((p) => ({
                playerId: p.userId,
                score: p.score,
              })),
            });

            delete activeGames[roomId];
            return;
          }

          // Start next round
          game.round += 1;
          resetGameForNextRound(game, io, roomId);
          return;
        }

        // Point Rummy logic
        await updateUser(userId, {
          $inc: { gamesWon: 1 },
          currentGameStatus: "finished",
        });

        for (const p of game.players) {
          if (p.userId !== userId) {
            await updateUser(p.userId, {
              currentGameStatus: "finished",
            });
          }
        }

        io.to(roomId).emit("gameOver", {
          gameStatus: "ended",
          winner: userId,
          scores: game.players.map((p) => ({
            playerId: p.userId,
            score: p.score,
          })),
        });

        delete activeGames[roomId];
        return;
      }

      // Notify about melds laid down (not a show)
      io.to(roomId).emit("meldsLaidDown", {
        playerId: userId,
        melds: player.melds,
      });

      // End turn
      // game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      // const nextPlayer = game.players[game.currentPlayerIndex];
      // nextPlayer.drawn = false;
      // nextPlayer.discarded = false;

      io.to(roomId).emit("turnEnded", {
        message: `Melds laid down by ${player.userName}. Now it's ${nextPlayer.userName}'s turn`,
        currentPlayerId: nextPlayer.userId,
      });

      io.to(nextPlayer.socketId).emit("yourTurn", {
        message: `It's your turn, ${nextPlayer.userName}`,
      });
    } catch (error) {
      console.error("Error in layDownMelds event:", error);
      socket.emit("turnError", { message: "An unexpected error occurred." });
    }
  });

  socket.on("dropGame", async () => {
    try {
      // Authentication check
      if (!socket.user?._id) {
        return socket.emit("turnError", { message: "Unauthorized access." });
      }

      // Room validation
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

      const playerIndex = game.players.findIndex((p) => p.userId === userId);
      if (playerIndex === -1) {
        return socket.emit("turnError", {
          message: "Player not found in the game.",
        });
      }

      const player = game.players[playerIndex];

      const penalty = player.drawn ? 40 : 20;
      player.score = penalty;

      await User.findByIdAndUpdate(
        userId,
        {
          $set: { score: penalty },
          currentGameStatus: "finished",
        },
        { new: true }
      );

      io.to(roomId).emit("playerDropped", {
        message: `${player.userName} has dropped from the game.`,
        playerId: player.userId,
        penalty,
        scores: [
          ...game.players.map((p) => ({
            // playerId: p.userId,
            score: p.score,
            status: "active",
          })),

          {
            playerId: player.userId,
            score: player.score,
            status: "dropped",
          },
        ],
      });

      console.log(`Player ${player.userName} dropped from game ${roomId}`);

      // Remove player from active game
      game.players.splice(playerIndex, 1);

      if (game.players.length === 1) {
        const winner = game.players[0];

        io.to(roomId).emit("gameOver", {
          message: `🎉 ${winner.userName} wins! All other players have dropped.`,
          winnerId: winner.userId,
          scores: [
            ...game.players.map((p) => ({
              playerId: p.userId,
              score: p.score,
            })),
            {
              playerId: player.userId,
              score: player.score,
            },
          ],
        });

        delete activeGames[roomId];
        return;
      }

      if (game.players.length === 0) {
        delete activeGames[roomId];
        return;
      }

      io.to(roomId).emit("gameContinues", {
        message: "The game continues with the remaining players.",
        remainingPlayers: game.players.map((p) => ({
          playerId: p.userId,
          userName: p.userName,
          score: p.score,
        })),
      });
    } catch (error) {
      console.error("Error in dropGame event:", error);
      socket.emit("turnError", { message: "An unexpected error occurred." });
    }
  });

  // socket.on("leaveRoom", () => {
  //   console.log(`GameEvent: User disconnected: ${socket.id}`);

  //   for (const roomId in activeGames) {
  //     const game = activeGames[roomId];
  //     const playerIndex = game.players.findIndex(
  //       (p) => p.socketId === socket.id
  //     );

  //     if (playerIndex !== -1) {
  //       const leavingPlayer = game.players[playerIndex];
  //       game.players.splice(playerIndex, 1);

  //       // clearTimeout(game.turnTimer);
  //       // clearTimeout(game.warningTimer);

  //       if (game.players.length === 1) {
  //         const winner = game.players[0];

  //         io.to(winner.socketId).emit("gameOver", {
  //           message: `🎉 You win ${leavingPlayer.userName} left the game.`,
  //           winnerId: winner.userId,
  //         });

  //         console.log(
  //           ` ${winner.userName} wins. ${leavingPlayer.userName} left.`
  //         );

  //         delete activeGames[roomId];
  //       } else if (game.players.length === 0) {
  //         delete activeGames[roomId];
  //       } else {
  //         io.to(roomId).emit("playerLeft", {
  //           message: `${leavingPlayer.userName} left the game.`,
  //           playerId: leavingPlayer.userId,
  //         });
  //       }

  //       break;
  //     }
  //   }
  // });

  socket.on("leaveRoom", () => {
    console.log(`GameEvent: User disconnected: ${socket.id}`);

    for (const roomId in activeGames) {
      const game = activeGames[roomId];
      const playerIndex = game.players.findIndex(
        (p) => p.socketId === socket.id
      );

      if (playerIndex !== -1) {
        const leavingPlayer = game.players[playerIndex];
        game.players.splice(playerIndex, 1);

        if (playerIndex < game.currentPlayerIndex) {
          game.currentPlayerIndex -= 1;
        } else if (playerIndex === game.currentPlayerIndex) {
          if (game.players.length > 0) {
            if (game.currentPlayerIndex >= game.players.length) {
              game.currentPlayerIndex = 0;
            }

            const nextPlayer = game.players[game.currentPlayerIndex];
            io.to(nextPlayer.socketId).emit("yourTurn", {
              message: "It's your turn!",
            });
          }
        }

        if (game.players.length === 1) {
          const winner = game.players[0];

          io.to(winner.socketId).emit("gameOver", {
            message: `🎉 You win! ${leavingPlayer.userName} left the game.`,
            winnerId: winner.userId,
          });
          console.log(
            `${winner.userName} wins. ${leavingPlayer.userName} left.`
          );

          delete activeGames[roomId];
        } else if (game.players.length === 0) {
          delete activeGames[roomId];
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
  socket.on("disconnect", () => {});
};
