const AWS = require('aws-sdk');

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: 'ap-southeast-1'
});

const userCache = {};

/**
 * Resolves Cognito user email attribute using their sub UUID.
 * Defaults to "Unknown User" on any failure.
 *
 * @param {string} userId - User identifier (Cognito sub UUID)
 * @returns {Promise<string>} Email address
 */
async function getUserEmail(userId) {
  if (!userId || userId === 'guest' || userId === 'test-user') {
    return 'Unknown User';
  }
  if (userCache[userId]) {
    return userCache[userId];
  }
  try {
    const params = {
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: userId
    };
    const user = await cognito.adminGetUser(params).promise();
    const emailAttr = (user.UserAttributes || []).find(attr => attr.Name === 'email');
    const email = emailAttr ? emailAttr.Value : 'Unknown User';
    userCache[userId] = email;
    return email;
  } catch (err) {
    console.error(`Cognito lookup failed for userId ${userId}:`, err);
    return 'Unknown User';
  }
}

module.exports = { getUserEmail };
