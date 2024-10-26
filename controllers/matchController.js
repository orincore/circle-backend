const UserInterest = require('../models/UserInterest');
const User = require('../models/User');

exports.findMatchingUsers = async (req, res) => {
  const userId = req.user.id;
  
  try {
    // Find interests of the current user
    const userInterests = await UserInterest.findAll({ where: { user_id: userId } });
    const interestIds = userInterests.map(ui => ui.interest_id);

    // Find other users with overlapping interests
    const matchingUsers = await UserInterest.findAll({
      where: { interest_id: interestIds },
      include: [{ model: User }],
    });

    // Remove the current user from the matching list
    const matchedUsers = matchingUsers.filter(m => m.user_id !== userId);

    res.status(200).send(matchedUsers);
  } catch (error) {
    res.status(500).send({ error: 'Error finding matches' });
  }
};
