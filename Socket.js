const jwt = require("jsonwebtoken");
const User = require("./model/userModel");
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

    io.use(async (socket, next) => {
      try {
        // const token = socket.handshake.auth?.token;
        const token = socket.handshake.headers['auth'];

        console.log(`token ==> ${token}`);

        if (!token) {
          return next(new Error("Authentication token missing"));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
          return next(new Error("User not found"));
        }
        
        socket.user = user;
        next();
      } catch (err) {
        console.error("Socket auth error:", err.message);
        next(new Error("Unauthorized socket connection"));
      }
    });
  
    io.on("connection", (socket) => {
      console.log(`✅ User connected: ${socket.id} | Name: ${socket.user.name}`);
      gameEventConnection(io, socket);
      

    });
    return io;

    





  } catch (error) {
    console.log(error, "something went wrong");
  }
};  
