const Reservation = require('../domain/Reservation');
let reservations = []; 
let currentId = 1;

class ReservationService {
    
    getAll() {
        return reservations;
    }

    create(data) {
        if (!data.tableId || !data.guestName) {
            throw new Error("Неповні дані для бронювання");
        }
        
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
            return false;
        }
        reservations.splice(index, 1);
        return true;
    }
}

module.exports = new ReservationService();
