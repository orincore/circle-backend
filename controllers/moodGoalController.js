const Mood = require('../models/Mood');
const Goal = require('../models/Goal');

// Log mood
exports.logMood = async (req, res) => {
  const { mood_level, description } = req.body;
  const userId = req.user.id;

  try {
    const mood = await Mood.create({ mood_level, description, user_id: userId });
    res.status(201).send(mood);
  } catch (error) {
    res.status(500).send({ error: 'Error logging mood' });
  }
};

// Log goal
exports.logGoal = async (req, res) => {
  const { goal_text } = req.body;
  const userId = req.user.id;

  try {
    const goal = await Goal.create({ goal_text, user_id: userId });
    res.status(201).send(goal);
  } catch (error) {
    res.status(500).send({ error: 'Error logging goal' });
  }
};

// Get all moods
exports.getMoods = async (req, res) => {
  const userId = req.user.id;

  try {
    const moods = await Mood.findAll({ where: { user_id: userId } });
    res.status(200).send(moods);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching moods' });
  }
};

// Get all goals
exports.getGoals = async (req, res) => {
  const userId = req.user.id;

  try {
    const goals = await Goal.findAll({ where: { user_id: userId } });
    res.status(200).send(goals);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching goals' });
  }
};
