module.exports = (io, socket) => {

  const activeGames = {};

  
  // ========================  joinRoom Event Handler  ======================== >
  
  socket.on("joinRoom", ({ roomId, userId, userName }) => {
    if (!userId || !userName) {
      socket.emit("error", { message: "Invalid data. userId and userName are required." });
      return;
    }

    // If no roomId is provided, find an existing room with space
    if (!roomId) {
      for (const [existingRoomId, game] of Object.entries(activeGames)) {
        if (game.players.length < 2) {  
          roomId = existingRoomId;
          break;
        }
      }
      
      // If no available room, create a new one
      if (!roomId) {
        roomId = `room_${Object.keys(activeGames).length + 1}`;
        activeGames[roomId] = { players: [] };
      }
    }

    console.log(`User ${userName} (${userId}) is joining room: ${roomId}`);
    
    socket.join(roomId);

    // Track users in the room
    if (!activeGames[roomId]) {
      activeGames[roomId] = { players: [] };
    }
    
    activeGames[roomId].players.push({ userId, userName });

    // Notify all players in the room (including sender)
    io.to(roomId).emit("userJoined", { 
      roomId, 
      userId, 
      userName, 
      message: `${userName} has joined the room.` 
    });

    // Send confirmation to the joining user
    socket.emit("joinedRoom", { 
      roomId, 
      message: `You have joined room: ${roomId}`,
      players: activeGames[roomId].players
    });
  });

  
  // ========================  startGame Event Handler  ======================== >
   
  socket.on("startGame", ({ roomId }) => {
    if (!roomId) {
      socket.emit("error", { message: "roomId is required to start the game." });
      return;
    }

    // Check if the room exists
    if (!activeGames[roomId]) {
      socket.emit("error", { message: "Room not found. Players must join first." });
      return;
    }

    // Check if there are at least 2 players
    if (activeGames[roomId].players.length < 2) {
      socket.emit("error", { message: "At least 2 players are required to start the game." });
      return;
    }

    console.log(`Game started in room: ${roomId}`);

    // Send game start event to all players in the room
    io.to(roomId).emit("gameStarted", { 
      roomId, 
      message: "Game has started!", 
      players: activeGames[roomId].players 
    });
  });

};
