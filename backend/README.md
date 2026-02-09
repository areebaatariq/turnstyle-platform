# Turnstyle Backend API

Backend API server for Turnstyle - Digital Wardrobe Platform with OAuth authentication support.

## Features

- ✅ Google OAuth authentication
- ✅ Apple OAuth authentication
- ✅ JWT token-based authentication
- ✅ User management
- ✅ RESTful API endpoints

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Database Configuration (MongoDB)
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Apple OAuth Configuration
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY_PATH=./path/to/AuthKey.p8
APPLE_REDIRECT_URI=http://localhost:3000/api/auth/apple/callback

# Frontend URL (for CORS and redirects). Production: https://turnstyle.onrender.com
FRONTEND_URL=http://localhost:5137

# Email Configuration (for sending invitations via SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@turnstyle.com
```

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (development)
   - Your production callback URL
7. Copy the Client ID and Client Secret to your `.env` file

### 4. Apple OAuth Setup

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Create an App ID
3. Enable "Sign in with Apple" capability
4. Create a Service ID with "Sign in with Apple" enabled
5. Configure authorized domains and redirect URLs
6. Create a Key with "Sign in with Apple" enabled
7. Download the `.p8` key file
8. Copy the Team ID, Key ID, Client ID, and private key path to your `.env` file

## Running the Server

### Development

```bash
npm run dev
```

This will start the server with hot-reload using `tsx watch`.

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Authentication

#### Google OAuth

- **GET** `/api/auth/google` - Redirects to Google OAuth consent screen
- **GET** `/api/auth/google/callback` - Google OAuth callback handler
- **POST** `/api/auth/google/verify-token` - Verify Google ID token (client-side)

  Request body:
  ```json
  {
    "idToken": "google-id-token-here"
  }
  ```

  Response:
  ```json
  {
    "success": true,
    "token": "jwt-token-here",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "userType": "stylist",
      "profilePhotoUrl": "https://...",
      "oauthProvider": "google"
    }
  }
  ```

#### Apple OAuth

- **GET** `/api/auth/apple` - Redirects to Apple OAuth consent screen
- **POST** `/api/auth/apple/callback` - Apple OAuth callback handler
- **POST** `/api/auth/apple/verify-token` - Verify Apple ID token (client-side)

  Request body:
  ```json
  {
    "idToken": "apple-id-token-here"
  }
  ```

  Response:
  ```json
  {
    "success": true,
    "token": "jwt-token-here",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "userType": "stylist",
      "profilePhotoUrl": null,
      "oauthProvider": "apple"
    }
  }
  ```

### Health Check

- **GET** `/health` - Server health check

## Authentication Flow

### Recommended: Client-Side Token Verification

1. User clicks "Sign in with Google/Apple" in the frontend
2. Frontend handles OAuth flow using Google/Apple SDKs
3. Frontend receives ID token from provider
4. Frontend sends ID token to backend: `POST /api/auth/google/verify-token` or `POST /api/auth/apple/verify-token`
5. Backend verifies the token and returns a JWT
6. Frontend stores the JWT and uses it for authenticated requests

### Alternative: Server-Side Redirect Flow

1. User clicks "Sign in with Google/Apple" in the frontend
2. Frontend redirects to backend: `GET /api/auth/google` or `GET /api/auth/apple`
3. Backend redirects to provider's consent screen
4. User authorizes the app
5. Provider redirects back to backend callback URL
6. Backend exchanges code for tokens and creates/logs in user
7. Backend redirects to frontend with JWT token

## Data Storage

Currently, the backend uses a JSON file-based storage system (`data/users.json`) for simplicity. In production, you should replace this with a proper database (PostgreSQL, MongoDB, etc.).

## Security Notes

- Always use HTTPS in production
- Store sensitive credentials in environment variables, never commit them
- Use a strong, random JWT_SECRET
- Implement rate limiting for authentication endpoints
- Consider implementing refresh tokens for better security
- Validate all input data

## Project Structure

```
backend/
├── src/
│   ├── middleware/
│   │   ├── auth.ts          # JWT authentication middleware
│   │   └── errorHandler.ts  # Error handling middleware
│   ├── routes/
│   │   └── auth.ts          # Authentication routes
│   ├── services/
│   │   ├── googleAuth.ts    # Google OAuth service
│   │   └── appleAuth.ts     # Apple OAuth service
│   ├── types/
│   │   └── user.ts          # User type definitions
│   ├── utils/
│   │   ├── database.ts      # Database utilities
│   │   └── jwt.ts           # JWT utilities
│   └── server.ts            # Express server setup
├── data/                    # JSON database storage (auto-created)
├── dist/                    # Compiled JavaScript (after build)
├── package.json
├── tsconfig.json
└── README.md
```
