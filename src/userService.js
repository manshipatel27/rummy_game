const User = require("../model/userModel");

exports.updateUser = async (userId, updates) => {
  try {
    return await User.findByIdAndUpdate(userId, updates, { new: true, select: "-password" });
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    throw error;
  }
};

exports.updateMelds = async (userId, updateMelds) => {
  try {
    return await User.findByIdAndUpdate(userId, updateMelds, { new: true, select: "-password" });
  } catch (error) {
    console.log("Error updating melds:", error);
    throw error;
  }
};


