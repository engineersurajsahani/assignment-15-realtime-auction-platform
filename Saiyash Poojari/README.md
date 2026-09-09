# Assignment 15: Real-Time Live Auction & Bidding Engine (Socket.io)

An authoritative, low-latency Real-Time Live Auction & Bidding Platform built with Node.js, Express.js, and Socket.io. Features server-side timer synchronization, real-time targeted outbid notifications, an authoritative bid validation engine, anti-snipe soft-close timer extension, and an auditable live bid history ledger.

---

## 🛠️ Tech Stack & Dependencies

- **Backend**: Node.js, Express.js, Socket.io, CORS, dotenv, uuid
- **Frontend**: HTML5, CSS3 (Vanilla Dark Glassmorphism), Web Audio API Synthesizer, Socket.io Client
- **Dev Tools**: Nodemon

---

## 📂 Project Directory Structure

```
assignment-15-auction-socket/
├── public/
│   ├── index.html           # High-stakes live trading floor UI
│   ├── app.js               # Socket.io client handlers & Web Audio synthesizer
│   └── style.css            # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js     # Authoritative bid validation & state manager
│   └── timerManager.js      # Server-side 1s countdown clock & timer extension
├── server.js                # Express & Socket.io server entry point
├── package.json
└── README.md
```

---

## 📡 Real-Time Socket Event Protocol

### 🔄 Room & Stream Events

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `auction:join` | Client -> Server | `{ "auctionId": "AUC_VINTAGE_99", "username": "Vikram" }` | Join live bidding room |
| `auction:init` | Server -> Client | `{ "item": { ... }, "bidHistory": [...], "timeRemaining": 60, "totalViewers": 3 }` | Hydrates full auction state to newly connected bidder |
| `auction:time_tick` | Server -> Room | `{ "auctionId": "AUC_VINTAGE_99", "timeRemaining": 44 }` | Broadcasted every 1 second to update synchronized clocks |
| `user:joined` | Server -> Room | `{ "username": "Vikram", "totalViewers": 3 }` | Updates live audience counter in the room |
| `user:left` | Server -> Room | `{ "username": "Vikram", "totalViewers": 2 }` | Updates audience counter when a user leaves |

### 💰 Live Bidding Actions

| Event Name | Direction | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `bid:place` | Client -> Server | `{ "auctionId": "AUC_VINTAGE_99", "amount": 54000 }` | Bidder submits a higher offer |
| `bid:success` | Server -> Room | `{ "newBid": 54000, "currentBid": 54000, "highestBidder": "Vikram", "timeRemaining": 30 }` | Broadcasts leading price & ledger update to room |
| `bid:outbid` | Server -> Client | `{ "message": "You have been outbid by Vikram at ₹54,000!", "amount": 54000 }` | Private targeted alert sent exclusively to displaced highest bidder |
| `bid:rejected` | Server -> Client | `{ "reason": "Bid too low. Minimum valid bid is ₹56,000" }` | Targeted error rejection sent to invalid bidder |
| `auction:extended` | Server -> Room | `{ "timeRemaining": 20, "message": "Anti-snipe triggered: +20 seconds added!" }` | Emitted when late bid (<15s) extends clock to 20s |
| `auction:sold` | Server -> Room | `{ "winner": "Vikram", "finalPrice": 62000, "status": "sold", "message": "..." }` | Emitted when countdown timer reaches 0 |
| `auction:reset` | Client -> Server | `{ "auctionId": "AUC_VINTAGE_99" }` | Demo reset command to restart auction timer & bids |

---

## ⚡ Core Engine Mechanics

1. **Authoritative Bid Validation**:
   - Rejects bids if auction is closed or ended (`status !== 'active'`).
   - Prevents self-bidding (`highestBidder.socketId === socket.id`).
   - Enforces minimum bid increment (`bidAmount >= currentBid + minIncrement`).
   - Simulates wallet balance limits per bidder.

2. **Anti-Snipe Soft-Close Timer Extension**:
   - If a valid bid is received with **less than 15 seconds** remaining on the countdown clock, the server resets `timeRemainingSeconds` back to **20 seconds**.
   - Emits `auction:extended` to alert all room participants of the extension.

3. **Targeted Private Outbid Alerts**:
   - Captures the socket ID of the previous leading bidder.
   - Dispatches a targeted socket message (`io.to(previousBidder.socketId).emit('bid:outbid', ...)`) triggering a floating visual outbid toast banner and sound alert.

---

## 🧪 Testing & Verification Guide

1. **Start the Server**:
   ```bash
   npm install
   npm run dev
   # Server runs at http://localhost:5000
   ```

2. **Open 3 Browser Windows/Tabs**:
   - Window 1: Set handle **Vikram** (Wallet: ₹100,000)
   - Window 2: Set handle **Ananya** (Wallet: ₹100,000)
   - Window 3: Set handle **Viewer C**

3. **Step 1: Valid Bidding & Room Synchronization**:
   - In Window 1 (Vikram), place a bid of **₹52,000**.
   - Verify all 3 windows immediately update the leading bid to **₹52,000** with Vikram shown as the lead bidder.
   - Check the Auditable Bid Ledger table in all windows.

4. **Step 2: Targeted Outbid Notification**:
   - In Window 2 (Ananya), place a bid of **₹54,000**.
   - Verify Window 1 (Vikram) instantly receives a floating red **"YOU HAVE BEEN OUTBID!"** banner toast and warning audio chime.
   - Verify Window 2 shows "YOU ARE LEADING".

5. **Step 3: Invalid Bid Handling**:
   - In Window 2 (Ananya), try to place a bid again immediately.
   - Verify Window 2 gets rejection alert: *"You are already the highest bidder"*.
   - In Window 1 (Vikram), try to bid **₹54,500** (less than min increment of ₹2,000).
   - Verify Window 1 gets rejection alert: *"Bid too low. Minimum valid bid is ₹56,000"*.

6. **Step 4: Anti-Snipe Timer Protection**:
   - Watch the server countdown clock until it drops below **15 seconds** (e.g. 10s).
   - Place a valid bid of **₹56,000** from Window 1 (Vikram).
   - Verify the clock immediately jumps back to **20 seconds** and an **"ANTI-SNIPE TRIGGERED"** alert banner pops up on all screens.

7. **Step 5: Auction Closure (`auction:sold`)**:
   - Let the timer count down to 0 seconds without placing any more bids.
   - Verify all 3 windows display the **"AUCTION CLOSED!"** Victory Overlay Modal with winner handle and final price, and further bidding is disabled.
   - Click **"Reset Auction"** to restart the demo round anytime!
