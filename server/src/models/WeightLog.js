const mongoose = require('mongoose');

const weightLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  weight_kg: {
    type: Number,
    required: true,
    min: 20,
    max: 500
  },
  date: {
    type: String,
    required: true
  },
  note: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

weightLogSchema.index({ user_id: 1, date: 1 }, { unique: true });

weightLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('WeightLog', weightLogSchema);
