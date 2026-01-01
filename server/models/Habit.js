const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true
  },
  completions: {
    type: Map,
    of: Boolean,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for efficient queries
habitSchema.index({ userId: 1, year: 1, month: 1 });

module.exports = mongoose.model('Habit', habitSchema);