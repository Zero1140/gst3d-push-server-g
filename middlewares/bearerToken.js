require('dotenv').config();

const bearerToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    if (token === process.env.TEMPORARY_TOKEN || token === process.env.BEARER_TOKEN) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
  } else {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
};

module.exports = bearerToken;
