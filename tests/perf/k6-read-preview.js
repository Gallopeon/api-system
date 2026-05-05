import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const p99Latency = new Trend("preview_latency_p99");
const errorRate = new Rate("preview_error_rate");

const BASE_URL = __ENV.BASE_URL || "http://localhost";
const DURATION = __ENV.DURATION || "60s";
const VUS = Number(__ENV.VUS || 40);
const RPS = Number(__ENV.RPS || 800);

export const options = {
  scenarios: {
    steady_read: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: VUS,
      maxVUs: VUS * 2
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<50", "p(99)<150"],
    preview_error_rate: ["rate<0.001"]
  }
};

const payload = JSON.stringify({
  input: {
    data: [
      {
        id: 101,
        name: "Alice",
        email: "alice@example.com",
        phone: "13812345678",
        city: "Shanghai",
        level: 4,
        country: "CN",
        vip: true
      }
    ],
    total: 1,
    page: 1,
    page_size: 20
  },
  inline_rule: {
    whitelist_fields: ["id", "name", "email", "phone", "country", "level", "vip"],
    renames: {
      name: "display_name",
      phone: "mobile"
    },
    masked_fields: ["email", "mobile"],
    computed_literals: {
      source: "k6"
    },
    remove_nulls: true,
    conditional_rules: [
      {
        when: "country == \"CN\" && level >= 3",
        add_literals: {
          tag: "priority"
        },
        stop_after_match: true
      }
    ],
    pagination: {
      data_key: "data",
      total_field: "total",
      page_field: "page",
      page_size_field: "page_size"
    }
  }
});

// Set via: k6 run -e API_KEY=your-key tests/perf/k6-read-preview.js
const API_KEY = __ENV.API_KEY || "";

export default function () {
  const headers = {
    "Content-Type": "application/json"
  };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const response = http.post(`${BASE_URL}/api/v1/transform/preview`, payload, {
    headers: headers,
    timeout: "3s"
  });

  p99Latency.add(response.timings.duration);

  const ok = check(response, {
    "status is 200": (r) => r.status === 200,
    "not 401 (API key valid)": (r) => r.status !== 401,
    "has output": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.output);
      } catch (error) {
        return false;
      }
    }
  });

  errorRate.add(!ok);
  sleep(0.01);
}
