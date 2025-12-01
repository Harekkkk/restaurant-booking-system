const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const reservationService = require('./service/reservationService'); // Підключили сервіс

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- БАЗА ДАНИХ (Старий код для столиків залишаємо) ---
const db = new sqlite3.Database('./restaurant.db');
// Initialize DB (keeps previous init behavior)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        capacity INTEGER,
        status TEXT
    )`);

    db.get("SELECT count(*) as count FROM tables", (err, row) => {
        if (!err && row && row.count === 0) {
            const stmt = db.prepare("INSERT INTO tables (name, capacity, status) VALUES (?, ?, ?)");
            stmt.run("Столик №1 (Вікно)", 2, "available");
            stmt.run("Столик №2 (Зал)", 4, "reserved");
            stmt.run("Столик №3 (VIP)", 6, "available");
            stmt.finalize();
            console.log("Тестові дані додано.");
        }
    });
});

// --- API ---

// GET /tables (Старий код)
app.get('/tables', (req, res) => {
    db.all("SELECT * FROM tables", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "success", data: rows });
    });
});

// === НОВІ МЕТОДИ ДЛЯ ПРАКТИЧНОЇ 4 ===

// GET /reservations - Отримати список
app.get('/reservations', (req, res) => {
    const data = reservationService.getAll();
    res.json(data);
});

// POST /reservations - Створити бронювання
app.post('/reservations', (req, res) => {
    try {
        const result = reservationService.create(req.body);
        res.status(201).json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// DELETE /reservations/:id - Видалити бронювання
app.delete('/reservations/:id', (req, res) => {
    const success = reservationService.delete(req.params.id);
    if (success) {
        res.status(204).send();
    } else {
        res.status(404).json({ error: "Бронювання не знайдено" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});