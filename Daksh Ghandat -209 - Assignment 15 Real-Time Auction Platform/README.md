# 🏷️ Assignment 15 — Real-Time Live Auction & Bidding Engine (Socket.io)

A mission-critical, low-latency **Real-Time Live Auction & Bidding Platform** built with **Node.js, Express.js and Socket.io**. The server is the single source of truth: it runs an authoritative bidding engine that prevents race conditions, enforces minimum bid increments, simulates wallet balances, broadcasts instant outbid alerts and live price ticks, synchronizes server-side countdown clocks, and implements **Anti-Snipe Timer Extensions**.

*Track: Backend & Real-Time Web | Level: Advanced*

---

## ✨ Highlights

| Feature | Details |
| --- | --- |
| **Authoritative bid engine** | Server-side validation: auction status, self-outbid prohibition, minimum increment, wallet balance |
| **Anti-snipe protection** | A bid in the final 15s extends the clock back to 20s (soft-close / timer reset) |
| **Server-side countdown** | One authoritative 1-second timer per lot, broadcast via `auction:time_tick` |
| **Targeted outbid alerts** | `bid:outbid` sent privately only to the previous highest bidder's socket |
| **Auditable bid history** | Per-lot `bidHistory` feed kept in memory **and** persisted to MongoDB (`Bid` collection) |
| **Sold result persistence** | On clock-0 the room gets `auction:sold` and the final lot record is upserted into MongoDB (`Auction` collection) |
| **Wallet simulation** | Each joining bidder receives a deterministic simulated balance; bids above it are rejected |
| **Live viewer counter** | `user:joined` broadcasts the room occupant count to everyone |

---

## 🧱 Tech Stack & Dependencies

```
Node.js · Express.js · Socket.io · CORS · dotenv · mongoose · uuid · nodemon (dev) · socket.io-client (dev, for e2e test)
```

```bash
# Initialize project
npm init -y

# Install dependencies
npm install express socket.io cors dotenv mongoose uuid

# Install development tools
npm install -D nodemon socket.io-client
```

> [!NOTE]
> On macOS port **5000** is used by AirPlay — this project defaults to **`PORT=5001`**. Override it in `.env`.

---

## 📁 Directory Structure

```
assignment-15-auction-socket/
├── public/
│   ├── index.html           # Live bidding floor UI
│   ├── app.js               # Client socket handlers, quick bids, Web-Audio cues
│   └── style.css            # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js     # Authoritative bid validation, outbid alerts, anti-snipe
│   └── timerManager.js      # Server-side 1s interval countdown clock + auction:sold
├── data/
│   ├── auctions.seed.json    # Sample/seed lots (JSON)
│   ├── seedAuctions.js       # Loads seed → in-memory room state
│   └── auditStore.js         # MongoDB persistence (persistBid, persistAuctionResult, hydrate)
├── models/
│   ├── Auction.js           # Sold-lot snapshot collection
│   └── Bid.js               # Auditable bid-log collection
├── config/
│   └── db.js                # Mongoose connection
├── tests/
│   └── e2e.test.js          # Socket-protocol regression test
├── server.js                # Express + Socket.io wiring, REST audit endpoints
├── package.json
├── .env.example
└── README.md
```

---

## 🗂️ Auction Data Model & Room State (In-Memory)

```js
// sockets/auctionEngine.js
const auctions = {
  "AUC_VINTAGE_99": {
    id: "AUC_VINTAGE_99",
    title: "1967 Vintage Fender Stratocaster",
    description: "Original condition rare electric guitar",
    startingPrice: 50000,
    currentBid: 50000,
    highestBidder: null,                // { socketId, username }
    minIncrement: 2000,
    timeRemainingSeconds: 60,
    status: "active",                   // "upcoming" | "active" | "ended"
    bidHistory: [],                     // [{ bidder, amount, timestamp, id }]
    timerInterval: null
  }
};
```

### Mongo collections

- **`bids`** — append-only audit log: `{ auctionId, bidder, amount, timestamp }`
- **`auctions`** — one document per closed lot: winner, finalPrice, status `ended`

History is hydrated from MongoDB when the server starts (survives restarts); live bids are written through to the audit log and mirrored into the in-memory `bidHistory`.

---

## 📡 Socket Event Protocol

| Event | Direction | Payload | Description |
| --- | --- | --- | --- |
| `auction:join` | Client → Server | `{ auctionId, username }` | Join the live bidding floor room |
| `auction:init` | Server → Client | `{ item, bidHistory, timeRemaining, walletBalance }` | Hydrate newly joined bidder |
| `auction:error` | Server → Client | `{ message }` | Failed join |
| `auction:time_tick` | Server → Room | `{ auctionId, timeRemaining }` | Every 1 s |
| `user:joined` | Server → Room | `{ totalViewers }` | Live audience count |
| `bid:place` | Client → Server | `{ auctionId, amount }` | Place a higher bid |
| `bid:success` | Server → Room | `{ newBid, highestBidder, minIncrement, timeRemaining, bidHistory }` | New leading price |
| `bid:placed` | Server → Client(bidder) | `{ amount, walletBalance }` | Bidder's wallet updated |
| `bid:outbid` | Server → Client(prev. leader) | `{ message }` | Private outbid alert |
| `bid:rejected` | Server → Client | `{ reason }` | Invalid bid attempt |
| `auction:extended` | Server → Room | `{ timeRemaining, message }` | Anti-snipe triggered |
| `auction:sold` | Server → Room | `{ winner, finalPrice, status }` | Clock hits 0, reserve met |

