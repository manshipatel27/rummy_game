const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const { initSocket } = require("./Socket");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
app.use(express.json());
app.use(cors());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

const db = require("./config/database");
db.connectDb();

const userRouter = require("./router/userRouter");
app.use("/api/v1", userRouter);

initSocket(server);

app.get("/", (req, res) => {
  res.send("Welcome to the Rummy Game!");
});

server.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
