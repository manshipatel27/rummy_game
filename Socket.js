const { Server } = require("socket.io");

exports.initSocket = (server) => {
  try {
    const io = new Server(server, {
      cors: {
        origin: "https://localhost:3000",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log(` User connected: ${socket.id}`);

      // socket.on("chatmessage", (msg) => {
      //   console.log(msg);
      //   if (msg === "ping") {
      //     io.emit("responce", "pong");
      //   }
      // });



      // user can join the room by clicking  
      socket.on("join_room", (data) => {
        const roomName = data.room;
        socket.join(roomName);
        console.log(`User joined room: ${roomName}`);
        io.to(roomName).emit("joined", `User joined room: ${roomName}`);
      });


      socket.on("disconnect", () => {
        console.log(` User disconnected: ${socket.id}`);
      });
    });

    return io;
  } catch (error) {
    console.log(error, "something went wrong");
  }
};
