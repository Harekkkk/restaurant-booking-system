const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 3000;

// Дозволяємо браузеру отримувати дані з сервера
app.use(cors());
app.use(express.json());

// --- 1. БАЗА ДАНИХ ---
// Підключаємося або створюємо файл restaurant.db
const db = new sqlite3.Database('./restaurant.db', (err) => {
    if (err) {
        console.error('Помилка БД:', err.message);
    } else {
        console.log('Підключено до бази даних SQLite.');
        initTable();
    }
});

function initTable() {
    db.serialize(() => {
        // Створюємо таблицю tables (id, назва, місця, статус)
        db.run(`CREATE TABLE IF NOT EXISTS tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            capacity INTEGER,
            status TEXT
        )`);

        // Додаємо тестові столики (якщо таблиця пуста)
        db.get("SELECT count(*) as count FROM tables", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare("INSERT INTO tables (name, capacity, status) VALUES (?, ?, ?)");
                stmt.run("Столик №1 (Вікно)", 2, "available");
                stmt.run("Столик №2 (Зал)", 4, "reserved");
                stmt.run("Столик №3 (VIP)", 6, "available");
                stmt.finalize();
                console.log("Тестові дані додано.");
            }
        });
    });
}

// --- 2. API (Серверна частина) ---
// GET /tables -> повертає список всіх столиків
app.get('/tables', (req, res) => {
    db.all("SELECT * FROM tables", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер працює: http://localhost:${PORT}`);
});