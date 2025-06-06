const crypto = require('crypto');
const fs = require('fs');

function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  console.log('Private Key:\n', privateKey);
  console.log('Public Key:\n', publicKey);

  // Save keys for reference
  fs.writeFileSync('privateKey.pem', privateKey);
  fs.writeFileSync('publicKey.pem', publicKey);

  return { privateKey, publicKey };
}

generateKeyPair();