**Name: Rishi Thakker**
**Roll No.: 150096725068**
**Cohort: Sam Altman**

**Deployed Link:** https://assignment-15-realtime-auction-platform-bddv.onrender.com/


# 🔨 Real-Time Live Auction & Bidding Engine (Socket.io)

A live auction floor built with **Node.js, Express and Socket.io**. The server is
authoritative: it validates every bid, runs the countdown clock, and decides when
the auction ends — a client can't fake a bid or extend the clock itself.

## Project structure

```text
assignment-15-auction-socket/
├── public/
│   ├── index.html        # Live bidding floor UI
│   ├── app.js             # Client socket handlers & bid button
│   └── style.css          # Dark trading-floor styling
├── sockets/
│   ├── auctionEngine.js   # Bid validation, outbid alerts & anti-snipe logic
│   └── timerManager.js    # Server-side 1s interval countdown clock
├── server.js
├── package.json
└── README.md
```

## Socket event protocol

| Event | Direction | Payload |
|---|---|---|
| `auction:join` | Client → Server | `{ auctionId, username }` |
| `auction:init` | Server → Client | `{ item, bidHistory, timeRemaining }` |
| `auction:time_tick` | Server → Room | `{ auctionId, timeRemaining }` (every 1s) |
| `user:joined` | Server → Room | `{ username, totalViewers }` |
| `bid:place` | Client → Server | `{ auctionId, amount }` |
| `bid:success` | Server → Room | `{ newBid, highestBidder, bidHistory, timeRemaining }` |
| `bid:outbid` | Server → Client | `{ message }` (sent only to the previous highest bidder) |
| `bid:rejected` | Server → Client | `{ reason }` |
| `auction:extended` | Server → Room | `{ timeRemaining, message }` |
| `auction:sold` | Server → Room | `{ winner, finalPrice, status }` |

## Bid validation rules (server-side, in order)

1. Auction must be `active` with time remaining.
2. You can't outbid yourself if you're already the highest bidder.
3. Bid must be at least `currentBid + minIncrement`.
4. A valid bid placed with under 15 seconds left resets the clock to 20s
   (anti-snipe) and broadcasts `auction:extended`.

## Notes

- Auction state is **in-memory** (`auctions` object in `sockets/auctionEngine.js`),
  seeded with one demo item (`AUC_VINTAGE_99`) exactly per the assignment's data model.
- The countdown starts the moment the first bidder joins the room, so it doesn't
  tick down in an empty room.
- `bid:success` includes `bidHistory` in addition to the spec's listed fields, so
  the client can render the live feed without a separate round trip.
