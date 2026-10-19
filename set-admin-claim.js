/**
 * Mickey Studio - Firebase Admin Custom Claim Provisioning Script
 * 
 * Usage:
 * 1. Download your service account key from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.
 * 2. Save it as `serviceAccountKey.json` in this directory (DO NOT commit to Git).
 * 3. Run: node set-admin-claim.js michaelmagednew@gmail.com
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Error: serviceAccountKey.json not found in this folder.');
  console.error('Download it from Firebase Console -> Project Settings -> Service accounts.');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const targetEmail = process.argv[2] || 'michaelmagednew@gmail.com';

async function grantAdmin(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      role: 'admin'
    });
    console.log(`✓ Successfully set { admin: true, role: 'admin' } custom claims for ${email} (UID: ${user.uid})`);
    console.log('The user should sign out and sign in again on Mickey Studio to refresh their ID token.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to set admin custom claims:', error.message);
    process.exit(1);
  }
}

grantAdmin(targetEmail);
