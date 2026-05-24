const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  activity_type: {
    type: String,
    required: true
  },
  duration_minutes: {
    type: Number,
    required: true
  },
  calories_burned: {
    type: Number,
    required: true
  },
  met_value: {
    type: Number,
    required: true
  },
  input_method: {
    type: String,
    enum: ['manual', 'text'],
    required: true
  },
  raw_input: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

activitySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Activity', activitySchema);
