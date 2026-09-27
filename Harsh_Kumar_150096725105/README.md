# 🔨 Real-Time Live Auction & Bidding Engine

A low-latency Real-Time Live Auction & Bidding Platform using Node.js, Express.js, and Socket.io.

## 👨‍🎓 Student Details

**Name:** Harsh Kumar  
**Roll No.:** 150096725105  
**Course:** BTech CSE  
**Assignment:** 15 — Real-Time Live Auction & Bidding Engine (Socket.io)  

## ✨ Features

- **Live Bidding Floor:** Real-time synchronized bid processing.
- **Authoritative Validation:** Server ensures bids meet minimum increments and rejects self-bids.
- **Outbid Alerts:** Targeted real-time alerts instantly notify users when they are outbid.
- **Server-Side Countdown Timer:** A synchronized 1-second interval clock broadcast to all clients.
- **Anti-Snipe System:** Extends the auction timer if a valid bid is placed in the final 15 seconds.
- **Live Bid History:** Maintains and displays an auditable history of bids.
- **Viewer Count:** Live tracking of audience size on the bidding floor.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Real-Time Engine:** Socket.io
- **Frontend:** Vanilla JS, HTML, CSS (Dark Trading Floor Theme)

## 📁 Project Structure

```text
Harsh-Assignment-15-Realtime-Auction-Platform/
├── public/
│   ├── index.html           # Live bidding floor UI
│   ├── app.js               # Client socket handlers & bid buttons
│   └── style.css            # Dark trading floor aesthetic & animations
├── sockets/
│   ├── auctionEngine.js     # Bid validation, outbid alerts & anti-snipe logic
│   ├── auctionStore.js      # In-memory data store for live auctions
│   └── timerManager.js      # Server-side 1s interval countdown clock
├── .env.example
├── .gitignore
├── package.json
└── server.js                # Server setup
```

## 🚀 Getting Started

### Prerequisites

- Node.js installed on your machine

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/harsh4421/Harsh-Assignment-15-Realtime-Auction-Platform.git
   ```

2. Navigate to the project directory:
   ```bash
   cd Harsh-Assignment-15-Realtime-Auction-Platform
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   npm start
   ```

   For development with nodemon:
   ```bash
   npm run dev
   ```

5. **How to Use:**
   - Navigate to `http://localhost:5000` in multiple browser windows.
   - Enter a unique username in each window to join the auction floor.
   - Try placing bids to see real-time synchronization.
   - Observe the "Outbid" alerts pop up for the previous highest bidder.
   - Place a bid in the final 15 seconds to trigger the Anti-Snipe timer extension!
