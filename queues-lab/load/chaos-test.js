import http from 'k6/http';
import { check, sleep } from 'k6';

// ---- Edit these to change what the chaos run exercises ----
const CONFIG = {
  BASE_URL: 'http://localhost:3001',
  // '/webhooks/payment' = async/queued path, '/webhooks/payment/sync' = naive control group.
  ENDPOINT: '/webhooks/payment',

  DUPLICATE_RETRY: {
    enabled: true,
    orderId: 1,
    repeatCount: 5, // how many times the same providerEventId is resent back-to-back
  },

  OUT_OF_ORDER: {
    enabled: true,
    orderId: 2, // sends "refunded" then "paid" for this same order
  },

  BURST: {
    enabled: true,
    distinctEvents: 30, // number of distinct events fired at once (load spike)
  },
};
// -------------------------------------------------------------

function post(payload) {
  const res = http.post(`${CONFIG.BASE_URL}${CONFIG.ENDPOINT}`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'status is 200': (r) => r.status === 200 });
  return res;
}

export const options = {
  scenarios: {
    ...(CONFIG.DUPLICATE_RETRY.enabled && {
      duplicate_retry: {
        executor: 'shared-iterations',
        vus: 1,
        iterations: CONFIG.DUPLICATE_RETRY.repeatCount,
        exec: 'duplicateRetry',
      },
    }),
    ...(CONFIG.OUT_OF_ORDER.enabled && {
      out_of_order: {
        executor: 'shared-iterations',
        vus: 1,
        iterations: 1,
        exec: 'outOfOrder',
      },
    }),
    ...(CONFIG.BURST.enabled && {
      burst: {
        executor: 'per-vu-iterations',
        vus: CONFIG.BURST.distinctEvents,
        iterations: 1,
        exec: 'burst',
      },
    }),
  },
};

// Simulates a payment provider retrying the exact same webhook delivery
// several times in quick succession (same providerEventId).
export function duplicateRetry() {
  post({
    providerEventId: 'evt-duplicate-demo',
    orderId: CONFIG.DUPLICATE_RETRY.orderId,
    type: 'paid',
    amount: 42.5,
  });
  sleep(0.2);
}

// Simulates two events for the same order arriving out of order:
// "refunded" shows up before "paid" ever did.
export function outOfOrder() {
  post({
    providerEventId: 'evt-ooo-refunded',
    orderId: CONFIG.OUT_OF_ORDER.orderId,
    type: 'refunded',
    amount: 15.0,
  });
  sleep(0.1);
  post({
    providerEventId: 'evt-ooo-paid',
    orderId: CONFIG.OUT_OF_ORDER.orderId,
    type: 'paid',
    amount: 15.0,
  });
}

// Simulates a burst of distinct events hitting all at once (load spike).
export function burst() {
  const id = `evt-burst-${__VU}-${Date.now()}`;
  post({
    providerEventId: id,
    orderId: __VU,
    type: 'paid',
    amount: Math.round(Math.random() * 1000) / 10,
  });
}