---

## 🛡️ Authoritative Bidding & Anti-Snipe Engine

Validation order in `handleBidPlacement` (`sockets/auctionEngine.js`):

1. Auction must be `active` and the clock above 0 → else `Auction is closed`
2. Bidder must not already be the highest bidder → else `You are already the highest bidder`
3. `amount >= currentBid + minIncrement` → else `Bid too low. Minimum valid bid is ₹…`
4. `amount <= walletBalance` (simulated wallet) → else `Insufficient wallet balance…`
5. Capture previous bidder, atomically update state, prepend to `bidHistory`, persist to Mongo
6. **Anti-snipe**: if `timeRemainingSeconds < 15` → set to `20` and emit `auction:extended`
7. Broadcast `bid:success` to the whole room
8. Send private `bid:outbid` to the previous highest bidder's socket

```js
// Anti-snipe core (auctionEngine.js)
if (auction.timeRemainingSeconds < MIN_SNIPE_SECONDS) {      // 15s
  auction.timeRemainingSeconds = SNIPE_EXTEND_SECONDS;       // 20s
  io.to(auction.id).emit("auction:extended", {
    timeRemaining: 20,
    message: "Anti-snipe triggered: +20 seconds added!",
  });
}
```

`timerManager.startCountdown(io, auction)` runs one `setInterval` per active lot, emits `auction:time_tick` each second and, at zero, marks the lot `ended`, emits `auction:sold` and persists the snapshot.

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file with your MongoDB connection string
cp .env.example .env
#    Edit .env — set MONGO_URI to your MongoDB Atlas URI (the app also
#    runs fine in-memory without a database; the Mongo audit log is skipped).

# 3. Run the server
npm run dev          # or: npm start

# 4. Open the trading floor in 3 browser tabs
open http://localhost:5001
```

> The bidding engine, timer and anti-snipe logic are fully in-memory and work without MongoDB.
> When `MONGO_URI` is reachable, every bid is appended to the `bids` collection (audit log) and
> each `auction:sold` snapshot is upserted into the `auctions` collection.

### Optional protocol regression test

```bash
npm run test:e2e
```

---

## 🧪 Manual Verification (3 tabs)

1. Tab 1 → join `AUC_VINTAGE_99` as **Vikram**, Tab 2 → **Ananya**, Tab 3 → **Viewer C**. All three see the same current bid, timer and feed.
2. Vikram bids a valid amount → all 3 screens update instantly; his wallet drops.
3. Ananya bids higher → Vikram's tab flashes a red **"You have been outbid…"** banner + alert tone.
4. A low bid (under the min increment) is rejected with `Bid too low. Minimum valid bid is ₹…`.
5. Wait for the clock below 15s, then bid → timer jumps back to 20s with an **Anti-snipe** toast.
6. Let the clock hit 0 → `🔨 Sold!` modal, `auction:sold` in the console, `/api/auctions/:id/result` shows the persisted winner.
7. Further bids → rejected with `Auction is closed`.

### REST audit endpoints

| Endpoint | Returns |
| --- | --- |
| `GET /api/auctions` | All lots with live status |
| `GET /api/auctions/:id` | Lot detail + in-memory bid history |
| `GET /api/auctions/:id/bids` | Full MongoDB audit log (100 latest) |
| `GET /api/auctions/:id/result` | Persisted sold snapshot |
| `GET /api/health` | Server + DB + active lots |

---

## 📊 Grading Rubric Mapping

| Component | Marks | Where |
| --- | --- | --- |
| Real-Time Bid Processing & Validation Engine | 30 | `sockets/auctionEngine.js` |
| Server-Side Countdown Timer & Anti-Snipe | 25 | `sockets/timerManager.js` + anti-snipe block |
| Targeted Outbid Notifications & Live Broadcasting | 20 | `bid:outbid` / `bid:success` / `user:joined` |
| Auditable Bid History Feed & Live Viewer Counter | 15 | `bidHistory` + Mongo `Bid` + REST audit |
| Trading Floor Client UI Polish & Architecture | 10 | `public/` (dark floor, toasts, Web-Audio cues) |

---

## 📤 Submission

- Push the repo to GitHub: `itm-assignment-15-auction-socket`
- Include a 1-minute video demo: concurrent bidding, outbid alerts, and the anti-snipe timer extension.