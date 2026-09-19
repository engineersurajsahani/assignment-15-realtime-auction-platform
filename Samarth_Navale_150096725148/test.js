const app = require('./server');
const server = app.server;
const { io: ioClient } = require('socket.io-client');
const request = require('supertest');
const { auctions } = require('./sockets/auctionEngine');

const PORT = 5088;

const runTests = async () => {
  let passed = 0;
  let total = 0;

  const assert = (condition, name) => {
    total++;
    if (condition) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name}`);
    }
  };

  await new Promise((resolve) => server.listen(PORT, resolve));

  const clientUrl = `http://localhost:${PORT}`;

  try {
    const statusRes = await request(app).get('/api/status');
    assert(statusRes.status === 200 && statusRes.body.success, 'HTTP - API status endpoint');

    const socketVikram = ioClient(clientUrl, { reconnection: false });
    const socketAnanya = ioClient(clientUrl, { reconnection: false });
    const socketViewer = ioClient(clientUrl, { reconnection: false });

    await new Promise((resolve) => socketVikram.on('connect', resolve));
    await new Promise((resolve) => socketAnanya.on('connect', resolve));
    await new Promise((resolve) => socketViewer.on('connect', resolve));
    assert(socketVikram.connected && socketAnanya.connected && socketViewer.connected, 'Socket.io - 3 clients connected');

    const initPromise = new Promise((resolve) => {
      socketVikram.on('auction:init', (data) => {
        resolve(data);
      });
    });

    socketVikram.emit('auction:join', { auctionId: 'AUC_VINTAGE_99', username: 'Vikram' });
    socketAnanya.emit('auction:join', { auctionId: 'AUC_VINTAGE_99', username: 'Ananya' });
    socketViewer.emit('auction:join', { auctionId: 'AUC_VINTAGE_99', username: 'Viewer' });

    const initData = await initPromise;
    assert(initData.item.startingPrice === 50000, 'Auction - Join floor & receive initial item state');

    const bidSuccessPromise = new Promise((resolve) => {
      socketViewer.on('bid:success', (data) => {
        resolve(data);
      });
    });

    socketVikram.emit('bid:place', { auctionId: 'AUC_VINTAGE_99', amount: 52000 });
    const bidData = await bidSuccessPromise;
    assert(bidData.currentBid === 52000 && bidData.highestBidder === 'Vikram', 'Bidding - Valid bid accepted & broadcast to room');

    const selfOutbidPromise = new Promise((resolve) => {
      socketVikram.on('bid:rejected', (data) => {
        resolve(data);
      });
    });

    socketVikram.emit('bid:place', { auctionId: 'AUC_VINTAGE_99', amount: 55000 });
    const selfOutbidData = await selfOutbidPromise;
    assert(selfOutbidData.reason.includes('already the highest bidder'), 'Validation - Prevent self-outbid');

    const lowBidPromise = new Promise((resolve) => {
      socketAnanya.on('bid:rejected', (data) => {
        resolve(data);
      });
    });

    socketAnanya.emit('bid:place', { auctionId: 'AUC_VINTAGE_99', amount: 53000 });
    const lowBidData = await lowBidPromise;
    assert(lowBidData.reason.includes('Bid too low'), 'Validation - Enforce minimum increment check');

    const outbidAlertPromise = new Promise((resolve) => {
      socketVikram.on('bid:outbid', (data) => {
        resolve(data);
      });
    });

    socketAnanya.emit('bid:place', { auctionId: 'AUC_VINTAGE_99', amount: 56000 });
    const outbidAlert = await outbidAlertPromise;
    assert(outbidAlert.message.includes('outbid by Ananya'), 'Notification - Targeted private outbid alert');

    auctions['AUC_VINTAGE_99'].timeRemainingSeconds = 10;

    const extendPromise = new Promise((resolve) => {
      socketViewer.on('auction:extended', (data) => {
        resolve(data);
      });
    });

    socketVikram.emit('bid:place', { auctionId: 'AUC_VINTAGE_99', amount: 59000 });
    const extendData = await extendPromise;
    assert(extendData.timeRemaining === 20, 'Anti-Snipe - Timer extension triggered on late bid');

    socketVikram.disconnect();
    socketAnanya.disconnect();
    socketViewer.disconnect();
    server.close();

    console.log(`\nTests completed: ${passed}/${total} passed`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    server.close();
    process.exit(1);
  }
};

runTests();
