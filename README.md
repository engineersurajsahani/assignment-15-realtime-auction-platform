# 🔨 Real-Time Live Auction & Bidding Engine (Assignment 15)

🚀 **Live Deployment Links:**
- **Render:** [https://samarth-assignment-15-realtime-auction-platform.onrender.com](https://samarth-assignment-15-realtime-auction-platform.onrender.com)
- **Vercel:** [https://samarth-assignment-15-auction-app.vercel.app](https://samarth-assignment-15-auction-app.vercel.app)

---

- **Name:** Samarth Navale
- **Roll No:** 150096725148
- **Cohort:** Sam Altman

---

A mission-critical, low-latency **Real-Time Live Auction & Bidding Platform** built with **Node.js, Express.js, and Socket.io**. Features an authoritative bidding engine with minimum bid increments, real-time private outbid notifications, synchronized live countdown timers, and **Anti-Snipe Timer Extensions** (soft-close reset).

---

## 🚀 Features

- 🔨 **Authoritative Bidding Engine**: Validates minimum increments, prevents self-outbidding, and synchronizes real-time prices.
- ⏱️ **Synchronized Countdown & Anti-Snipe**: Automatic server timer with +20s extension if a bid arrives in the final 15 seconds.
- 🔔 **Targeted Outbid Notifications**: Private alerts delivered directly to the displaced highest bidder.
- 📜 **Auditable Live Bid History**: Real-time ticker and activity feed for all room participants.
- 👥 **Live Audience Tracker**: Dynamic viewer counting on the trading floor.

---

## 📁 Project Folder Structure

```text
📂 Assignment15/
├── 📄 render.yaml
├── 📄 vercel.json
├── 📄 Assignment 15.txt
├── 📄 README.md
└── 📂 Samarth_Navale_150096725148/
    ├── 📄 server.js
    ├── 📄 package.json
    ├── 📄 .env & .env.example
    ├── 📄 .gitignore
    ├── 📄 render.yaml & vercel.json
    ├── 📄 README.md
    ├── 📂 public/
    │   ├── 📄 index.html
    │   ├── 📄 app.js
    │   └── 📄 style.css
    └── 📂 sockets/
        ├── 📄 auctionEngine.js
        └── 📄 timerManager.js
```

---

## 🛠️ Tech Stack & Dependencies

- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-Time Engine:** Socket.io
- **Frontend UI:** HTML5 & Vanilla JavaScript

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=development
```

---

## 🧪 Testing

```bash
cd Samarth_Navale_150096725148
npm install
npm test
```
