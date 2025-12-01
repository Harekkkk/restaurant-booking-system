# Використовуємо легку версію Node.js
FROM node:20-alpine

# Створюємо папку всередині контейнера
WORKDIR /app

# Копіюємо файли налаштувань
COPY package*.json ./

# Встановлюємо бібліотеки
RUN npm install

# Копіюємо весь інший код
COPY . .

# Відкриваємо порт 3000
EXPOSE 3005

# Команда запуску
CMD ["node", "server.js"]
