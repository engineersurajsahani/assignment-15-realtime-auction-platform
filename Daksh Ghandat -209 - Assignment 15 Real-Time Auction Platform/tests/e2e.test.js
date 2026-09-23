const { io } = require("socket.io-client");

const URL = process.env.AUCTION_URL || "http://localhost:5001";
const AUCTION_ID = "AUC_VINTAGE_99";

const results = [];
let failures = 0;
const log = (name, pass, detail = "") => {
  const status = pass ? "PASS" : "FAIL";
  if (!pass) failures++;
  console.log(`[${status}] ${name}${detail ? " · " + detail : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(username) {
  const socket = io(URL, { transports: ["websocket"], reconnection: false });
  socket.connect();
  const wait = (event, timeout = 7000) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeout);
      socket.once(event, (data) => {
        clearTimeout(t);
        resolve(data);
      });
      socket.once("connect_error", (e) => {
        clearTimeout(t);
        reject(new Error(`connect_error: ${e.message}`));
      });
    });
  return { socket, wait };
}

async function run() {
  const suffix = Date.now().toString().slice(-4);
  const bidderA = `Vikram_${suffix}`;
  const bidderB = `Ananya_${suffix}`;

  const a = connect(bidderA);
  await sleep(400);
  a.socket.emit("auction:join", { auctionId: AUCTION_ID, username: bidderA });
  const initA = await a.wait("auction:init");
  const startBid = initA.item.currentBid;
  const minInc = initA.item.minIncrement;
  log("Join + auction:init hydration", initA.item.id === AUCTION_ID, `currentBid=${startBid}`);

  const b = connect(bidderB);
  await sleep(400);
  b.socket.emit("auction:join", { auctionId: AUCTION_ID, username: bidderB });
  const initB = await b.wait("auction:init");
  log("Second bidder hydrates same state", initB.item.currentBid === startBid);

  const belowMin = startBid + Math.floor(minInc / 2);
  const rejLow = a.wait("bid:rejected");
  a.socket.emit("bid:place", { auctionId: AUCTION_ID, amount: belowMin });
  const low = await rejLow;
  log("Below-min bid rejected", low.reason.toLowerCase().includes("minimum"), low.reason);

  const bid1 = startBid + minInc;
  const succA = a.wait("bid:success");
  const placedA = a.wait("bid:placed");
  a.socket.emit("bid:place", { auctionId: AUCTION_ID, amount: bid1 });
  const s1 = await succA;
  await placedA;
  log(`Bid ${bidderA} ${bid1} accepted`, s1.newBid === bid1 && s1.highestBidder === bidderA);

  const rejSelf = a.wait("bid:rejected");
  a.socket.emit("bid:place", { auctionId: AUCTION_ID, amount: bid1 + minInc });
  const self = await rejSelf;
  log("Self-outbid prohibited", self.reason.toLowerCase().includes("already"), self.reason);

  const bid2 = bid1 + minInc;
  const outbidPromise = a.wait("bid:outbid");
  const succB = b.wait("bid:success");
  b.socket.emit("bid:place", { auctionId: AUCTION_ID, amount: bid2 });
  const alert = await outbidPromise;
  const s2 = await succB;
  log("Outbid alert sent to previous leader", alert.message.includes(bidderB), alert.message);
  log(`Bid ${bidderB} ${bid2} accepted`, s2.newBid === bid2 && s2.highestBidder === bidderB);

  log("bid:success includes updated history", Array.isArray(s2.bidHistory) && s2.bidHistory.length >= 2);

  const health = await fetch(`${URL}/api/health`).then((r) => r.json());
  if (health.db) {
    const bids = await fetch(`${URL}/api/auctions/${AUCTION_ID}/bids`).then((r) => r.json());
    log("Bids persisted to MongoDB audit log", Array.isArray(bids.bids) && bids.bids.length >= 2, `count=${bids.bids.length || 0}`);
  } else {
    console.log("[SKIP] MongoDB audit log — MONGO_URI not configured, running in-memory only");
  }

  a.socket.close();
  b.socket.close();

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : failures + " TEST(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error("TEST ERROR:", e.message);
  process.exit(1);
});