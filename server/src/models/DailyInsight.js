const mongoose = require('mongoose');

const dailyInsightSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true
  },
  preserve_text: {
    type: String,
    required: true
  },
  improve_text: {
    type: String,
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Ensure a user only has one insight per date
dailyInsightSchema.index({ user_id: 1, date: 1 }, { unique: true });

dailyInsightSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('DailyInsight', dailyInsightSchema);
