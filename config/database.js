const mongoose = require('mongoose');
require('dotenv').config();

exports.connectDb = async (params) => {
    try {
        mongoose.connect(process.env.MONGO_URI)
        console.log('Database connected successfully');        

    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1); 
    }
}