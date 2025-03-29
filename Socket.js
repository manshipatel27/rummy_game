const { Server } = require("socket.io");
const gameEventConnection = require("./src/event/gameEvent");

exports.initSocket = (server) => {
  try {
    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
        
    io.on("connection", (socket) => {
      console.log(` User connected: ${socket.id}`);
          
      gameEventConnection(io,socket)

      socket.on("disconnect", () => {
        console.log(` User disconnected: ${socket.id}`);
      });
    });

    return io;
  } catch (error) {
    console.log(error, "something went wrong");
  }
};  
