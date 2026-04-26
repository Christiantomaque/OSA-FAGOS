import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Admin for Sweeper (using service role if available, or anon if RLS allows)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sweepActiveRecords() {
  const now = new Date();
  
  // 1. Fetch all currently active sessions
  const { data: activeRecords, error } = await supabase
    .from('service_records')
    .select('*')
    .eq('status', 'active');

  if (error || !activeRecords || activeRecords.length === 0) return [];

  const results = [];
  for (const r of activeRecords) {
    if (!r.scheduled_end_time && !r.scheduledEndTime) continue;
    
    // Handle both naming styles just in case
    const schEnd = r.scheduledEndTime || r.scheduled_end_time;
    const schStart = r.scheduledStartTime || r.scheduled_start_time || r.timeIn;
    
    let endTarget = new Date(schEnd);
    const startTarget = new Date(schStart);
    
    // Correct endTarget date if it rollover to next day (e.g. 10pm to 2am)
    if (endTarget.getTime() <= startTarget.getTime()) {
      endTarget.setDate(endTarget.getDate() + 1);
    }

    // Determine if session has expired (using 1 min grace period)
    if (now.getTime() > endTarget.getTime() + 60000) {
      try {
        let deltaSeconds = 0;
        if (r.startTime) {
          const startTime = new Date(r.startTime);
          // Boundary is the scheduled end time, not current time
          deltaSeconds = Math.floor((endTarget.getTime() - startTime.getTime()) / 1000);
        }
        
        const newAccumulated = Math.max(0, (r.accumulated_seconds || 0) + deltaSeconds);
        const durationHours = newAccumulated / 3600;
        const creditHours = Math.max(0, Math.min(20, Number(durationHours.toFixed(1))));

        const updatePayload = {
          timeOut: endTarget.toISOString(),
          creditHours: creditHours,
          accumulated_seconds: newAccumulated,
          startTime: null,
          status: 'auto_stopped',
          updatedAt: new Date().toISOString()
        };

        await supabase.from('service_records').update(updatePayload).eq('id', r.id);
        results.push({ id: r.id, studentName: r.studentName });
        console.log(`[Sweeper] Auto-stopped expired session for ${r.studentName}`);
      } catch (e) {
        console.error(`[Sweeper] Failed to stop record ${r.id}`, e);
      }
    }
  }
  return results;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Piggyback Route: Sweeps records before returning them
  app.get('/api/service-records', async (req: Request, res: Response) => {
    try {
      // 1. Run the Lazy Sweeper
      await sweepActiveRecords();
      
      // 2. Fetch fresh records
      const { data, error } = await supabase
        .from('service_records')
        .select('*')
        .order('createdAt', { ascending: false });
        
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch records', details: error.message });
    }
  });

  // Safety Net Trigger: Sweeps records before generating a report
  app.post('/api/generate-pdf', async (req: Request, res: Response) => {
    try {
      console.log("[Safety Net] Triggering on-demand sweep before report generation...");
      await sweepActiveRecords();
      res.json({ success: true, message: 'Data synchronized' });
    } catch (error: any) {
      res.status(500).json({ error: 'Sync failed', details: error.message });
    }
  });

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
