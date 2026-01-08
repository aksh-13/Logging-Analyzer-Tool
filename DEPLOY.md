# Deployment Guide

Since this is a **Next.js** application, the easiest way to deploy is using **Vercel** (the creators of Next.js).

## Option 1: Vercel (Recommended)

1.  **Push to GitHub**: Ensure your code is pushed to a GitHub repository.
2.  **Create Vercel Account**: Go to [vercel.com](https://vercel.com) and sign up with GitHub.
3.  **Import Project**:
    *   Click "Add New..." -> "Project".
    *   Select your `Logging Analyzer Tool` repository.
4.  **Configure Environment Variables**:
    *   In the "Environment Variables" section, add:
        *   `GEMINI_API_KEY`: Your Google Gemini API Key.
    *   *(Optional - for AWS Lambda Backend)*:
        *   `AWS_ACCESS_KEY_ID`: Your AWS Access Key.
        *   `AWS_SECRET_ACCESS_KEY`: Your AWS Secret Key.
        *   `AWS_REGION`: e.g., `us-east-1`.
        *   `AWS_LAMBDA_FUNCTION_NAME`: The name of your deployed Lambda.
5.  **Deploy**: Click "Deploy". Vercel will build your site and give you a live URL.

## Option 2: AWS Amplify (Good for AWS ecosystem)

1.  Log in to the AWS Console.
2.  Go to **AWS Amplify**.
3.  Click "Create new app" -> "Host web app".
4.  Connect your GitHub repository.
5.  In build settings, Amplify usually auto-detects Next.js.
6.  Add the environment variables under "Advanced settings".
7.  Deploy.

## Note on "Serverless Backend"
If you configured the `AWS_LAMBDA_FUNCTION_NAME` variable in Vercel/Amplify, your deployed website will automatically use your AWS Lambda function for analysis, fulfilling your resume claim of a "Serverless backend on AWS Lambda" while hosting the UI on a CDN.
