# Pulse Auction

A polished real-time live auction and bidding engine built with **Node.js, Express.js and Socket.io**.

## Features
- Real-time bidding across browser tabs
- Server-authoritative bid validation
- Minimum bid increment enforcement
- Self-outbid prevention
- Targeted outbid notifications
- Live bid activity history
- Live viewer counter
- Server-side countdown timer
- Anti-snipe protection: bids in the final 15 seconds reset the clock to 20 seconds
- Sold event when the timer reaches zero
- Responsive dark trading-floor UI

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5000` in multiple browser tabs and join with different bidder names.

## Tech Stack
Node.js · Express.js · Socket.io · CORS · In-memory state

## Screenshots

![](<Screenshot 2026-09-11 at 11.50.50 AM.png>)

![alt text](<Screenshot 2026-09-11 at 11.50.34 AM.png>)

![alt text](<Screenshot 2026-09-11 at 11.50.17 AM.png>)

## Project Structure
```text
PulseAuction/
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── server.js
├── package.json
└── README.md
```

Built from the requirements in Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io).
