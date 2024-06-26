# Gmail API Integration

This project integrates with the Gmail API to read, categorize, and respond to emails using Node.js. It leverages the Google AI Text Service for text generation and BullMQ for job queue management. 

## Features

- Read unread emails from the Gmail inbox
- Categorize emails using Google AI Text Service
- Generate responses based on email categories
- Send email responses
- Schedule email checks and responses using cron jobs
- Queue email sending tasks using BullMQ and Redis

## Technologies Used

- **Node.js**: JavaScript runtime
- **TypeScript**: JavaScript with type definitions
- **Express**: Web framework for Node.js
- **Axios**: Promise-based HTTP client
- **Nodemailer**: Module to send emails
- **Google APIs**: Google services and APIs
- **BullMQ**: Job queue for Node.js
- **Redis**: In-memory data structure store
- **Open AI Text Service**: AI-powered text generation
- **cron**: Task scheduler for Node.js

## Prerequisites

- Node.js (v14.x or later)
- npm (v6.x or later)
- Redis server
- Google Cloud project with Gmail API and Google AI Text Service enabled

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/AnshumohanAcharya/ReachInBox.git
   cd gmail-api-integration
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create a .env file in the root directory with the following environment variables:**

    ```bash
    PORT = ***
    GOOGLE_CLIENT_ID = ***
    GOOGLE_CLIENT_SECRET = ***
    GOOGLE_REDIRECT_URI = ***
    GRANT_TYPE = ***
    OPENAI_APIKEY = ***
    REDIS_PORT = ***
    REDIS_URL = ***
    REDIS_HOST = ***
    REDIS_PASS = ***
    OUTLOOK_CLIENT_ID = ***
    OUTLOOK_CLIENT_SECRET = ***
    AZURE_TENANT_ID = ***
    SMTP_MAIL = ***
    SMTP_PASS = ***
    API_KEY = ***
    ```

4. **Run the server:**

   ```bash
   npm run dev
   ```   