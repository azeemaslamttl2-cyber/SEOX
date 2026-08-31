const { createHash, randomBytes } = require('crypto');
const password = 'Password123!';
const salt = randomBytes(16).toString('hex');
const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
console.log(`sha256$${salt}$${hash}`);
