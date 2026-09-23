# 🔨 Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)

An authoritative, low-latency live bidding engine built with Node.js, Express.js, and Socket.io.

## Features
- **Authoritative Validation Engine**: Prevents self-outbidding, enforces minimum increments, and rejects late bids.
- **Server-Driven Clock & Anti-Snipe**: Synchronizes remaining auction time and extends time by 20s if a bid arrives in the last 15s.
- **Targeted Alerts**: Emits private outbid notifications specifically to the previous leading bidder via socket ID routing.
- **Auditable Feed & Live Viewers**: Broadcasts current viewer count and real-time bid activity feed to all connected clients.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5000` across multiple browser tabs to simulate concurrent bidders!
