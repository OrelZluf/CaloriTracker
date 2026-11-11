const mongoose = require('mongoose');

const waterLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String,
    required: true
  },
  amount_ml: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 15000
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

waterLogSchema.index({ user_id: 1, date: 1 }, { unique: true });

waterLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('WaterLog', waterLogSchema);
