const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  estimated_grams: { type: Number, required: true },
  calories: { type: Number, required: true },
  protein_grams: { type: Number, required: true },
  carbs_grams: { type: Number, required: true },
  fat_grams: { type: Number, required: true },
  fiber_grams: { type: Number, default: 0 },
  sugar_grams: { type: Number, default: 0 }
});

const mealSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  image_path: {
    type: String,
    default: null
  },
  meal_type: {
    type: String,
    required: true
  },
  total_calories: { type: Number, required: true },
  total_protein: { type: Number, required: true },
  total_carbs: { type: Number, required: true },
  total_fat: { type: Number, required: true },
  input_method: { type: String, required: true },
  raw_input: { type: String, default: null },
  ingredients: [ingredientSchema]
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

mealSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Meal', mealSchema);
