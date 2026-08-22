// k6 load test for DiaryArchive API
// Run: k6 run scripts/loadtest.js
// Or with options: k6 run --vus 200 --duration 5m scripts/loadtest.js
//
// Targets:
//   - 200 concurrent users
//   - P95 response time < 500ms
//   - Error rate < 1%
//   - Sustained throughput ~500 req/s

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://api.diaryarchive.com";
const USERNAME = __ENV.TEST_USER || "";
const PASSWORD = __ENV.TEST_PASS || "";

const errorRate = new Rate("errors");
const loginDuration = new Trend("login_duration");
const diaryListDuration = new Trend("diary_list_duration");
const diaryReadDuration = new Trend("diary_read_duration");
const searchDuration = new Trend("search_duration");

export const options = {
  stages: [
    { duration: "30s", target: 20 },   // ramp up
    { duration: "1m", target: 100 },   // ramp to 100
    { duration: "2m", target: 200 },   // ramp to 200
    { duration: "5m", target: 200 },   // sustain 200
    { duration: "1m", target: 50 },    // ramp down
    { duration: "30s", target: 0 },    // ramp to 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    errors: ["rate<0.01"],
    http_reqs: ["rate>100"],
  },
};

function getHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function () {
  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/api/v1/health`);
    check(res, {
      "health status is 200": (r) => r.status === 200,
      "health is healthy": (r) => JSON.parse(r.body).status === "healthy",
    });
    errorRate.add(res.status !== 200);
  });

  group("Public Diaries", () => {
    const page = randomInt(1, 5);
    const res = http.get(`${BASE_URL}/api/v1/diaries?page=${page}&limit=12`, {
      headers: getHeaders(),
    });
    diaryListDuration.add(res.timings.duration);
    check(res, {
      "diary list status is 200": (r) => r.status === 200,
      "diary list has data": (r) => {
        try {
          return JSON.parse(r.body).diaries !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
  });

  group("Search", () => {
    const queries = ["life", "thoughts", "journey", "memory", "moment"];
    const q = queries[randomInt(0, queries.length - 1)];
    const res = http.get(`${BASE_URL}/api/v1/search?q=${q}&limit=10`, {
      headers: getHeaders(),
    });
    searchDuration.add(res.timings.duration);
    check(res, {
      "search status is 200": (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // Authenticated flows (if credentials provided)
  if (USERNAME && PASSWORD) {
    let token = null;

    group("Login", () => {
      const res = http.post(
        `${BASE_URL}/api/v1/auth/login`,
        JSON.stringify({ username: USERNAME, password: PASSWORD }),
        { headers: getHeaders() }
      );
      loginDuration.add(res.timings.duration);
      check(res, {
        "login status is 200": (r) => r.status === 200,
        "login has token": (r) => {
          try {
            const body = JSON.parse(r.body);
            token = body.access_token;
            return body.access_token !== undefined;
          } catch {
            return false;
          }
        },
      });
      errorRate.add(res.status !== 200);
    });

    if (token) {
      group("Read Diary (authenticated)", () => {
        const diariesRes = http.get(
          `${BASE_URL}/api/v1/diaries?page=1&limit=12`,
          { headers: getHeaders(token) }
        );
        if (diariesRes.status === 200) {
          try {
            const diaries = JSON.parse(diariesRes.body).diaries;
            if (diaries && diaries.length > 0) {
              const diaryId = diaries[0]._id;
              const res = http.get(`${BASE_URL}/api/v1/diaries/${diaryId}`, {
                headers: getHeaders(token),
              });
              diaryReadDuration.add(res.timings.duration);
              check(res, {
                "diary read status is 200": (r) => r.status === 200,
              });
              errorRate.add(res.status !== 200);
            }
          } catch {
            // ignore parse errors
          }
        }
      });

      group("Notifications", () => {
        const res = http.get(`${BASE_URL}/api/v1/notifications?page=1&limit=10`, {
          headers: getHeaders(token),
        });
        check(res, {
          "notifications status is 200": (r) => r.status === 200,
        });
        errorRate.add(res.status !== 200);
      });
    }
  }

  sleep(randomInt(1, 3));
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] || 0;
  const errorPercent = (data.metrics.errors?.values?.rate || 0) * 100;
  const rps = data.metrics.http_reqs?.values?.rate || 0;

  console.log("\n========== LOAD TEST RESULTS ==========");
  console.log(`P95 Latency:    ${p95.toFixed(0)}ms (target: <500ms)`);
  console.log(`Error Rate:     ${errorPercent.toFixed(2)}% (target: <1%)`);
  console.log(`Throughput:     ${rps.toFixed(0)} req/s (target: >100)`);
  console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log("========================================\n");

  const passed =
    p95 < 500 && errorPercent < 1 && rps > 100;
  console.log(passed ? "RESULT: PASS" : "RESULT: FAIL");

  return {};
}
