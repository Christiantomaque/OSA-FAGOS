import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// ENVIRONMENT CONFIGURATION LOADER
// ============================================================================
// Force load the exact environment file based on what exists in the directory.
// This ensures local development (npm run dev) picks up Vercel-specific .env files.
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('✅ Loaded environment variables from .env.local');
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Loaded environment variables from .env');
} else {
  console.warn('⚠️ No local environment files found. Relying on system/provider env vars.');
}

// ============================================================================
// API HANDLER
// ============================================================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Handling: Allow cross-origin requests if called from a different domain
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    return res.status(200).end();
  }

  // 2. Method Validation
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Please use POST.' });
  }

  // 3. Payload Extraction & Validation
  const { email, studentName, pdfBase64 } = req.body;

  if (!email || !pdfBase64 || !studentName) {
    console.error('Validation Error: Missing required fields in the request body.');
    return res.status(400).json({ success: false, error: 'Missing required fields: email, studentName, or pdfBase64.' });
  }

  try {
    // --- DEBUGGING LOGS ---
    console.log("----------------------------------------");
    console.log(`📧 Processing email request for: ${studentName} (${email})`);
    console.log("🔍 Checking SMTP Configuration...");
    console.log("HOST:", process.env.SMTP_HOST || "smtp.gmail.com (default)");
    console.log("PORT:", process.env.SMTP_PORT || "587 (default)");
    console.log("USER:", process.env.SMTP_USER ? "✅ Loaded!" : "❌ Missing!");
    console.log("PASS:", process.env.SMTP_PASS ? "✅ Loaded!" : "❌ Missing!");
    console.log("----------------------------------------");

    // Fail immediately if credentials are still missing
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('CRITICAL: SMTP credentials missing! Cannot send email.');
      return res.status(500).json({ 
        success: false, 
        error: 'Server email credentials are not configured. Please check your .env.local file or Vercel environment variables.' 
      });
    }

    // 4. Nodemailer Transport Configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 5. Construct Email Payload (Text + Professional HTML version)
    const mailOptions = {
      from: `"Office of Student Affairs" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Service Obligation Completion Form - Colegio de Muntinlupa',
      text: `Dear ${studentName},\n\nCongratulations on completing your 20-hour service obligation. Attached is your official digital completion form.\n\nPlease keep this document safe for your records.\n\nBest regards,\nOffice of Student Affairs\nColegio de Muntinlupa`,
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #3366cc; text-align: center; margin-bottom: 5px;">Colegio de Muntinlupa</h2>
          <h3 style="color: #333; text-align: center; margin-top: 0;">Office of Student Affairs</h3>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #555; font-size: 16px;">Dear <strong>${studentName}</strong>,</p>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            Congratulations on successfully completing your 20-hour service obligation. 
            Your official digital completion form has been approved and is attached to this email as a PDF.
          </p>
          <p style="color: #555; font-size: 16px; line-height: 1.5;">
            Please download and keep this document safe for your academic records.
          </p>
          <br/>
          <p style="color: #777; font-size: 14px;">
            Best regards,<br/>
            <strong>Office of Student Affairs</strong><br/>
            Colegio de Muntinlupa
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Service_Obligation_Completion_${studentName.replace(/\s+/g, '_')}.pdf`,
          content: pdfBase64.split('base64,')[1], // Strip the data URI prefix if present
          encoding: 'base64',
        },
      ],
    };

    // 6. Dispatch Email
    console.log(`🚀 Dispatching email to SMTP server...`);
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    
    return res.status(200).json({ 
        success: true, 
        message: 'Email sent successfully!',
        messageId: info.messageId 
    });

  } catch (error: any) {
    // 7. Comprehensive Error Handling
    // Catch specific Nodemailer/Google SMTP rejections (e.g., "Invalid Login", "Blocked")
    console.error('❌ Email Dispatch Failed!');
    console.error('Error Details:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: `SMTP/Email Error: ${error.message || 'Failed to process email request'}`,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
}