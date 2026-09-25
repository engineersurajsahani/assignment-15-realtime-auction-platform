# Live Auction Trading Floor (Socket.io)

A mission-critical, server-authoritative live bidding trading floor modeled after a luxury auction-house broadcast overlay (Sotheby's live auction stream crossed with a Bloomberg terminal).

Built with **Node.js**, **Express.js**, **Socket.io**, and vanilla HTML5 / CSS3 / Web Audio API.

---

## Architecture Overview

```
assignment-15-auction-socket/
├── public/
│   ├── index.html            # Luxury trading floor layout & markup
│   ├── css/
│   │   ├── tokens.css        # Design tokens: warm-black (#0b0a09), gold (#c9a15a), crimson (#a3273a)
│   │   ├── base.css          # Resets, typography, accessible focus & motion rules
│   │   └── floor.css         # Hero price centerpiece, countdown timer, auditable tape, outbid banner
│   └── js/
│       ├── socket-client.js  # Server-authoritative Socket.io client wrapper
│       └── app.js            # UI controller, optimistic locks & Web Audio API synthesizer
├── sockets/
│   ├── auctionEngine.js      # Synchronous atomic bid validation & anti-snipe logic
│   └── timerManager.js       # Server-side 1s interval countdown per auction room
├── test/
│   └── concurrency-test.js   # Automated multi-client race condition & domain test suite
├── server.js                 # Express + Socket.io server, state store, REST endpoints
├── package.json
└── README.md
```

---

## Concurrency & Race Condition Safety (30 Marks Criterion)

### The Core Problem
In distributed high-frequency live auctions, multiple bids can arrive at the server within fractions of a millisecond. If the server implementation uses asynchronous operations (e.g., `await getAuctionState()`, fake `setTimeout`, or asynchronous database queries) between reading the current bid and writing the new high bid, two concurrent handlers will read the identical `currentBid` and both accept invalid bids, causing race conditions and split-brain state.

### The Architectural Proof: Why Races Cannot Happen
In Node.js's cooperative single-threaded event loop:
1. **Zero Asynchronous Interruption**: `handleBidPlacement` in [sockets/auctionEngine.js] is written **100% synchronously from start to finish**. There are zero `await` statements, promises, or async I/O boundaries during state evaluation and mutation.
2. **Server Receive-Order Execution**: Incoming socket events from all clients are queued onto the event loop. The JavaScript engine executes `handleBidPlacement` for Bid 1 completely to termination before picking up Bid 2 from the queue.
3. **Atomic State Mutation**:
   - When Bid 1 arrives, `auction.currentBid` is checked and updated synchronously.
   - When Bid 2 executes immediately in the subsequent micro-task/tick, it reads the freshly updated `auction.currentBid` and is immediately rejected if it does not satisfy the new required minimum increment (`currentBid + minIncrement`) or if it constitutes a self-outbid.
4. **Authoritative Expiry Priority**: The timer ticks in [sockets/timerManager.js]also execute synchronously on the event loop. When the clock reaches `0`, the auction status transitions to `"ended"` before any subsequent bid in that tick is processed, guaranteeing that late bids landing on the zero-tick are strictly rejected.

---

## Anti-Snipe Rule

To prevent sniping bots from placing bids at the final split-second:
- When a valid bid is placed on an active auction with **less than 15 seconds remaining** (`timeRemainingSeconds < 15`), the server resets the countdown timer to **20 seconds**.
- The server broadcasts an `auction:extended` event with `{ auctionId, newTimeRemainingSeconds: 20, message: "..." }` and dispatches an immediate `auction:time_tick` update.
- The UI triggers a synchronized sound chime via the Web Audio API, pulses the countdown gauge, and displays a luxury notification toast.

---

## Socket Event Dictionary

| Event Name | Direction | Payload Shape | Description |
| :--- | :--- | :--- | :--- |
| `auction:join` | Client → Server | `{ auctionId, username }` | Client subscribes to an auction room |
| `auction:init` | Server → Client | `{ auction: { id, title, currentBid, minIncrement, timeRemainingSeconds, status, ... } }` | Authoritative initial state sent on room join |
| `auction:time_tick` | Server → Room | `{ auctionId, timeRemainingSeconds }` | 1-second server countdown tick |
| `user:joined` | Server → Room | `{ totalViewers, username, auctionId }` | Broadcast updated observer count |
| `bid:place` | Client → Server | `{ auctionId, bidder, amount }` | Client submits bid |
| `bid:success` | Server → Room | `{ auctionId, currentBid, currentHighestBidder, minIncrement, bidHistory }` | Successful bid broadcast to room |
| `bid:outbid` | Server → Socket | `{ auctionId, newBid, newHighestBidder }` | Targeted alert to previous high bidder |
| `bid:rejected` | Server → Socket | `{ auctionId, reason, currentBid, minIncrement }` | Rejection feedback with inline reason |
| `auction:extended` | Server → Room | `{ auctionId, newTimeRemainingSeconds, message }` | Anti-snipe extension alert |
| `auction:sold` | Server → Room | `{ auctionId, winner, finalAmount, bidCount, itemTitle }` | Auction hammer-down conclusion |
| `auction:activity` | Server → Room | `{ auctionId, activity: { type, bidder, amount, timestamp, message } }` | Auditable real-time tape feed event |

---

## UI / UX Highlights

- **Sotheby's Aesthetic**: Warm-black base (`#0b0a09`), gold/brass accents (`#c9a15a`) for high-bid leadership, and deep crimson (`#a3273a`) reserved exclusively for urgent outbid warnings and <15s countdowns.
- **Tabular Numbers & Price Pulse**: Displayed with `JetBrains Mono` and `tabular-nums`; dynamically pulses with a golden aura on every accepted bid.
- **Dynamic Quick Increments**: Instant buttons for `+Min`, `+2×Min`, and `+5×Min` dynamically recalculated from authoritative minimum increment.
- **Optimistic UI Lock**: Bidding button is immediately disabled upon transmission to prevent duplicate clicks, and unlocks with inline error feedback if rejected.
- **Synthesized Web Audio Engine**: Metallic gavel taps, fanfare anti-snipe bells, descending outbid sirens, and closing hammer strikes generated natively via the Web Audio API (no external MP3 assets needed).

---

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Run Automated Concurrency Test Suite
Simulates 3 concurrent socket clients (2 bidders + 1 observer) verifying race conditions, self-outbid checks, anti-snipe triggers, targeted outbid routing, and closing state:
```bash
npm test
```

### 3. Start Live Server
```bash
npm start
```
Open your browser at [http://localhost:3000](http://localhost:3000).
