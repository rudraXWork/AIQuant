# Stock Trading Dashboard

A real-time stock trading dashboard built with React + Vite, featuring live market data from Angel One API.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory with your Angel One credentials:

```env
API_KEY=your_api_key_here
CLIENT_CODE=your_client_code_here
PASSWORD=your_password_here
TOTP_SECRET=your_totp_secret_here

# EmailJS config for real email OTP delivery
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key
EMAILJS_API_URL=https://api.emailjs.com/api/v1.0/email/send
```

**Note:** Never commit your `.env` file to GitHub. Use `.env.example` as a template.

### 3. Run the Application

Start the backend server:
```bash
npm run server
```

Start the frontend development server:
```bash
npm run dev
```

## Features

- Real-time stock market data from NSE/BSE
- WebSocket integration for live updates
- Interactive charts and metrics
- Trading modal for stock transactions
- Market news and insights
- Forgot password via real email OTP (EmailJS)

## Render Deployment (Backend)

### 1. Create a Render Web Service
- Connect your GitHub repo
- **Root Directory**: `Website`

### 2. Build & Start Commands
- **Build Command**:
	```bash
	npm install && python3 -m pip install -r requirements.txt && ./scripts/download-ml-assets.sh
	```
- **Start Command**:
	```bash
	node server.js
	```

### 3. Environment Variables
Set all backend vars in Render:
- `MONGODB_URI`, `MONGODB_DB`
- `JWT_SECRET`
- `API_KEY`, `CLIENT_CODE`, `PASSWORD`, `TOTP_SECRET`
- `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, `EMAILJS_API_URL`
- `MODEL_URL`, `TRANSFORMER_URL` (for ML assets)
- Optional: `MODEL_ROOT`, `MODEL_PATH`, `TRANSFORMER_PATH`

### 4. Frontend API URL
Set `VITE_API_URL` in your frontend host (Vercel) to your Render service URL.

## Email OTP Setup (EmailJS)

1. Create an account at EmailJS and create an Email Service.
2. Create an email template with params such as `to_email`, `otp`, and `message`.
3. Collect Service ID, Template ID, Public Key, and Private Key.
4. Add `EMAILJS_*` values to your `.env`.
5. Start backend with `npm run server` and use the "Forgot password" flow on login page.

## Security

- All sensitive credentials are stored in `.env` file
- `.env` is excluded from version control via `.gitignore`
- Use `.env.example` as a template for required environment variables
