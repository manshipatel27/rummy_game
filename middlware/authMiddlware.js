const jwt = require("jsonwebtoken");
const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  try {
  if (!token) {
    return res
      .status(401)
      .json({ message: "Access denied. No token provided" });
  }


    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

module.exports = authenticate;
