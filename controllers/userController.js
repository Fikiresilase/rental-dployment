const User = require('../models/User');


const getUserById = async (req, res) => {
    try {
       
    const user = await User.findById(req.params.id)
      .select('-password') 
      

    if (!user) {;
      return res.status(404).json({ message: 'User not found' });
    }
     console.log(user)
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

module.exports = {
  getUserById
}; 