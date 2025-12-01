const reservationService = require('./reservationService');

describe('ReservationService', () => {
    test('має створити нове бронювання з коректними даними', () => {
        const data = {
            tableId: 1,
            guestName: 'Test Guest',
            startTime: '2025-01-01'
        };

        const result = reservationService.create(data);

        expect(result).toHaveProperty('id');
        expect(result.guestName).toBe('Test Guest');
        expect(result.tableId).toBe(1);
    });

    test('має викинути помилку, якщо немає імені гостя', () => {
        const data = { tableId: 1 }; // Немає guestName
        
        expect(() => {
            reservationService.create(data);
        }).toThrow("Неповні дані для бронювання");
    });
});
