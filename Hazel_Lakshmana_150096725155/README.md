# Assignment 15 - Real-Time Live Auction & Bidding Engine

## Live Link

**https://github.com/hazelnutbytes/auction-socket.git**

## Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- dotenv
- uuid
- In-memory auction state

## Install

```bash
npm install
```

## Run

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

Open:

```text
http://localhost:5000
```

## Testing

Open three browser tabs.

Use:

- Tab 1: Vikram
- Tab 2: Ananya
- Tab 3: Viewer

Place a bid from Vikram for ₹52,000.

Place a higher bid from Ananya.

Vikram should receive an outbid alert.

When the timer is below 15 seconds, place a valid higher bid. The timer resets to 20 seconds.

When the timer reaches 0, the auction is sold and further bids are rejected.

## Socket Events

### Client to Server

- `auction:join`
- `bid:place`

### Server to Client

- `auction:init`
- `auction:time_tick`
- `user:joined`
- `bid:success`
- `bid:outbid`
- `bid:rejected`
- `auction:extended`
- `auction:sold`

## Auction Rules

- Auction must be active.
- Bidder cannot outbid themselves.
- Every bid must be at least ₹2,000 above the current bid.
- The server is authoritative for bid validation.
- A bid in the final 15 seconds resets the timer to 20 seconds.
- The previous highest bidder receives a private outbid notification.
- Bid history is maintained in memory.
- Viewer count is maintained per auction room.

## Submission

Push the project to:

`itm-assignment-15-auction-socket`

Include a 1-minute demo showing:

1. Multiple users joining.
2. Concurrent bidding.
3. Outbid notification.
4. Anti-snipe timer extension.
5. Auction ending.
