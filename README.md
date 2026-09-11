# Pulse Auction

A polished real-time live auction and bidding engine built with **Node.js, Express.js and Socket.io**.

**Live Demo:**
https://realtime-auction-platform-jmjk.onrender.com/

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

<img width="1470" height="881" alt="Screenshot 2026-09-11 at 11 50 50 AM" src="https://github.com/user-attachments/assets/b16eef00-93be-4de3-9cb8-4cb72a4a3c22" />

<img width="1468" height="879" alt="Screenshot 2026-09-11 at 11 50 34 AM" src="https://github.com/user-attachments/assets/6931e4b2-38c5-48fa-b5d3-8f99f470f87f" />

<img width="1470" height="881" alt="Screenshot 2026-09-11 at 11 50 17 AM" src="https://github.com/user-attachments/assets/7cad7b66-1f87-4b62-9490-9b2bdb148f07" />


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
## Author

Jui Tawde
Built from the requirements in Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io).
