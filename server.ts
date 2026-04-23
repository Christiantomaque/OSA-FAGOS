import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for sending the completion form
  app.post('/api/send-completion-form', async (req: Request, res: Response) => {
    const { email, studentName, pdfBase64 } = req.body;

    if (!email || !pdfBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // Setup transporter using environment variables
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: `"Office of Student Affairs" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Service Obligation Completion Form - Colegio de Muntinlupa',
        text: `Dear ${studentName},\n\nCongratulations on completing your 20-hour service obligation. Attached is your digital completion form.\n\nBest regards,\nOffice of Student Affairs`,
        attachments: [
          {
            filename: `Service_Obligation_Completion_${studentName.replace(/\s+/g, '_')}.pdf`,
            content: pdfBase64.split('base64,')[1],
            encoding: 'base64',
          },
        ],
      };

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('SMTP credentials not configured. Email not sent.');
        return res.status(200).json({ 
          success: true, 
          message: 'Email logic configured, but SMTP credentials missing. PDF would have been sent to ' + email 
        });
      }

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error: any) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
