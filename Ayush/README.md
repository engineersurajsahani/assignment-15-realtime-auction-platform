# 🔨 Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)

A working solution for the assignment spec: an authoritative, real-time
bidding engine built with **Node.js, Express.js, and Socket.io** that
prevents race conditions, enforces minimum bid increments, broadcasts
outbid alerts, synchronizes countdown timers, and implements **Anti-Snipe
Timer Extensions**.

## 🚀 Running it

```bash
npm install
npm run dev      # nodemon, auto-restarts on changes
# or
npm start
```

Server runs at **http://localhost:5000**. Open multiple browser tabs to
simulate several bidders in the same auction room.

## 🏗️ Structure

```
├── data/
│   └── auctions.js          # In-memory auction room state (3 seed auctions)
├── public/
│   ├── index.html           # Lobby + live bidding floor UI
│   ├── app.js                # Client socket handlers & bid buttons
│   └── style.css             # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js      # Bid validation, outbid alerts & anti-snipe logic
│   └── timerManager.js       # Server-side 1s interval countdown clock
├── server.js                 # Express + Socket.io wiring
├── package.json
└── .env.example
```

## 📡 Socket Event Protocol

Matches the assignment spec exactly:

**Room & stream:** `auction:join`, `auction:init`, `auction:time_tick`, `user:joined`

**Bidding:** `bid:place`, `bid:success`, `bid:outbid`, `bid:rejected`, `auction:extended`, `auction:sold`

## 🛡️ Bidding Rules Implemented

1. Rejects bids on closed/ended auctions.
2. Rejects a bidder trying to outbid themselves.
3. Enforces `currentBid + minIncrement` as the minimum valid next bid.
4. Broadcasts the new leading bid + updated history to the whole room.
5. Sends a **private** `bid:outbid` alert only to the bidder who just lost the lead.
6. **Anti-snipe**: any valid bid placed with less than 15s left resets the
   clock to 20s and emits `auction:extended` to the room.
7. When the clock hits 0: emits `auction:sold` (with a winner) or a
   `status: "unsold"` variant if nobody bid.
8. Live viewer counter via `user:joined`, updated on join/disconnect.

## 🧪 Manual test checklist (from the assignment)

1. Start the server on `http://localhost:5000`.
2. Open 3 tabs: two "bidders" with different names entered, one viewer.
3. Bid from tab A → verify all 3 screens update the current highest bid.
4. Bid higher from tab B → verify tab A gets an **Outbid Alert** banner.
5. Wait until the timer is below 15s, bid again → verify the clock jumps
   back to 20s and the "Anti-Snipe" banner appears.
6. Let the clock hit 0 → verify `auction:sold` fires and further bids are rejected.

## Notes / assumptions

- Three demo auction rooms are seeded in `data/auctions.js` so the lobby
  isn't empty on first load; add more by extending that object.
- State is purely in-memory per the spec ("In-Memory State Engine") — it
  resets on server restart, and this is a single-process design (no Redis
  adapter), matching the assignment's scope.
- Username is supplied client-side when joining a room (no auth layer was
  specified in the assignment).
