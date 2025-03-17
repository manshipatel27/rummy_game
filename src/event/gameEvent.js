module.exports = (io, socket) => {

  try {
    socket.on("joinRoom", ({ roomId, userId, userName }) => {
      socket.join(roomId);
      console.log(`${userName} has joined room ${roomId}`);
      io.to(roomId).emit("userjoined", { userId, userName });
    });

    socket.on("leaveRoom", ({ roomId, userId, userName }) => {
      socket.leave(roomId);
      console.log(`${userName} has left room ${roomId}`);
      io.to(roomId).emit("userleft", { userId, userName });
    });

  } catch (error) {
    console.log(error, "something went wrong");
  }
};
