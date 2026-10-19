/**
 * set-admin-claim.js
 * 
 * Script to grant the Firebase custom user claim ({ admin: true, role: 'admin' })
 * to the designated administrator account.
 * 
 * USAGE:
 *   node scripts/set-admin-claim.js <admin-email-or-uid>
 * 
 * SECURITY:
 *   - Uses GOOGLE_APPLICATION_CREDENTIALS environment variable or local serviceAccountKey.json
 *   - NEVER prints or logs any private keys, certificates, or tokens.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

async function main() {
  const targetUser = process.argv[2] || process.env.ADMIN_EMAIL || 'michaelmagednew@gmail.com';

  if (!targetUser) {
    console.error('Error: Please provide target user email or UID: node set-admin-claim.js <email>');
    process.exit(1);
  }

  // Initialize Firebase Admin safely
  if (!admin.apps.length) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(credPath)) {
      admin.initializeApp({
        credential: admin.credential.cert(require(credPath))
      });
    } else {
      // Use application default credentials if available
      admin.initializeApp();
    }
  }

  try {
    let userRecord;
    if (targetUser.includes('@')) {
      userRecord = await admin.auth().getUserByEmail(targetUser);
    } else {
      userRecord = await admin.auth().getUser(targetUser);
    }

    // Set custom claims
    const existingClaims = userRecord.customClaims || {};
    const updatedClaims = { ...existingClaims, admin: true, role: 'admin' };

    await admin.auth().setCustomUserClaims(userRecord.uid, updatedClaims);

    console.log(`[SUCCESS] Admin custom claim granted successfully.`);
    console.log(`Target UID: ${userRecord.uid}`);
    console.log(`Claims set: { admin: true, role: 'admin' }`);
    console.log(`Note: The user will receive the updated claim on their next token refresh (getIdToken(true)).`);
    process.exit(0);
  } catch (err) {
    console.error(`[ERROR] Failed to set admin claim:`, err.message);
    process.exit(1);
  }
}

main();
