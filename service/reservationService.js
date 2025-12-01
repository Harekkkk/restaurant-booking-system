// service/reservationService.js
const Reservation = require('../domain/Reservation');

// Тимчасове зберігання в пам'яті (замість БД для простоти цієї лаби, або можна розширити SQLite)
// У реальному проєкті тут будуть SQL запити до db
let reservations = []; 
let currentId = 1;

class ReservationService {
    
    getAll() {
        return reservations;
    }

    create(data) {
        // Валідація
        if (!data.tableId || !data.guestName) {
            throw new Error("Неповні дані для бронювання");
        }

        // Створення об'єкта
        const newReservation = new Reservation(
            currentId++, 
            data.tableId, 
            data.guestName, 
            data.guestContact || "", 
            data.startTime
        );

        reservations.push(newReservation);
        return newReservation;
    }

    delete(id) {
        const index = reservations.findIndex(r => r.id === parseInt(id));
        if (index === -1) {
            return false; // Не знайдено
        }
        reservations.splice(index, 1);
        return true; // Видалено
    }
}

module.exports = new ReservationService();
