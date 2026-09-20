import http from 'k6/http';
import { check, sleep } from 'k6';

// ---- Edit these to change the load ----
const CONFIG = {
  VUS: 20,
  DURATION: '30s',
  BASE_URL: 'http://localhost:3000',
  MAX_PRODUCT_ID: 50000,
  // Set to '/no-cache' to hit the control-group endpoint instead.
  PATH_SUFFIX: '',
};
// ----------------------------------------

export const options = {
  vus: CONFIG.VUS,
  duration: CONFIG.DURATION,
};

export default function () {
  const id = Math.floor(Math.random() * CONFIG.MAX_PRODUCT_ID) + 1;
  const res = http.get(`${CONFIG.BASE_URL}/products/${id}${CONFIG.PATH_SUFFIX}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
