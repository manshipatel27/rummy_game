const express = require("express");
const userRouter = express.Router();
const { register,validateRegistration, login, logout} = require("../controller/user_Controller");

// const authenticate = require("../middlware/authMiddlware");


userRouter.post("/register", validateRegistration, register);
userRouter.post("/login", login);
userRouter.post("/logout", logout);

module.exports = userRouter;
