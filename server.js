const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto'); // Для генерації ID
const reservationService = require('./service/reservationService');

const app = express();
const PORT = 3005; // Змінили, щоб не конфліктувати з демо-стендом

app.use(cors());
app.use(express.json());

// --- ЗБЕРІГАННЯ ДАНИХ (В пам'яті) ---
const idemStore = new Map(); // Сховище для ідемпотентності
const rateStore = new Map(); // Сховище для ліміту запитів
const RATE_WINDOW_MS = 10000; // Вікно 10 секунд
const MAX_REQ_COUNT = 8;      // Максимум 8 запитів за 10 сек

// --- MIDDLEWARE 1: X-Request-Id ---
// Додаємо унікальний ID до кожного запиту [cite: 270-276]
app.use((req, res, next) => {
    const rid = req.get("X-Request-Id") || crypto.randomUUID();
    req.rid = rid;
    res.setHeader("X-Request-Id", rid);
    next();
});

// --- MIDDLEWARE 2: Rate Limiting ---
// Захист від частих запитів [cite: 278-289]
app.use((req, res, next) => {
    const ip = req.ip || "local"; // У реальності брати IP клієнта
    const now = Date.now();
    
    const record = rateStore.get(ip) || { count: 0, ts: now };
    
    // Якщо час вікна пройшов — скидаємо лічильник
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

// --- БАЗА ДАНИХ (Старий код) ---
const db = new sqlite3.Database('./restaurant.db');
// (Ініціалізацію таблиці тут пропускаємо для стислості, вона вже у вас є в файлі БД)

// --- API ---

app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// GET /tables
app.get('/tables', (req, res) => {
    db.all("SELECT * FROM tables", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message, requestId: req.rid });
        res.json({ message: "success", data: rows });
    });
});

// GET /reservations
app.get('/reservations', (req, res) => {
    res.json(reservationService.getAll());
});

// POST /reservations (З ІДЕМПОТЕНТНІСТЮ) [cite: 301-308]
app.post('/reservations', (req, res) => {
    // 1. Перевіряємо ключ ідемпотентності
    const idempotencyKey = req.get("Idempotency-Key");
    
    if (!idempotencyKey) {
        return res.status(400).json({ 
            error: "Bad Request", 
            code: "IDEMPOTENCY_KEY_REQUIRED",
            details: "Header 'Idempotency-Key' is missing",
            requestId: req.rid 
        });
    }

    // 2. Якщо такий ключ вже був — повертаємо збережений результат
    if (idemStore.has(idempotencyKey)) {
        console.log(`Повторний запит з ключем: ${idempotencyKey}`);
        return res.status(201).json(idemStore.get(idempotencyKey));
    }

    // 3. Якщо ключа немає — створюємо бронювання
    try {
        const result = reservationService.create(req.body);
        
        // Зберігаємо результат
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