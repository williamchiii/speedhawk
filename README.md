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
- Node.js
- Docker (for PostgreSQL)

## Setup
1. Start the Database (on root directory):
~~~
docker-compose up -d
~~~
2. Install dependencies and start each service:
~~~
cd server && npm install && npm run dev
cd worker && npm install && npm run dev
cd client && npm install && npm run dev
~~~
