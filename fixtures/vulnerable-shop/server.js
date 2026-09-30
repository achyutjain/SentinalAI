const express = require("express");
const crypto = require("crypto");
const { exec } = require("child_process");

const app = express();
app.use(express.json());

// NOTE: hardcoded secret left in for the demo — Gitleaks should flag this.
// Value is a redacted placeholder (not a real or valid Stripe key format) so it
// can't trip GitHub's partner secret-scanning patterns when this repo is public.
const STRIPE_API_KEY = "sk_live_REDACTED-DEMO-PLACEHOLDER-0000-0000-0000";

const sessions = new Map();
const COUPON_CODE = "SAVE50";
const COUPON_DISCOUNT = 50;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Guest sessions are handed out freely, with no rate limiting — anyone can mint one.
app.post("/session/guest", (req, res) => {
  const token = crypto.randomBytes(16).toString("hex");
  sessions.set(token, { couponUsed: false, discountApplied: 0, total: 100 });
  res.json({ token });
});

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace("Bearer ", "");
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ error: "invalid session" });
  req.session = session;
  next();
}

// Business rule: "a coupon should apply once per order."
// VULNERABLE: the "already used" check and the "mark used" write are two separate steps with an
// await (simulating a payment-provider round trip) in between, and no lock/transaction guarding
// them — a classic TOCTOU race condition. Concurrent requests can all pass the check before any
// of them commits, letting the discount stack without limit.
app.post("/coupon/redeem", auth, async (req, res) => {
  const { code } = req.body;
  if (code !== COUPON_CODE) {
    return res.status(400).json({ error: "invalid coupon" });
  }

  if (req.session.couponUsed) {
    return res.status(409).json({ error: "coupon already used" });
  }

  await delay(50); // simulated DB / payment-provider round trip

  req.session.couponUsed = true;
  req.session.discountApplied += COUPON_DISCOUNT;
  req.session.total = Math.max(0, req.session.total - COUPON_DISCOUNT);

  res.json({ ok: true, discountApplied: req.session.discountApplied, total: req.session.total });
});

app.get("/cart", auth, (req, res) => {
  res.json(req.session);
});

// VULNERABLE: classic OS command injection — left in so Semgrep's security-audit ruleset has
// something concrete to flag, alongside the business-logic bug that scanners can't see.
app.get("/admin/ping", (req, res) => {
  const host = req.query.host;
  exec(`ping -n 1 ${host}`, (err, stdout) => {
    res.send(stdout || String(err));
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`vulnerable-shop listening on ${port}`));
