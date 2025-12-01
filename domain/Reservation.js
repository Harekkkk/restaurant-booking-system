class Reservation {
    constructor(id, tableId, guestName, guestContact, startTime) {
        this.id = id;
        this.tableId = tableId;
        this.guestName = guestName;
        this.guestContact = guestContact;
        this.startTime = new Date(startTime);
    this.status = 'PENDING';
    }

    confirm() {
        this.status = 'CONFIRMED';
    }

    cancel() {
        this.status = 'CANCELLED';
    }
}

module.exports = Reservation;
