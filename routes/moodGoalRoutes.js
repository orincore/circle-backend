// models/Goal.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Goal = sequelize.define('Goal', {
  goal_text: { type: DataTypes.STRING, allowNull: false },
  is_completed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  timestamps: true,
});

Goal.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Goal;
