/**
 * socket-client.js
 * Client-side Socket.io abstraction layer.
 * Communicates authoritatively with backend auction engine.
 */

class AuctionSocketClient {
  constructor() {
    this.socket = null;
    this.callbacks = new Map();
  }

  /**
   * Initialize socket connection
   */
  connect() {
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      this.trigger('connect', { id: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      this.trigger('disconnect', { reason });
    });

    // Auction lifecycle & state events
    this.socket.on('auction:init', (data) => this.trigger('auction:init', data));
    this.socket.on('auction:time_tick', (data) => this.trigger('auction:time_tick', data));
    this.socket.on('user:joined', (data) => this.trigger('user:joined', data));
    this.socket.on('bid:success', (data) => this.trigger('bid:success', data));
    this.socket.on('bid:outbid', (data) => this.trigger('bid:outbid', data));
    this.socket.on('bid:rejected', (data) => this.trigger('bid:rejected', data));
    this.socket.on('auction:extended', (data) => this.trigger('auction:extended', data));
    this.socket.on('auction:sold', (data) => this.trigger('auction:sold', data));
    this.socket.on('auction:activity', (data) => this.trigger('auction:activity', data));
    this.socket.on('auction:reset_all', (data) => this.trigger('auction:reset_all', data));
  }

  /**
   * Register event callback
   */
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  /**
   * Trigger internal event callbacks
   */
  trigger(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(cb => cb(data));
    }
  }

  /**
   * Join an auction room
   */
  joinAuction(auctionId, username) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('auction:join', { auctionId, username });
    }
  }

  /**
   * Place a bid
   */
  placeBid(auctionId, bidder, amount) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('bid:place', { auctionId, bidder, amount });
    }
  }
}

window.AuctionSocketClient = AuctionSocketClient;
