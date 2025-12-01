class Table {
    constructor(id, name, capacity, location) {
        this.id = id;
        this.name = name;
        this.capacity = capacity;
        this.location = location; // наприклад: 'Main Hall', 'Terrace'
    }

    isSuitableFor(numberOfGuests) {
        return this.capacity >= numberOfGuests;
    }
}

module.exports = Table;
