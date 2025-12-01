# Сутності домену (Entities)

## Піддомен: Restaurant Layout (Зал)
### Entity: Table
* **id**: унікальний ідентифікатор (UUID або Number).
* **name**: назва або номер столика (наприклад, "Біля вікна").
* **capacity**: кількість місць (Integer).
* **location**: зона розміщення (Hall, Terrace, VIP).

## Піддомен: Booking (Бронювання)
### Entity: Reservation
* **id**: унікальний номер броні.
* **tableId**: посилання на столик.
* **guestName**: ім'я гостя.
* **guestContact**: телефон або email.
* **startTime**: час початку.
* **endTime**: час завершення.
* **status**: статус (Pending, Confirmed, Cancelled).
