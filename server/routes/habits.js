const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Habit = require('../models/Habit');

// Get habits for a specific month
router.get('/:year/:month', auth, async (req, res) => {
  try {
    const habits = await Habit.find({
      userId: req.user.id,
      year: parseInt(req.params.year),
      month: parseInt(req.params.month)
    });
    res.json(habits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create or update habits for a month
router.post('/:year/:month', auth, async (req, res) => {
  try {
    const { habits } = req.body;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    // Delete existing habits for this month
    await Habit.deleteMany({
      userId: req.user.id,
      year,
      month
    });

    // Create new habits
    const habitDocs = habits.map(habit => ({
      userId: req.user.id,
      name: habit.name,
      year,
      month,
      completions: habit.completions || {}
    }));

    const savedHabits = await Habit.insertMany(habitDocs);
    res.json(savedHabits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get yearly report
router.get('/report/:year', auth, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const habits = await Habit.find({
      userId: req.user.id,
      year
    });
    res.json(habits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;