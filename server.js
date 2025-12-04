const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./restaurant.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tables (id INTEGER PRIMARY KEY, name TEXT, type TEXT, capacity INTEGER, blocked_until TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, tableId INTEGER, guestName TEXT, startTime TEXT, duration REAL, guestCount INTEGER, comment TEXT, created_at TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, details TEXT, timestamp TEXT, restore_data TEXT)`);

    db.get("SELECT count(*) as count FROM tables", (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare("INSERT INTO tables (id, name, type, capacity) VALUES (?, ?, ?, ?)");
            stmt.run(1, "Столик №1", "Зал", 4);
            stmt.run(2, "Столик №2", "Зал", 4);
            stmt.run(3, "Столик №3", "Вікно", 2);
            stmt.run(4, "Столик №4", "Вікно", 2);
            stmt.run(5, "Столик №5", "VIP", 6);
            stmt.finalize();
        }
    });
});

function logAction(action, details, restoreData = null) {
    const stmt = db.prepare("INSERT INTO audit_logs (action, details, timestamp, restore_data) VALUES (?, ?, ?, ?)");
    stmt.run(action, details, new Date().toISOString(), restoreData ? JSON.stringify(restoreData) : null);
}

function formatTime(dateObj) {
    return dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateObj) {
    return dateObj.toLocaleString('uk-UA', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
}

app.get('/tables', (req, res) => {
    db.all("SELECT * FROM tables", [], (err, tables) => {
        if (err) return res.status(500).json({error: err.message});

        const nowMs = Date.now();
        const lookAhead = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(); 

        db.all("SELECT * FROM reservations WHERE startTime > ?", [lookAhead], (err, reservations) => {
            if (err) return res.status(500).json({error: err.message});

            const enrichedTables = tables.map(table => {
                let statusText = "Вільний";
                let statusClass = "available";
                
                if (table.blocked_until && new Date(table.blocked_until).getTime() > nowMs) {
                    statusText = `Зачинено до ${formatDate(new Date(table.blocked_until))}`;
                    statusClass = "blocked";
                }

                const tableRes = reservations.filter(r => r.tableId === table.id);
                tableRes.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

                for (let r of tableRes) {
                    const start = new Date(r.startTime).getTime();
                    const end = start + r.duration * 60 * 60 * 1000;
                    const cleanup = end + 10 * 60 * 1000;

                    if (nowMs >= start && nowMs < end) {
                        statusText = `Зайнятий до ${formatTime(new Date(end))}`;
                        statusClass = "reserved";
                        break; 
                    } else if (nowMs >= end && nowMs < cleanup) {
                        statusText = `Прибирання до ${formatTime(new Date(cleanup))}`;
                        statusClass = "cleaning";
                        break;
                    } else if (nowMs < start && statusClass !== "blocked" && statusClass !== "reserved") {
                        if (start - nowMs < 24 * 60 * 60 * 1000) {
                            statusText = `Вільний до ${formatTime(new Date(start))}`;
                            statusClass = "soon-reserved";
                            break;
                        }
                    }
                }

                return { ...table, statusText, statusClass };
            });

            res.json({ data: enrichedTables });
        });
    });
});

app.put('/tables/:id', (req, res) => {
    const { name, type, capacity } = req.body;
    db.run("UPDATE tables SET name = ?, type = ?, capacity = ? WHERE id = ?", [name, type, capacity, req.params.id], function(err) {
        logAction("Редагування", `Змінено параметри столика #${req.params.id}. Нова назва: ${name}, Місць: ${capacity}`);
        res.json({ message: "Оновлено" });
    });
});

app.post('/tables/:id/block', (req, res) => {
    const { blockedUntil } = req.body;
    
    db.run("UPDATE tables SET blocked_until = ? WHERE id = ?", [blockedUntil, req.params.id], function(err) {
        logAction("Блокування", blockedUntil ? `Столик #${req.params.id} заблоковано до ${formatDate(new Date(blockedUntil))}` : `Столик #${req.params.id} розблоковано`);
        res.json({ message: "OK" });
    });
});

