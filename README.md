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
- Goose, only if you need to apply a database migration

## Setup
1. Start all the docker containers (on root directory):
~~~
docker-compose up --build 
~~~
or
~~~
docker-compsoe up
~~~
