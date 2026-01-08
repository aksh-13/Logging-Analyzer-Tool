# LogInsight AI - Technical Log Humanizer

A high-performance log analysis dashboard that uses Google Gemini AI to transform technical system logs into human-readable insights.

## Features

- **CSV Log Parsing**: Handles Windows Structured Log format with automatic parsing
- **Smart Grouping**: Groups logs by Component and Content Fingerprint to identify patterns
- **Top 100 Analysis**: Automatically selects the most frequent and critical issues
- **AI-Powered Insights**: Uses Google Gemini 1.5 Flash to generate:
  - Plain English summaries
  - Business/System impact assessments
  - Recommended fixes
- **HeroUI Components**: Modern, clean dashboard with accordion-based insights display

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v3.4.19
- **UI Library**: HeroUI (formerly NextUI)
- **AI**: Google Generative AI SDK (@google/generative-ai) with Gemini 1.5 Flash
- **CSV Parsing**: PapaParse

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Environment Variable**:
   Create a `.env.local` file in the root directory:
   ```
   GEMINI_API_KEY=your_google_gemini_api_key_here
   ```
   
   Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Open Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## AWS Lambda Deployment (Optional)

To enable the serverless backend:

1.  **Deploy the Lambda**:
    *   Navigate to the `lambda/` directory.
    *   Run `npm install`.
    *   Zip the contents (`index.mjs`, `package.json`, `node_modules`).
    *   Create an AWS Lambda function (Node.js 18.x/20.x).
    *   Upload the zip file.
    *   Set the Request Timeout to 30 seconds.

2.  **Configure App**:
    Add these to your `.env.local`:
    ```env
    AWS_REGION=us-east-1
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    AWS_LAMBDA_FUNCTION_NAME=your_function_name
    ```

    *If these are missing, the app defaults to local processing.*

## CSV Format

The application expects CSV files with the following columns:
- `LineId`: Unique identifier
- `Time`: Timestamp
- `Component`: System/service source (e.g., DnsApi, Workstation)
- `Level`: Severity (Info, Warning, Error)
- `Content`: Raw technical message

## How It Works

1. **Upload**: User uploads a CSV file via drag-and-drop
2. **Parse**: CSV is parsed client-side using PapaParse
3. **Group**: Logs are grouped by Component and Content Fingerprint
4. **Select**: Top 100 most frequent/critical issues are selected
5. **Analyze**: Selected issues are sent to Gemini AI for human-readable analysis
6. **Display**: Results are shown in an expandable table with original technical content

## Project Structure

```
├── app/
│   ├── actions/
│   │   └── analyze.ts          # Server action for Gemini AI integration
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout with Ant Design provider
│   └── page.tsx                # Main dashboard page
├── types/
│   └── log.ts                  # TypeScript interfaces
├── utils/
│   └── csvParser.ts            # CSV parsing and log grouping logic
└── package.json
```

## License

MIT