app.post('/reservations', (req, res) => {
    const { tableId, guestName, startTime, duration, guestCount, comment } = req.body;
    
    if (new Date(startTime).getMinutes() % 10 !== 0) return res.status(400).json({ error: "Час має бути кратним 10 хв" });
    if (new Date(startTime) < new Date()) return res.status(400).json({ error: "Час вже минув!" });

    db.get("SELECT capacity, blocked_until FROM tables WHERE id = ?", [tableId], (err, table) => {
        if (!table) return res.status(404).json({ error: "Не знайдено" });
        
        if (table.blocked_until) {
            const blockDate = new Date(table.blocked_until);
            const bookDate = new Date(startTime);
            if (bookDate < blockDate) {
                return res.status(400).json({ error: `Столик зачинено до ${formatDate(blockDate)}` });
            }
        }

        if (guestCount > table.capacity) return res.status(400).json({ error: `Забагато гостей! Макс: ${table.capacity}` });

        const reqStart = new Date(startTime).getTime();
        const reqEnd = reqStart + duration * 60 * 60 * 1000 + 10 * 60 * 1000;

        db.all("SELECT * FROM reservations WHERE tableId = ?", [tableId], (err, existing) => {
            const conflict = existing.find(r => {
                const exStart = new Date(r.startTime).getTime();
                const exEnd = exStart + r.duration * 60 * 60 * 1000 + 10 * 60 * 1000;
                return reqStart < exEnd && exStart < reqEnd; 
            });

            if (conflict) {
                const busyStart = formatTime(new Date(conflict.startTime));
                const busyEnd = formatTime(new Date(new Date(conflict.startTime).getTime() + conflict.duration * 3600000 + 600000));
                return res.status(409).json({ error: `Конфлікт з бронею #${conflict.id} (${conflict.guestName}): ${busyStart} - ${busyEnd}` });
            }

            const stmt = db.prepare("INSERT INTO reservations (tableId, guestName, startTime, duration, guestCount, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
            stmt.run(tableId, guestName, startTime, duration, guestCount, comment, new Date().toISOString(), function(err) {
                logAction("Створено", `Бронь #${this.lastID}: ${guestName}, Стіл ${tableId}, ${formatDate(new Date(startTime))}, ${duration} год.`, null);
                res.status(201).json({ id: this.lastID });
            });
        });
    });
});

app.post('/reservations/:id/finish', (req, res) => {
    const { reason } = req.body;
    const now = Date.now();
    
    db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Не знайдено" });

        const start = new Date(row.startTime).getTime();
        const end = start + row.duration * 3600000;
        const cleanupEnd = end + 600000;

        let newDuration;
        let newStartTime = row.startTime;
        let actionMsg;

        if (now >= start && now < end) {
            newDuration = (now - start) / 3600000;
            actionMsg = "Гості пішли (старт прибирання)";
        } else if (now >= end && now < cleanupEnd) {
            const targetEnd = now - 600000 - 5000;
            if (start > targetEnd) {
                newStartTime = new Date(targetEnd - 3600000).toISOString();
                newDuration = 1.0;
            } else {
                newDuration = (targetEnd - start) / 3600000;
            }
            actionMsg = "Прибирання завершено достроково";
        } else {
            return res.status(400).json({ error: "Бронь не активна" });
        }

        if (newDuration < 0.001) newDuration = 0.001;

        db.run("UPDATE reservations SET startTime = ?, duration = ? WHERE id = ?", [newStartTime, newDuration, req.params.id], function(err) {
            logAction("Звільнення", `Бронь #${row.id} (Стіл ${row.tableId}): ${actionMsg}. Причина: ${reason}`, null);
            res.json({ message: "OK" });
        });
    });
});

