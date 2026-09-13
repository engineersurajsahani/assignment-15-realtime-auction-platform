# 🔨 Real-Time Live Auction & Bidding Engine

A real-time multiplayer auction platform built with Node.js, Express.js, and Socket.io.

The application provides a live bidding experience where multiple users can participate in the same auction, see bid updates instantly, receive outbid notifications, and experience synchronized countdown timers with anti-snipe protection.

## 🚀 Live Demo

https://itm-assignment-15-auction-socket.onrender.com/

## ✨ Features

* Real-time multiplayer bidding
* Server-authoritative bid validation
* Minimum bid increment enforcement
* Prevention of self-outbidding
* Instant highest-bid updates
* Targeted outbid notifications
* Synchronized server-side countdown timer
* Anti-snipe timer extension
* Live auction viewer counter
* Real-time bid activity history
* Auction completion and winner announcement
* Responsive and modern auction-floor interface
* Live status and visual feedback
* Health-check API for deployment monitoring

## 🛠️ Tech Stack

### Backend

* Node.js
* Express.js
* Socket.io
* CORS
* dotenv
* UUID

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript
* Socket.io Client

### State Management

The application uses an in-memory auction state engine. The server acts as the authoritative source for auction state and bid validation.

## 🎯 How It Works

The application starts with a live auction for a 1967 Vintage Fender Stratocaster.

Starting Price: ₹50,000

Minimum Bid Increment: ₹2,000

Auction Duration: 60 seconds

Anti-Snipe Extension: 20 seconds

Users enter a display name and join the auction room. Once connected, every participant receives the current auction state and can see live updates from other bidders.

When a valid bid is placed, the server validates the bid and broadcasts the updated highest bid to everyone in the auction room.

The previous highest bidder receives a private outbid notification.

## 💰 Bidding Rules

Every bid is validated by the server before it is accepted.

A bid must:

* Be placed while the auction is active
* Be higher than the current bid by at least the minimum increment
* Come from a user who has joined the auction
* Not be placed by the current highest bidder

Invalid bids are rejected with an appropriate reason.

For example:

Starting bid: ₹50,000

Minimum valid bid: ₹52,000

If a bidder places ₹52,000, the current bid immediately becomes ₹52,000.

The next minimum valid bid becomes ₹54,000.

## ⏱️ Anti-Snipe Protection

The auction includes an anti-sniping mechanism to prevent last-second bids from ending the auction unfairly.

When a valid bid is placed during the final 15 seconds:

* The auction timer is extended
* The timer is reset to 20 seconds
* All connected bidders receive an auction extension notification

This gives other participants an opportunity to respond to the new bid.

## 🔄 Real-Time Socket Events

### Auction Events

auction:join

Allows a bidder to join the live auction room.

auction:init

Sends the current auction state to a newly joined bidder.

auction:time_tick

Broadcasts the synchronized countdown every second.

user:joined

Updates the number of active viewers.

### Bidding Events

bid:place

Used by a bidder to submit a new bid.

bid:success

Broadcasts a successfully accepted bid to all participants.

bid:outbid

Sends a private notification to the previous highest bidder.

bid:rejected

Returns the reason when a bid fails validation.

auction:extended

Notifies participants when anti-snipe protection extends the auction.

auction:sold

Announces the final auction result when the countdown reaches zero.

## 📁 Project Structure

Pallavi_Sarovar_15/

└── assignment-15-auction-socket/

```
├── public/

│   ├── index.html

│   ├── app.js

│   └── style.css

├── sockets/

│   └── auctionEngine.js

├── server.js

├── package.json

├── .env.example

├── .gitignore

└── README.md
```

## ⚙️ Installation

Clone the repository and navigate to the auction project directory.

Install the required dependencies using npm install.

Create a .env file if you want to configure a custom port.

The default application port is 5000.

## ▶️ Running the Application

Start the application using npm start.

For development, use npm run dev.

The application will be available at:

http://localhost:5000

## 🧪 Testing the Application

The real-time functionality can be tested by opening the auction application in multiple browser tabs.

### Test Scenario

1. Open the application in three browser tabs.
2. Join each tab using a different display name.
3. Place a valid bid from the first bidder.
4. Verify that the current bid updates on every connected tab.
5. Place a higher bid from another bidder.
6. Verify that the previous highest bidder receives an outbid notification.
7. Wait until the timer reaches the final 15 seconds.
8. Place another valid bid.
9. Verify that the timer is extended back to 20 seconds.
10. Allow the timer to reach zero.
11. Verify that the auction result is displayed.
12. Attempt another bid and verify that the server rejects it.

## 🔌 API Endpoints

### Health Check

GET /api/health

Returns the current service and auction status.

### Auction State

GET /api/auction

Returns the current auction information, highest bidder, bid history, remaining time, and viewer count.

## 🔐 Server-Side Validation

The server is responsible for all important bidding decisions.

This prevents the client from directly manipulating the current bid or auction state.

The server validates:

* Auction status
* Bid amount
* Minimum bid increment
* Current highest bidder
* Auction timer
* Bid history
* Final auction state

## 🎨 User Interface

The frontend is designed as a modern live auction floor rather than a traditional dashboard.

The interface includes:

* Live auction status
* Current bid display
* Countdown timer
* Leading bidder information
* Bid input and quick-bid controls
* Live bid activity feed
* Viewer count
* Connection status
* Outbid notifications
* Anti-snipe notifications
* Auction completion modal
* Responsive layout for different screen sizes

## 📝 Important Note

The auction uses in-memory state as required by the assignment.

Because the state is stored in memory, restarting the Node.js server resets the auction state and starts a fresh auction.

## 📌 Assignment Coverage

This project covers the major requirements of the real-time auction assignment:

* Real-time bid processing
* Authoritative bid validation
* Minimum bid increments
* Self-outbid prevention
* Server-side countdown synchronization
* Anti-snipe timer extension
* Targeted outbid notifications
* Live room broadcasting
* Auditable bid history
* Live viewer counter
* Professional auction UI
* Real-time Socket.io architecture
