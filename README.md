# Assignment 15 - Real-Time Live Auction & Bidding Engine
https://saiyashpoojariassignment-15-realtime.onrender.com (Render URL)
## Overview

A real-time live auction and bidding platform built using Node.js, Express.js and Socket.io.

The application provides an authoritative server-side bidding engine that validates bids, prevents invalid concurrent actions, broadcasts live bid updates, notifies users when they are outbid and synchronizes auction countdown timers across connected bidders.

## Features

- Real-time live bidding
- Multiple bidders in an auction room
- Server-authoritative auction state
- Minimum bid increment validation
- Prevention of self-outbidding
- Real-time bid broadcasting
- Targeted outbid notifications
- Live viewer count
- Auditable bid history
- Server-side countdown timer
- Synchronized auction timer
- Anti-snipe timer extension
- Auction completion and winner declaration
- Invalid bid rejection
- In-memory auction state management
- Responsive live auction interface

## Tech Stack

- Node.js
- Express.js
- Socket.io
- CORS
- dotenv
- uuid
- HTML5
- CSS3
- JavaScript

## Auction Flow

```text
Auction Room
     |
     v
Bidders Join
     |
     v
Live Countdown Starts
     |
     v
Bidder Places Bid
     |
     v
Server Validates Bid
     |
     +---- Invalid ----> Bid Rejected
     |
     v
Update Highest Bid
     |
     v
Broadcast New Bid
     |
     +---- Previous Bidder ----> Outbid Notification
     |
     v
Check Anti-Snipe Rule
     |
     v
Continue Countdown
     |
     v
Timer Reaches Zero
     |
     v
Auction Sold / Winner Declared
