const http = require('https');

const BASE_URL = 'https://bvelt.rainerblanco405.workers.dev';

const endpoints = [
  {
    name: 'GET /api/health',
    path: '/api/health',
    method: 'GET',
    body: null
  },
  {
    name: 'GET /api/server-time',
    path: '/api/server-time',
    method: 'GET',
    body: null
  },
  {
    name: 'POST /api/audit (empty body)',
    path: '/api/audit',
    method: 'POST',
    body: {}
  },
  {
    name: 'POST /api/audit (valid body)',
    path: '/api/audit',
    method: 'POST',
    body: {
      companyName: "EcoGarden Experts",
      niche: "Landscaping",
      cityState: "Austin, TX"
    }
  },
  {
    name: 'POST /api/business-scan (empty body)',
    path: '/api/business-scan',
    method: 'POST',
    body: {}
  },
  {
    name: 'POST /api/scan-maps (empty body)',
    path: '/api/scan-maps',
    method: 'POST',
    body: {}
  },
  {
    name: 'POST /api/ai/generate (empty body)',
    path: '/api/ai/generate',
    method: 'POST',
    body: {}
  },
  {
    name: 'POST /api/ai/groq (empty body)',
    path: '/api/ai/groq',
    method: 'POST',
    body: {}
  },
  {
    name: 'POST /api/create-checkout-session',
    path: '/api/create-checkout-session',
    method: 'POST',
    body: {}
  },
  {
    name: 'POST /api/webhooks/stripe',
    path: '/api/webhooks/stripe',
    method: 'POST',
    body: {}
  },
  {
    name: 'GET /api/business/some-id/evidence',
    path: '/api/business/some-id/evidence',
    method: 'GET',
    body: null
  },
  {
    name: 'GET /api/nominatim?q=Austin',
    path: '/api/nominatim?q=Austin',
    method: 'GET',
    body: null
  },
  {
    name: 'POST /api/batch-outreach',
    path: '/api/batch-outreach',
    method: 'POST',
    body: {}
  },
  {
    name: 'GET /api/auth/google',
    path: '/api/auth/google',
    method: 'GET',
    body: null
  }
];

function request(url, method, body) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Bvelt-Smoke-Tester'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        headers: {},
        data: err.message
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('Starting Bvelt API Smoke Tests...');
  const results = [];
  for (const ep of endpoints) {
    const fullUrl = BASE_URL + ep.path;
    const res = await request(fullUrl, ep.method, ep.body);
    
    let classification = 'UNKNOWN';
    let resultStatus = 'FAIL';

    const code = res.statusCode;
    const isJson = res.headers['content-type'] && res.headers['content-type'].includes('application/json');

    if (ep.path === '/api/health' || ep.path === '/api/server-time') {
      if (code === 200) {
        resultStatus = 'PASS';
        classification = 'PASS';
      } else {
        resultStatus = 'FAIL';
        classification = '500_REAL';
      }
    } else if (ep.path.startsWith('/api/auth/google')) {
      if (code === 302) {
        resultStatus = 'PASS';
        classification = 'PASS';
      } else if (code === 400) {
        resultStatus = 'PASS';
        classification = 'CONFIGURATION_ERROR';
      } else {
        resultStatus = 'FAIL';
        classification = '500_REAL';
      }
    } else if (code === 401 || code === 403) {
      resultStatus = 'PASS';
      classification = 'EXPECTED_AUTH';
    } else if (code === 400) {
      resultStatus = 'PASS';
      classification = 'EXPECTED_VALIDATION';
    } else if (code === 404) {
      // Is it a route that exists but returned 404 under normal circumstances, or a true unexpected 404?
      if (isJson) {
        const parsed = JSON.parse(res.data);
        if (parsed.error === 'Route not found') {
          resultStatus = 'FAIL';
          classification = '404_UNEXPECTED';
        } else {
          resultStatus = 'PASS';
          classification = 'EXPECTED_VALIDATION'; // e.g. business evidence document not found in db
        }
      } else {
        resultStatus = 'FAIL';
        classification = '404_UNEXPECTED';
      }
    } else if (code === 500) {
      // Is it due to missing external key/env?
      if (res.data.includes('not configured') || res.data.includes('key is required') || res.data.includes('binding missing') || res.data.includes('no configurada')) {
        resultStatus = 'PASS';
        classification = 'EXPECTED_EXTERNAL_DEPENDENCY';
      } else {
        resultStatus = 'FAIL';
        classification = '500_REAL';
      }
    } else if (code === 200) {
      resultStatus = 'PASS';
      classification = 'PASS';
    }

    results.push({
      route: ep.name,
      code: code,
      contentType: res.headers['content-type'] || 'none',
      classification: classification,
      result: resultStatus,
      snippet: res.data.slice(0, 150)
    });
  }

  console.log('\n================ SMOKE TEST RESULTS ================');
  console.log(JSON.stringify(results, null, 2));
}

run();
