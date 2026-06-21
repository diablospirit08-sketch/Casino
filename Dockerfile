FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy everything (frontend + backend source)
COPY . .

EXPOSE 4000

CMD ["sh", "-c", "cd backend && node migrations/run.js && node src/index.js"]
