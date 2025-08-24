// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fname: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  friends: {
    type: [String],
  },
  status: {
    type: Boolean,
    default: false,
  }
});

// Export the model
module.exports = mongoose.model('User', UserSchema);
