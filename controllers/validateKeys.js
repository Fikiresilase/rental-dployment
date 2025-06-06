const crypto = require('crypto');

// Function to validate public and private keys
function validateKeys(publicKey, privateKey) {
  try {
    // Validate public key
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error('Public key is empty or not a string');
    }
    if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----') || !publicKey.endsWith('-----END PUBLIC KEY-----')) {
      throw new Error('Public key is not in valid PEM format');
    }
    crypto.createPublicKey(publicKey);
    console.log('Public key validation: Success', {
      publicKeySnippet: publicKey.slice(0, 50) + '...',
      publicKeyLength: publicKey.length,
      timestamp: new Date().toISOString(),
    });

    // Validate private key
    if (!privateKey || typeof privateKey !== 'string') {
      throw new Error('Private key is empty or not a string');
    }
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.endsWith('-----END PRIVATE KEY-----')) {
      throw new Error('Private key is not in valid PEM format');
    }
    crypto.createPrivateKey(privateKey);
    console.log('Private key validation: Success', {
      privateKeySnippet: privateKey.slice(0, 50) + '...',
      privateKeyLength: privateKey.length,
      timestamp: new Date().toISOString(),
    });

    // Test key pair functionality with sign/verify
    const testMessage = 'Test message'; 
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(testMessage);
    const signature = signer.sign(privateKey, 'base64');

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(testMessage);
    const isValid = verifier.verify(publicKey, signature, 'base64');

    if (!isValid) {
      throw new Error('Key pair verification failed: Signature is invalid');
    }

    console.log('Key pair verification: Success', {
      message: testMessage,
      signatureSnippet: signature.slice(0, 20) + '...',
      isValid,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Key validation failed:', {
      error: error.message,
      publicKeySnippet: publicKey ? publicKey.slice(0, 50) + '...' : 'undefined',
      privateKeySnippet: privateKey ? privateKey.slice(0, 50) + '...' : 'undefined',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

// Function to validate a signature for given data
function validateSignature(publicKey, data, signature) {
  try {
    // Validate inputs
    if (!publicKey || typeof publicKey !== 'string') {
      throw new Error('Public key is empty or not a string');
    }
    if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----') || !publicKey.endsWith('-----END PUBLIC KEY-----')) {
      throw new Error('Public key is not in valid PEM format');
    }
    if (!signature || typeof signature !== 'string') {
      throw new Error('Signature is empty or not a string');
    }
    if (!data) {
      throw new Error('Data is empty or undefined');
    }

    // Normalize data (stringify if object)
    const dataString = typeof data === 'string' ? data : JSON.stringify(data, Object.keys(data).sort());

    console.log('Validating signature:', {
      publicKeySnippet: publicKey.slice(0, 50) + '...',
      dataSnippet: dataString.slice(0, 100) + (dataString.length > 100 ? '...' : ''),
      signatureSnippet: signature.slice(0, 20) + '...',
      timestamp: new Date().toISOString(),
    });

    // Create public key object
    let keyObject;
    try {
      keyObject = crypto.createPublicKey(publicKey);
    } catch (error) {
      throw new Error(`Invalid public key format: ${error.message}`);
    }

    // Verify signature
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(dataString);
    const isValid = verifier.verify(keyObject, signature, 'base64');

    console.log('Signature validation result:', {
      isValid,
      dataSnippet: dataString.slice(0, 50) + '...',
      signatureSnippet: signature.slice(0, 20) + '...',
      timestamp: new Date().toISOString(),
    });

    return isValid;
  } catch (error) {
    console.error('Signature validation failed:', {
      error: error.message,
      publicKeySnippet: publicKey ? publicKey.slice(0, 50) + '...' : 'undefined',
      dataSnippet: typeof data === 'string' ? data.slice(0, 50) + '...' : 'object',
      signatureSnippet: signature ? signature.slice(0, 20) + '...' : 'undefined',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

// Example keys (replace with your generated keys)
const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp0iP8JmPd9fWecUNmYEP
3yV+MBap2z2ioePaexvqf6blh54D7qWCWKtRqd8xfPAs5B4fUmN1oYSIWpj4uNqz
4Zk/ZcKVzJqZnU2eyr/hOOJB09Rx7yaJwAzAFJveZa46Hd6b6UDiDNot8s8MHtHB
ljrjFnzeJU0DoQLZnLC7/nRR6CW1QglfgYU7nEQZyGZWruOioyVBMyIhdv0JfB+i
NbHgdGznNHriJUTl5m91ZQGLDNKtc/NCcfd4klDAvM/fQFP/NxknI9Z6UMWtIR57
h9Xmi4Kx7aLM6npGI9Ot6V/3VolE7FD7oJNl/FWTVMMnj+D9jGJEWcEtb9A9cCuO
xQIDAQAB
-----END PUBLIC KEY-----`;

const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCnSI/wmY9319Z5
xQ2ZgQ/fJX4wFqnbPaKh49p7G+p/puWHngPupYJYq1Gp3zF88CzkHh9SY3WhhIha
mPi42rPhmT9lwpXMmpmdTZ7Kv+E44kHT1HHvJonADMAUm95lrjod3pvpQOIM2i3y
zwwe0cGWOuMWfN4lTQOhAtmcsLv+dFHoJbVCCV+BhTucRBnIZlau46KjJUEzIiF2
/Ql8H6I1seB0bOc0euIlROXmb3VlAYsM0q1z80Jx93iSUMC8z99AU/83GScj1npQ
xa0hHnuH1eaLgrHtoszqekYj063pX/dWiUTsUPugk2X8VZNUwyeP4P2MYkRZwS1v
0D1wK47FAgMBAAECggEAGhtk+3O7xERXIKH0QWS3CWhcjTy8PY8c9o8M5fGxY0K0
x7mNe40xDo2OLSi8HHePSfq5gK4tCYwZi6ocBx16vVahYkw//LKUDsyyX4oaqDoH
c/vP3DbzgJl80LqStuO+BjNbucd6f+79BMvzZEvwHnYKQtQyBzhBvLspIx8h99AG
6bVb46EtX9UDPzx+BO6Xp44qYTHM4lnRPLmgh2iVf/uje44SAadbbHc3G3Ze1ayw
9X74QBSsSnrai78GNdt01vb1+ipq5M4cemF1txZcoqhLXioa4FH1DDIvGHilZWur
uQeU4mW6JpHR1ftYUgi+l6edwvx25VajCCcVfwpl8QKBgQDU+KJFVfmrzMxX1ewR
1daB4qFHw1BzoHGH6BH7I2SwfxZU3cIjOZK7Tx6xAMms0I8PV3BzMjAq3pq/14ZP
7fmVWmr+xb2aCtLq5B0vRLZ7b7r1gtjkincDbsW3EclXCq9aChqhApdiowT+c1bU
XXnp/L0l7vv0MCStI343q+EVVwKBgQDJFNmyxpc8V0DFohug/cJ51mz03uz6uN32
mo9q1D9GzIE6UD7mbWgsv3To10s4T0cqqKurg2p6nOUOQ8/l7FR4F3klqIMrzZm0
QVvmRQbkvJMhurwypTpFEwB3LRQapcvq+NoErUnz/VtVnn2jGUyg+zTtRnEtxvUY
gbrnemgvQwKBgGj55YKnzlmQqWjiWWqxLPr46uakr5NPEqcbDUHtQER/YFKUvI0A
ZANQDKDS8pXsd5foUdV2d6ep8j19zwa3Fr83wmWysrKrgyulJX2XMRvHBzDdPmvo
lKFsiKika8oryiNnt5iF3nkQQfXqhHJJYT6lBdcc5bSHxoxRYnWuk1QhAoGBALrd
BH3trUem8gt3XWObzml5CeH5dJJ+z87GzXaCbZc2nvT486shiwjilxt2T3Gxwrny
6y3FP2NYgEhkXkQV/l1nuu5zDgrb0vW/M07nYMOaNsTGivQptd/RC8K0gpVM9BaV
Uc282BfEn2cOlUTHUv3a1NGXf8ABv20Zyf4pM76PAoGAcQK5aRWLVPOTYB2XWQH/
bfIu/ydmVVN3/2azH+F5tDUHboiSVVi+Rod90ZLZlrtwzCWzWoWwGsK4NvfDBguh
RsPA73XWHePexx8IY5t42M5B6NxCV4IOvGMV5O/O3Eb2WHjXsuDa44uOFhtE4M/P
YeNoJ3ZGRr3ep0STLXVTvaU=
-----END PRIVATE KEY-----`;

// Example usage
try {
  // Validate keys
  validateKeys(publicKey, privateKey);

  // Test signature validation
  const testData = {
      propertyId: '123',
      ownerId: 'owner123',
      renterId: 'renter123',
      terms: 'Test terms',
      
    };

 
  const signature = 'lJEsfJJVc/rGP0Y+t8qGKTNWhaVvkcH6IZTc255Ehd1LDMaYxOJtBG2Zi+tilyUjdiryL0fekBdgnZuZlVvjRlqCoiCi2BrUoybKF47WxdF3BLjx7rw89nFNULP5QF2rwlmtMYMQ76WYGk/hyAbtSu6E+BkG05GWKdB2PmPn0X+5gQkmgCb+jQnQ54Cd46FNR9QkrldopcXjzR+VFQRnIeYbkqnoSYgx8QnhfaOROd0CjNYDYcU9BfWkKy94CfT06uOz5lVN/WuTrGnHF4wIDhesgz5NrHnE5NZEI4HQ0nvBzLoss/0l7LXNrqOBniSyp/xEle02YKZBR9uVLQeJDw=='

  // Validate the signature
  const isValid = validateSignature(publicKey, testData, signature);
  console.log('Test signature validation:', {
    isValid,
    dataSnippet: JSON.stringify(testData).slice(0, 50) + '...',
    signatureSnippet: signature.slice(0, 20) + '...',
    timestamp: new Date().toISOString(),
  });
} catch (error) {
  console.error('Test failed:', {
    error: error.message,
    timestamp: new Date().toISOString(),
  });
}