const Interest = require('../models/Interest');
const UserInterest = require('../models/UserInterest');

// Add user interests
exports.addUserInterests = async (req, res) => {
  const { interests } = req.body;  // Array of interest IDs
  const userId = req.user.id;

  try {
    const interestPromises = interests.map(interestId => 
      UserInterest.create({ user_id: userId, interest_id: interestId })
    );
    await Promise.all(interestPromises);
    res.status(200).send({ message: 'Interests added successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Error adding interests' });
  }
};

// Get all available interests
exports.getInterests = async (req, res) => {
  try {
    const interests = await Interest.findAll();
    res.status(200).send(interests);
  } catch (error) {
    res.status(500).send({ error: 'Error fetching interests' });
  }
};
