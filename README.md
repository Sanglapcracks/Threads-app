A full-stack project built with Next.js, Node.js, and Socket.io

This project is a high-performance, real-time communication platform featuring
threaded discussions, private messaging with image uploads, and live notification
systems.

Tech Stack

Next.js 15 (App Router) Node.js & Express TypeScript PostgreSQL Docker Socket.io
Clerk Auth Cloudinary Tailwind CSS Shadcn UI

Key Features
Real-time Threading: Create discussions, filter by categories, search, and
interact via likes/comments.
Live Notifications: Instant updates when users interact with your threads
(likes/comments) using Socket.io.
Private Messaging: Real-time 1-on-1 chat with "typing" indicators and online
presence tracking.
Image Uploads: Seamless file handling via Multer and Cloudinary for chat
attachments and profiles.
Hybrid Auth: Secure authentication using Clerk, integrated at both frontend
and backend levels.
Modular Architecture: Professional backend structure using Repositories and
Services with PostgreSQL raw queries (no ORM).

Getting Started
1. Prerequisites
Node.js (v18+)
Docker & Docker Compose
Clerk, Cloudinary, and Postgres accounts

2. Environment Setup
Create .env files in both /frontend and /backend directories.
Backend .env:

PORT=5000
DB_HOST=localhost
DB_PORT=6450
DB_NAME=realtime_app
DB_USER=postgres
DB_PASSWORD=postgres
CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

3. Installation & Run

# Start PostgreSQL via Docker
docker-compose up -d
# Setup Backend
cd backend
npm install
npm run migrate
npm run dev
# Setup Frontend
cd ../frontend
npm install
npm run dev
•
•

Folder Structure

/backend
/src
/config # Clerk, Cloudinary, Env configs
/db # Connections and Migrations
/lib # Shared utilities (Logger, Errors)
/middleware # Auth and Error handlers
/modules # Feature-based logic (User, Threads, Chat)
/realtime # Socket.io handlers
/routes # API Endpoints
/frontend
/src
/app # Next.js Pages
/components # UI Components
/hooks # Custom hooks (useSocket)
/lib # API client
/types # TypeScript Definitions

Database Schema
The project uses a structured PostgreSQL schema including:
users : Maps Clerk IDs to local profiles.
threads & categories : Manages forum-style posts.
replies & thread_reactions : Handles comments and likes.
notifications : Tracks read/unread interactions.
direct_messages : Stores chat history.
