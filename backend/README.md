# Self-Hosted Synchronization Backend

This project provides a secure, self-hosted backend for synchronizing user conversations and messages across multiple devices. It is built with Node.js, Express, and TypeScript, and uses an encrypted SQLite database for storage.

## Features

- **Secure Authentication**: Passwordless login using one-time passwords (OTP) sent to the user's email.
- **API Key Management**: Users can generate and revoke multiple API keys for their client applications.
- **Encrypted Storage**: All data is stored in a single SQLite file, encrypted at rest using SQLCipher.
- **Efficient Delta Sync**: Only changes since the last sync are transmitted, saving bandwidth.
- **Conflict Resolution**: Implements a "Last-Write-Wins" strategy to resolve data conflicts automatically.
- **Soft Deletes**: Deleted items are marked but not removed, ensuring deletions are synced correctly across all devices.

## Project Structure

```
/
├── dist/                     # Compiled JavaScript output
├── src/                      # TypeScript source code
│   ├── middleware/
│   │   └── auth.ts           # JWT and API Key authentication middleware
│   ├── models/
│   │   └── types.ts          # TypeScript interfaces for data models
│   ├── routes/               # Express route definitions
│   │   ├── auth.ts           # OTP authentication routes
│   │   ├── keys.ts           # API key management routes
│   │   └── sync.ts           # The core data synchronization route
│   ├── services/
│   │   ├── database.ts       # Service for all database interactions
│   │   └── email.ts          # Mock email service (for development)
│   └── index.ts              # Main server entrypoint
├── .env.example              # Example environment variables
├── package.json              # Project dependencies and scripts
├── README.md                 # This file
└── tsconfig.json             # TypeScript compiler configuration
```

## Setup and Installation

### 1\. Prerequisites

- [Node.js](https://nodejs.org/ 'null') (v18 or later recommended)

- npm (included with Node.js)

### 2\. Clone the Repository

    git clone <repository-url>
    cd sync-backend

### 3\. Install Dependencies

    npm install

This command also runs the `postinstall` script, which compiles the TypeScript code.

### 4\. Configure Environment Variables

Create a `.env` file in the root of the project by copying the example file:

    cp .env.example .env

Now, open the `.env` file and **change the default secret keys**:

    # Server configuration
    PORT=3000

    # Database configuration
    DATABASE_PATH="./database.db"
    DATABASE_ENCRYPTION_KEY="<generate-a-strong-random-string-here>"

    # Security configuration
    JWT_SECRET="<generate-another-strong-random-string-here>"

    # OTP configuration
    OTP_EXPIRATION_MINUTES=15

**Security Warning**: Do not use the default keys in a production environment.

## Running the Application

### For Development

This command starts the server using `ts-node` and `nodemon`, which will automatically restart the server whenever you save a file.

    npm run dev

The server will be available at `http://localhost:3000`. OTP codes will be printed to the console.

### For Production

First, build the TypeScript code into JavaScript:

    npm run build

Then, start the application:

    npm start

This runs the compiled code from the `dist/` directory, which is more performant for a production environment.
