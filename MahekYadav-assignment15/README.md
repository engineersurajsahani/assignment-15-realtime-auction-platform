# Assignment 15 — Real-Time Live Auction & Bidding Engine

A real-time auction platform built with Node.js, Express.js and Socket.io.

## Live Demo
https://itm-assignment-15-auction-socket-u19a.onrender.com


## Features

- Real-time Socket.io auction rooms
- Server-authoritative bid validation
- Minimum bid increment validation
- Self-outbid prevention
- Targeted outbid notifications
- Server-side countdown timer
- Anti-snipe timer extension
- Live viewer count
- Auditable bid history
- Auction sold/ended event
- Responsive live bidding UI
- Health-check API

## Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- dotenv
- UUID
- HTML, CSS and JavaScript

## Project Structure

```text
assignment-15-auction-socket/
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── sockets/
│   ├── auctionEngine.js
│   └── timerManager.js
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## Installation

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

or:

```bash
npm start
```

Open:

`http://localhost:5000`

## Test With Multiple Users

Open the auction page in three browser tabs.

Example users:

- Vikram
- Ananya
- Viewer

Test the following:

1. Join the auction from all three tabs.
2. Place a bid from Vikram.
3. Verify that every connected tab receives the new highest bid.
4. Place a higher bid from Ananya.
5. Verify that Vikram receives the targeted outbid alert.
6. Wait until the timer is below 15 seconds.
7. Place a valid bid and verify the timer extends to 20 seconds.
8. Let the timer reach zero.
9. Verify the auction is sold to the highest bidder.
10. Try another bid and verify that it is rejected.

## API

### Health Check

`GET /api/health`

Example response:

```json
{
  "success": true,
  "message": "Auction server is running",
  "status": "active"
}
```

### Auctions

`GET /api/auctions`

Returns the current in-memory auction state.

## Socket Events

### Client → Server

#### `auction:join`

```json
{
  "auctionId": "AUC_VINTAGE_99",
  "username": "Vikram"
}
```

#### `bid:place`

```json
{
  "auctionId": "AUC_VINTAGE_99",
  "amount": 54000
}
```

### Server → Client/Room

- `auction:init`
- `auction:time_tick`
- `user:joined`
- `user:left`
- `bid:success`
- `bid:outbid`
- `bid:rejected`
- `auction:extended`
- `auction:sold`

## Important Note

This assignment uses in-memory state. Auction data is reset whenever the server restarts or redeploys.

## Deployment

The application is configured to use Render's dynamic `PORT` environment variable:

```js
const PORT = process.env.PORT || 4000;
```

Render settings:

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

No database is required for this assignment.
