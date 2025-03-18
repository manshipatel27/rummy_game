module.exports = (io, socket) => {
  try {
    socket.on("joinRoom", (data) => {
      const { roomId, userId, userName } = data;

      // Validate input
      if (!roomId || !userId || !userName) {
        return socket.emit("error", { message: "Missing required fields." });
      }

      socket.join(roomId);
      console.log(`${userName} has joined room ${roomId}`);

      io.to(roomId).emit("userjoined", { roomId, userId, userName });
    });

    socket.on("leaveRoom", (data) => {
      // Ensure 'data' is an object and contains all required fields
      if (!data || typeof data !== "object") {
        return socket.emit("error", { message: "Invalid request format." });
      }

      const { roomId, userId, userName } = data;

      // Check for missing fields
      if (
        roomId === undefined ||
        userId === undefined ||
        userName === undefined
      ) {
        return socket.emit("error", { message: "Missing required fields." });
      }

      // Convert roomId to a string
      const room = String(roomId);

      // Leave the room
      socket.leave(room);
      console.log(`${userName} has left room ${room}`);

      // Notify other users in the room
      io.to(room).emit("userleft", { userId, userName });

      // Send acknowledgment to the leaving user
      socket.emit("leaveRoomAcknowledged", {
        status: "ok",
        message: `${userName} left ${room}`,
      });
    });
  } catch (error) {
    console.error("Error in game events:", error);
    socket.emit("error", { message: "Something went wrong on the server." });
  }
};

// module.exports = (io, socket) => {

//   try {
//     socket.on("joinRoom", ({ roomId, userId, userName }) => {
//       socket.join(roomId);
//       console.log(`${userName} has joined room ${roomId}`);
//       io.to(roomId).emit("userjoined", { userId, userName });
//     });

//     socket.on("leaveRoom", ({ roomId, userId, userName }) => {
//       socket.leave(roomId);
//       console.log(`${userName} has left room ${roomId}`);
//       io.to(roomId).emit("userleft", { userId, userName });
//       socket.emit("leaveRoomAcknowledged", { status: "ok", message: `${userName} left ${roomId}` });
//   });

//   } catch (error) {
//     console.log(error, "something went wrong");
//   }
// };
