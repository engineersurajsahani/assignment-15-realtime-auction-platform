require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { setupAuctionEngine, auctions } = require("./sockets/auctionEngine");
const { startTimer } = require("./sockets/timerManager");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/api/auctions", (req, res) => {
  res.json(Object.values(auctions).map(({ timerInterval, ...auction }) => auction));
});

io.on("connection", (socket) => {
  setupAuctionEngine(io, socket);
});

startTimer(io);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Auction server running on http://localhost:${PORT}`);
});