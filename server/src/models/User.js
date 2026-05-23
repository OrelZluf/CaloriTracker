const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  google_id: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  avatar_url: {
    type: String,
    default: null
  },
  height_cm: {
    type: Number,
    default: null
  },
  weight_kg: {
    type: Number,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    default: null
  },
  age: {
    type: Number,
    default: null
  },
  daily_calorie_goal: {
    type: Number,
    default: 2000
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// To match existing SQLite response schema where ids were strings/numbers named 'id'
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
