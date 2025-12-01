const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto');
const reservationService = require('./service/reservationService');

const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());

const idemStore = new Map();
const rateStore = new Map();
const RATE_WINDOW_MS = 10000;
const MAX_REQ_COUNT = 8;

app.use((req, res, next) => {
    const rid = req.get("X-Request-Id") || crypto.randomUUID();
    req.rid = rid;
    res.setHeader("X-Request-Id", rid);
    next();
});

app.use((req, res, next) => {
    const ip = req.ip || "local";
    const now = Date.now();
    const record = rateStore.get(ip) || { count: 0, ts: now };
    if (now - record.ts > RATE_WINDOW_MS) {
        record.count = 1;
        record.ts = now;
    } else {
        record.count++;
    }
    rateStore.set(ip, record);
    if (record.count > MAX_REQ_COUNT) {
        res.setHeader("Retry-After", "2");
        return res.status(429).json({
            error: "Too Many Requests",
            code: "RATE_LIMIT_EXCEEDED",
            requestId: req.rid
        });
    }
    next();
});

const db = new sqlite3.Database('./restaurant.db');

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

app.get('/tables', (req, res) => {
    db.all("SELECT * FROM tables", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message, requestId: req.rid });
        res.json({ message: "success", data: rows });
    });
});

app.get('/reservations', (req, res) => {
    res.json(reservationService.getAll());
});

app.post('/reservations', (req, res) => {
    const idempotencyKey = req.get("Idempotency-Key");
    if (!idempotencyKey) {
        return res.status(400).json({
            error: "Bad Request",
            code: "IDEMPOTENCY_KEY_REQUIRED",
            details: "Header 'Idempotency-Key' is missing",
            requestId: req.rid
        });
    }
    if (idemStore.has(idempotencyKey)) {
        console.log(`Повторний запит з ключем: ${idempotencyKey}`);
        return res.status(201).json(idemStore.get(idempotencyKey));
    }
    try {
        const result = reservationService.create(req.body);
        idemStore.set(idempotencyKey, result);
        res.status(201).json(result);
    } catch (e) {
        res.status(400).json({ error: e.message, requestId: req.rid });
    }
});

app.delete('/reservations/:id', (req, res) => {
    const success = reservationService.delete(req.params.id);
    if (success) res.status(204).send();
    else res.status(404).json({ error: "Not Found", requestId: req.rid });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});