app.post('/reservations/:id/extend', (req, res) => {
    const { minutes } = req.body;
    db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Не знайдено" });

        const currentEnd = new Date(row.startTime).getTime() + row.duration * 3600000 + 600000;
        const requestedEnd = currentEnd + minutes * 60000;

        db.all("SELECT * FROM reservations WHERE tableId = ? AND id != ? AND startTime > ?", 
            [row.tableId, row.id, row.startTime], (err, futureRes) => {
            
            futureRes.sort((a,b) => new Date(a.startTime) - new Date(b.startTime));
            const nextRes = futureRes[0];

            if (nextRes) {
                const nextStart = new Date(nextRes.startTime).getTime();
                if (requestedEnd > nextStart) {
                    const maxMinutes = Math.floor((nextStart - currentEnd) / 60000);
                    return res.status(409).json({ 
                        error: `Конфлікт із бронею #${nextRes.id}. Макс: ${maxMinutes > 0 ? maxMinutes : 0} хв.` 
                    });
                }
            }

            const newDuration = row.duration + (minutes / 60);
            db.run("UPDATE reservations SET duration = ? WHERE id = ?", [newDuration, row.id], function(err) {
                logAction("Продовження", `Бронь #${row.id} (Стіл ${row.tableId}) продовжено на ${minutes} хв.`, null);
                res.json({ message: "Продовжено" });
            });
        });
    });
});

app.post('/reservations/:id/start', (req, res) => {
    const now = Date.now();
    
    db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id], (err, targetRes) => {
        if (!targetRes) return res.status(404).json({ error: "Не знайдено" });

        db.all("SELECT * FROM reservations WHERE tableId = ? AND id != ?", [targetRes.tableId, targetRes.id], (err, others) => {
            const isOccupied = others.some(r => {
                const s = new Date(r.startTime).getTime();
                const e = s + r.duration * 3600000 + 600000; 
                return now >= s && now < e;
            });

            if (isOccupied) {
                return res.status(409).json({ error: "Стіл зараз зайнятий іншою бронею!" });
            }

            const newStart = new Date().toISOString();
            db.run("UPDATE reservations SET startTime = ? WHERE id = ?", [newStart, req.params.id], function(err) {
                logAction("Посадка", `Бронь #${req.params.id} (Стіл ${targetRes.tableId}) почалась вручну: ${formatTime(new Date())}`, null);
                res.json({ message: "OK" });
            });
        });
    });
});

app.get('/reservations', (req, res) => {
    db.all("SELECT * FROM reservations ORDER BY startTime", [], (err, rows) => {
        res.json(rows);
    });
});

app.delete('/reservations/:id', (req, res) => {
    const { reason } = req.body;
    db.get("SELECT * FROM reservations WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Не знайдено" });
        db.run("DELETE FROM reservations WHERE id = ?", [req.params.id], function(err) {
            logAction("Скасовано", `Бронь #${row.id} (${row.guestName}, Стіл ${row.tableId}). Причина: ${reason}`, row);
            res.json({ message: "Deleted" });
        });
    });
});

app.get('/logs', (req, res) => {
    db.all("SELECT * FROM audit_logs ORDER BY id DESC", [], (err, rows) => { res.json(rows); });
});

app.post('/restore/:logId', (req, res) => {
    db.get("SELECT restore_data FROM audit_logs WHERE id = ?", [req.params.logId], (err, log) => {
        if (!log || !log.restore_data) return res.status(400).json({ error: "Err" });
        const r = JSON.parse(log.restore_data);
        const stmt = db.prepare("INSERT INTO reservations (tableId, guestName, startTime, duration, guestCount, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        stmt.run(r.tableId, r.guestName, r.startTime, r.duration, r.guestCount, r.comment, r.created_at, function(err) {
            if(err) return res.status(500).json({error: "Час вже зайнято!"});
            logAction("Відновлено", `Бронь #${this.lastID} (${r.guestName}) відновлено з архіву`, null);
            res.json({ message: "OK" });
        });
    });
});

app.listen(PORT, () => { console.log(`Run ${PORT}`); });