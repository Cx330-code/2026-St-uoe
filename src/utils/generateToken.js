const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

exports.generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.accessTokenSecret, { expiresIn: jwtConfig.accessTokenExpiry });
};

exports.generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshTokenSecret, { expiresIn: jwtConfig.refreshTokenExpiry });
};