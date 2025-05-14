# WorkforceManager Deployment Guide

This guide explains how to deploy the WorkforceManager application on Render.

## Prerequisites

- A [Render](https://render.com/) account
- A PostgreSQL database (you can use Render's PostgreSQL service or any other provider)
- Gmail account for sending emails (with App Password configured)

## Deployment Steps

### 1. Fork or Clone the Repository

Make sure you have the complete codebase on your GitHub account or local machine.

### 2. Set Up Database

- Create a PostgreSQL database on Render or another provider
- Note the connection string, you'll need it for configuration

### 3. Deploy on Render

#### Using the Render Dashboard

1. Log in to your Render account
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: workforce-manager
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add the following environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `SESSION_SECRET`: A secure random string
   - `GMAIL_USER`: Your Gmail address
   - `GMAIL_PASS`: Your Gmail App Password
   - `NODE_ENV`: production
   - `PORT`: 5000 (Render will override this)
6. Click "Create Web Service"

#### Using render.yaml (Recommended)

1. The repository includes a `render.yaml` file for Blueprint deployment
2. Log in to Render and navigate to Blueprints
3. Click "New Blueprint Instance"
4. Connect your repository
5. Configure the required environment variables
6. Deploy

### 4. Verify Deployment

1. Once deployed, Render will provide a URL for your application
2. Visit the URL to confirm the application is running
3. Check the health endpoint at `/api/health` to verify the backend is operational

## Troubleshooting

- **Database Connection Issues**: Verify your `DATABASE_URL` is correct and the database is accessible from Render
- **Email Sending Problems**: Ensure your Gmail App Password is correctly configured
- **Application Errors**: Check the Render logs for detailed error information

## Maintenance

- Monitor your application logs in the Render dashboard
- Set up alerts for service outages
- Regularly update dependencies to maintain security

For more information, refer to the [Render documentation](https://render.com/docs). 