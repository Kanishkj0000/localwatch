# LocalWatch

Know what's wrong nearby, before you get there.

LocalWatch is a community-driven platform for reporting and tracking civic and road issues — potholes, broken roads, waterlogging, construction, speed breakers — in a local area. 

## Features
- **Frictionless reporting**: Location auto-captured, category picked by icon, photo optional.
- **Self-correcting trust**: Status changes after multiple independent nearby confirmations.
- **Check This Area**: See active issues near a destination before you arrive.

## Tech Stack
- Frontend: React + Vite, Tailwind CSS, react-leaflet
- Backend: Node.js + Express
- Database: PostgreSQL with PostGIS extension
- AI Service: Python (FastAPI, scikit-learn, imagehash)

## Running Locally

1. Start the services using Docker Compose (this sets up PostgreSQL with PostGIS):
   ```bash
   docker-compose up db
   ```
2. Start the backend:
   ```bash
   cd server
   npm run dev
   ```
3. Start the frontend:
   ```bash
   cd client
   npm run dev
   ```
4. Start the AI service:
   ```bash
   cd ai-service
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
