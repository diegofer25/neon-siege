/**
 * Dev utility: send a properly-signed test webhook to localhost.
 * Run: bun run scripts/test-webhook.ts [userId]
 */
import crypto from 'crypto';

const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_edc6d0518be5d725d182978ffb3c0a768ab7b5fc160bb4531b40999f2b0736d6';
const ENDPOINT = 'http://localhost:3000/api/credits/webhook';
const TEST_USER_ID = process.argv[2] || 'test-user-123';

const payload = JSON.stringify({
  id: `evt_test_${Date.now()}`,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: `cs_test_${Date.now()}`,
      object: 'checkout.session',
      metadata: { userId: TEST_USER_ID, creditsAmount: '10' },
      payment_status: 'paid',
    },
  },
});

// Stripe signature format: t=<ts>,v1=<hmac(ts.payload, secret)>
// The secret used is the full `whsec_...` string as a UTF-8 key
const ts = Math.floor(Date.now() / 1000);
const signedPayload = `${ts}.${payload}`;
const hmac = crypto.createHmac('sha256', WHSEC).update(signedPayload, 'utf8').digest('hex');
const signature = `t=${ts},v1=${hmac}`;

console.log(`Sending test checkout.session.completed for userId: ${TEST_USER_ID}`);

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
  body: payload,
});

console.log('HTTP Status:', res.status);
console.log('Response:  ', await res.text());
