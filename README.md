# Speedhawk
A web performance auditing tool that analyzes websites and provides AI-powered improvement suggestions.

## Stack
- Client: React + Vite
- Server: Express, BullMQ, Upstash Redis, PostgreSQL
- Worker: Lighthouse, Puppeteer, Gemini API

## Project Structure
~~~
client/   # React frontend
server/   # Express, BullMQ, Redis job queue, ratelimiting
worker/   # Background job processor, Gemini API
~~~

## Prerequisites
- Node.js and npm
- Docker Desktop
- Goose (for database migrations)

## Setup
1. Start all the docker containers (on root directory):
~~~
docker-compose up --build
~~~
2. Run database migrations on new terminal on root directory (replace the {} with yours)
~~~
goose -dir ./server/internal/database/migrations postgres "postgresql://{USER}:{PASSWORD}@localhost:5432/{DB_NAME}?sslmode=disable" up
~~~
