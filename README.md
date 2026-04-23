# Colegio de Muntinlupa - OSA Service System

This project is fully ready for local development in Visual Studio Code and production deployment to Vercel.

## 🚀 1. Opening in Visual Studio Code

1. Click the **Settings icon (⚙️)** in the top right corner of the AI Studio editor.
2. Select **Export as ZIP**.
3. Extract the downloaded folder to your computer.
4. Open the extracted folder in **Visual Studio Code**.

## 💻 2. Local Setup

Open your VS Code terminal (\`Ctrl + \`\`) and install the dependencies:
\`\`\`bash
npm install
\`\`\`

Create an environment file:
1. Create a file named `.env.local` in the root folder.
2. Add your database and email keys:
\`\`\`env
VITE_SUPABASE_URL=https://dbxsyatqfekjrdcuthox.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
\`\`\`

Start the local development server:
\`\`\`bash
npm run dev
\`\`\`
Your app will be running at \`http://localhost:3000\`.

## 🌍 3. Deploying to Vercel

1. Push your folder to a **GitHub repository**.
2. Go to [Vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, paste all your keys from `.env.local`.
5. Click **Deploy**.

*Note: Vercel automatically detects the \`/api\` folder to handle your email submission endpoint effortlessly using Vercel Serverless Functions.*
