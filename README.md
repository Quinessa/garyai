# GaryAI Wallet - Telegram Mini App

## Project Overview
GaryAI Wallet is a Telegram Mini App that allows users to manage Ethereum wallets and perform transactions within Telegram, using both an AI assistant interface and traditional UI components.

## Key Features

### User Features
1. Telegram authentication/login
2. Wallet creation and management
3. View wallet balances across multiple tokens
4. Send tokens to other addresses
5. Receive tokens (view address/QR code)
6. Swap tokens between different cryptocurrencies
7. Transaction history and details
8. Security settings configuration
9. Transaction confirmation requirements
10. Address whitelisting for trusted recipients

### AI Assistant Capabilities
- Accept text and voice commands from users
- Understand user intent through NLP
- Trigger any wallet feature based on natural language requests
- Execute wallet operations (send/receive/swap) via voice commands
- Provide transaction information conversationally
- Check balances when asked
- Create new wallets through conversation
- Handle security confirmations verbally
- Guide users through complex operations
- Respond to questions about crypto or wallet functionality

### UI Approach
1. **Main Interface**: Chat-like interface similar to ChatGPT
   - Message history showing conversation with GaryAI
   - Text input field at bottom for typing commands
   - Voice input button for speaking commands
   - Chat bubbles showing both user messages and AI responses
   - Ability for AI to render structured elements within chat

2. **Mobile-Friendly Quick Access Menu**:
   - Persistent bottom navigation bar with icons for key functions:
     - Chat (main AI interaction)
     - Wallet (balances/addresses)
     - Send (quick transfer)
     - Swap (exchange tokens)
     - History (transaction log)
   - Slide-up panels from bottom navigation that don't leave the chat context
   - Each panel contains simplified UI for that specific function
   - AI remains aware of menu interactions
   - Results from menu actions appear in chat thread for continuity
   - Gestures for quick actions (swipe to send, etc.)

## Technology Stack
- **Frontend**: React, Next.js, Tailwind CSS
- **State Management**: React Context API
- **Backend**: Next.js API Routes, Supabase Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Telegram Login Widget
- **Blockchain Interaction**: ethers.js v5
- **Styling**: Tailwind CSS with custom theme
- **Deployment**: Vercel
- **Development**: TypeScript, ESLint, Prettier

## Development Principles
1. Build in a modular way to avoid breaking everything while working
2. Proceed step by step with incremental development
3. Never edit working code without asking and getting explicit agreement
4. Maintain a clean separation of concerns between components

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env.local` file with the required environment variables
4. Run the development server with `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables
See the `.env.example` file for required environment variables.
