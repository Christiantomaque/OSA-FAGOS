import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Copy, Check, X } from 'lucide-react';

export const SupabaseSetupModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  const sqlInstructions = `-- Run this in your Supabase SQL Editor to initialize the database:

CREATE TABLE IF NOT EXISTS admins (
  id text primary key,
  email text,
  "displayName" text,
  role text,
  "photoURL" text,
  signature text,
  is_online boolean,
  "lastLogin" text
);

CREATE TABLE IF NOT EXISTS tasks (
  id text primary key,
  title text,
  description text,
  date text,
  capacity numeric,
  duration numeric,
  "inCharge" text
);

CREATE TABLE IF NOT EXISTS service_records (
  id text primary key,
  "studentNo" text,
  "studentName" text,
  "studentEmail" text,
  program text,
  section text,
  bracket text,
  "taskTitle" text,
  date text,
  hours numeric,
  status text,
  "timeIn" text,
  "timeOut" text,
  "verificationPhoto" text
);

CREATE TABLE IF NOT EXISTS completion_approvals (
  id text primary key,
  "studentNo" text,
  "approverName" text,
  "approverRole" text,
  "approverSignature" text,
  "approvedAt" text
);

CREATE TABLE IF NOT EXISTS settings (
  id text primary key,
  "allowSignups" boolean
);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlInstructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-[#171717] border border-[#3ecf8e] rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
          >
            <div className="p-6 border-b border-[#2e2e2e] flex justify-between items-center bg-[#1a1a1a]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#3ecf8e]/10 rounded-lg">
                  <Database className="w-5 h-5 text-[#3ecf8e]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#ededed] tracking-tight">Database Tables Missing</h3>
                  <p className="text-xs text-[#a1a1a1]">You need to initialize your Supabase tables to proceed.</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#2e2e2e] rounded-lg transition-colors text-[#a1a1a1]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-[#121212]">
              <p className="text-sm text-[#ededed] mb-4 leading-relaxed">
                It looks like your Supabase database doesn't have the required tables yet. 
                Please copy the SQL below and run it in your <strong>Supabase Dashboard &rarr; SQL Editor</strong>.
              </p>
              
              <div className="relative group">
                <button 
                  onClick={copyToClipboard}
                  className="absolute top-3 right-3 p-2 bg-[#2e2e2e] hover:bg-[#3e3e3e] rounded-lg transition-colors flex items-center gap-2 text-xs font-bold text-[#ededed]"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#3ecf8e]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "COPIED" : "COPY SQL"}
                </button>
                <pre className="bg-[#0a0a0a] text-[#3ecf8e] font-mono text-xs p-5 rounded-xl border border-[#2e2e2e] overflow-x-auto whitespace-pre-wrap">
                  {sqlInstructions}
                </pre>
              </div>
            </div>
            
            <div className="p-4 border-t border-[#2e2e2e] bg-[#1a1a1a] flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[#3ecf8e] hover:bg-[#34b27b] text-black text-sm font-bold rounded-xl transition-all active:scale-95"
              >
                I've run the script
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
