# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a company New Year's lottery web application built with React, Vite, TypeScript, and Firebase. The application allows users to purchase lottery tickets, admins to manage the lottery, and provides a live drawing session with animations.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Firebase (Authentication + Firestore)
- **Routing**: React Router DOM
- **Styling**: CSS (component-scoped)
- **Date Handling**: date-fns

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Firebase Setup

1. Create a `.env` file based on `.env.example`
2. Add your Firebase configuration values:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## Architecture

### Authentication Flow

- **Email OTP**: Users receive a magic link via email (no password required)
- **Google OAuth**: Alternative sign-in method
- **Name Setup**: First-time email users must provide their display name
- **Protected Routes**: All main routes require authentication

### Firestore Collections

1. **users**
   - Stores user profiles (uid, email, displayName, isAdmin)
   - Created on first login

2. **lotteries**
   - Stores lottery settings (eventDate, ticketPrice, maxTickets, isActive)
   - Only one active lottery at a time

3. **tickets**
   - Stores all lottery tickets with 5 random numbers (1-50)
   - Status: available, requested, confirmed, expired
   - Links to user when purchased

4. **ticketRequests**
   - Stores purchase requests from users
   - Status: pending, approved, rejected
   - Admin reviews and approves/rejects

5. **lotterySessions**
   - Stores live drawing session data
   - Real-time updates for all viewers
   - Tracks drawn numbers and winners

### Key Features

#### User Flow
1. Login via email (OTP) or Google
2. Set display name (if email login)
3. View lottery countdown and own tickets
4. Purchase tickets (request → admin approval)
5. Watch live drawing session
6. See highlighted numbers on tickets in real-time

#### Admin Flow
1. Create lottery with settings (date, price, max tickets)
2. Review and approve/reject ticket purchase requests
3. Start live drawing session
4. System auto-generates tickets with random numbers

#### Lottery Session
- Real-time synchronized drawing across all connected users
- Animated balloon drawing 5 numbers sequentially
- Numbers highlighted on user tickets in real-time
- Winner determination based on matching numbers
- Confetti animation for winners
- Multiple winners split the prize if same match count

### Timing Rules

- **1 hour before event**: Unconfirmed ticket requests expire
- **5 minutes before event**: Ticket purchasing closes
- **Event time**: Live drawing begins

### Component Structure

```
src/
├── config/
│   └── firebase.ts          # Firebase initialization
├── contexts/
│   └── AuthContext.tsx      # Authentication state management
├── types/
│   └── index.ts             # TypeScript type definitions
├── components/
│   ├── auth/
│   │   ├── Login.tsx        # Email/Google login
│   │   ├── CompleteSignIn.tsx # Email link verification
│   │   └── NameSetup.tsx    # Display name input
│   ├── user/
│   │   ├── UserHome.tsx     # Main user dashboard
│   │   └── BuyTicket.tsx    # Ticket purchase flow
│   ├── admin/
│   │   └── AdminPanel.tsx   # Admin dashboard
│   ├── lottery/
│   │   └── LotterySession.tsx # Live drawing
│   └── common/
│       └── Ticket.tsx       # Ticket component (Milli Piyango style)
└── App.tsx                  # Routes and auth guards
```

### Design System

The ticket design mimics the Turkish "Milli Piyango" (National Lottery) style:
- Gold borders and decorative elements
- Large ticket number display
- 5 circular number badges
- Status badges (pending/confirmed/expired)
- Gradient backgrounds
- Highlight animations for drawn numbers

### Real-time Updates

All data uses Firestore's `onSnapshot` for real-time synchronization:
- Lottery settings
- User tickets
- Ticket requests
- Drawing session state
- Ensures all users see the same state simultaneously

## Admin Setup

To make a user an admin, manually update their Firestore user document:
```javascript
{
  isAdmin: true
}
```

## Future Enhancements

The codebase is ready for additional features like:
- Payment integration
- Email notifications
- Prize distribution tracking
- Lottery history/archive
- Statistics dashboard
