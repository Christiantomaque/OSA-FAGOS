const fs = require('fs');

const files = ['src/pages/Staff.tsx', 'src/pages/Admin.tsx', 'src/pages/StudentAssistant.tsx'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix Interface
  content = content.replace(
    /staffName\?: string;\s*creditHours: number;\s*status: 'pending' \| 'verified' \| 'active';/,
    "staffName?: string;\n  creditHours: number;\n  earnedHours?: number;\n  status: 'pending' | 'verified' | 'active';"
  );

  // Fix totalHours logic in Admin.tsx only
  if (file.includes('Admin.tsx')) {
    content = content.replace(/acc\[r\.studentNo\]\.totalHours \+= r\.creditHours;/g, "acc[r.studentNo].totalHours += r.earnedHours || 0;");
    content = content.replace(/acc\[r\.studentNo\]\.verifiedHours \+= r\.creditHours;/g, "acc[r.studentNo].verifiedHours += r.earnedHours || 0;");
  }

  // Replace handleStartSession
  const startSessionRegex = /const handleStartSession = async \(record: ServiceRecord\) => \{[\s\S]*?showAlert\("Success", "Session started\.", "success"\);\n\s*\} catch \(e: any\) \{/m;
  const startSessionNew = `const handleStartSession = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const timeString = \`\${String(hours).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')} \${ampm}\`;
      
      const payload: any = {
        startTime: now.toISOString(),
        status: 'active',
        updatedAt: serverTimestamp()
      };

      if (!record.earnedHours && !record.timeIn?.includes(':')) {
         payload.timeIn = timeString;
      } else if (!record.timeIn) {
         payload.timeIn = timeString;
      }

      await updateDoc(doc(db, 'service_records', record.id), payload);
      // Result handled by onSnapshot
      showAlert("Success", "Session started.", "success");
    } catch (e: any) {`;
  content = content.replace(startSessionRegex, startSessionNew);

  // Replace handleClockOut
  const clockOutRegex = /const handleClockOut = async \(record: ServiceRecord\) => \{[\s\S]*?showAlert\("Success", "Clocked out successfully\.", "success"\);\n\s*\} catch \(e: any\) \{/m;
  const clockOutNew = `const handleClockOut = async (record: ServiceRecord) => {
    try {
      const now = new Date();
      let currentSegmentStart = new Date(record.startTime || record.timeIn);
      if (isNaN(currentSegmentStart.getTime())) {
          const baseDate = new Date(record.date || now);
          const tInStr = record.timeIn;
          if (tInStr) {
             const isPM = tInStr.toLowerCase().includes('pm');
             const isAM = tInStr.toLowerCase().includes('am');
             let [hoursStr, minutesStr] = tInStr.replace(/am|pm/i, '').trim().split(':');
             let hours = parseInt(hoursStr, 10);
             const minutes = parseInt(minutesStr, 10);
             if (isPM && hours < 12) hours += 12;
             if (isAM && hours === 12) hours = 0;
             currentSegmentStart = new Date(baseDate);
             currentSegmentStart.setHours(hours, minutes, 0, 0);
          } else {
             throw new Error("Invalid start time.");
          }
      }
      
      const baseDate = new Date(record.date || now);
      let endTimeToUse = now;
      let isForcedEnd = false;
      
      if (record.scheduledEndTime) {
         const schEndStr = record.scheduledEndTime;
         const isPM = schEndStr.toLowerCase().includes('pm');
         const isAM = schEndStr.toLowerCase().includes('am');
         let [hoursStr, minutesStr] = schEndStr.replace(/am|pm/i, '').trim().split(':');
         let hours = parseInt(hoursStr, 10);
         const minutes = parseInt(minutesStr, 10);
         if (isPM && hours < 12) hours += 12;
         if (isAM && hours === 12) hours = 0;
         
         const schEndObj = new Date(baseDate);
         schEndObj.setHours(hours, minutes, 0, 0);
         
         if (record.scheduledStartTime) {
             const schStartStr = record.scheduledStartTime;
             const sIsPM = schStartStr.toLowerCase().includes('pm');
             let [sHoursStr] = schStartStr.replace(/am|pm/i, '').trim().split(':');
             let sHours = parseInt(sHoursStr, 10);
             if (sIsPM && sHours < 12) sHours += 12;
             if (hours < sHours) {
                 schEndObj.setDate(schEndObj.getDate() + 1);
             }
         }
         
         if (now.getTime() >= schEndObj.getTime()) {
             endTimeToUse = schEndObj;
             isForcedEnd = true;
         }
      }
      
      let durationHours = (endTimeToUse.getTime() - currentSegmentStart.getTime()) / (1000 * 60 * 60);
      if (durationHours < 0) durationHours = 0;
      
      const previousEarned = record.earnedHours || 0;
      const totalEarned = previousEarned + durationHours;
      const displayHours = Math.max(0, Math.min(record.creditHours, Number(totalEarned.toFixed(2))));
      
      const finalTime = isForcedEnd ? endTimeToUse : now;
      let hoursF = finalTime.getHours();
      const ampmF = hoursF >= 12 ? 'PM' : 'AM';
      hoursF = hoursF % 12;
      hoursF = hoursF ? hoursF : 12; 
      const timeString = \`\${String(hoursF).padStart(2, '0')}:\${String(finalTime.getMinutes()).padStart(2, '0')} \${ampmF}\`;
      
      await updateDoc(doc(db, 'service_records', record.id), {
        timeOut: timeString,
        earnedHours: displayHours,
        status: 'pending',
        updatedAt: serverTimestamp()
      });
      showAlert("Success", "Clocked out successfully.", "success");
    } catch (e: any) {`;
  content = content.replace(clockOutRegex, clockOutNew);

  content = content.replace(/<td className="px-6 py-4 text-center font-bold text-\[\#3ecf8e\] text-lg">\{r\.creditHours\}h<\/td>/g, 
    `<td className="px-6 py-4 text-center font-bold text-[#3ecf8e] text-lg">\n                              {r.earnedHours !== undefined ? r.earnedHours : 0}h <span className="text-sm font-normal text-[#a1a1a1]">/ {r.creditHours}h</span>\n                           </td>`
  );

  content = content.replace(/<div className="font-bold text-\[\#3ecf8e\] text-xl">\{r\.creditHours\}h<\/div>/g,
    `<div className="font-bold text-[#3ecf8e] text-xl">\n                            {r.earnedHours !== undefined ? r.earnedHours : 0}h <span className="text-sm font-normal text-[#a1a1a1]">/ {r.creditHours}h</span>\n                          </div>`
  );

  content = content.replace(/\{r\.creditHours >= 20 \? 'Completed' : \(r\.status === 'pending' \? \(\(r as any\)\.accumulatedHours > 0 \? 'Continue' : 'Start(?: Now)?'\) : 'Stop(?: Time)?'\)\}/g,
    `{(r.earnedHours !== undefined && r.earnedHours >= r.creditHours) ? 'Completed' : (r.status === 'pending' ? ((r.earnedHours && r.earnedHours > 0) ? 'Continue' : 'Start Now') : 'Stop Time')}`
  );
  
  content = content.replace(/r\.creditHours >= 20/g, "(r.earnedHours !== undefined && r.earnedHours >= r.creditHours)");

  // Let's add the useEffect for Auto Clock Out
  if (!content.includes('// Auto clock-out if past scheduled end time')) {
      const autoClockOutStr = `  // Auto clock-out if past scheduled end time
  useEffect(() => {
    const interval = setInterval(() => {
      records.forEach(r => {
        if (r.status === 'active' && r.scheduledEndTime) {
           const now = new Date();
           const baseDate = new Date(r.date || now);
           const schEndStr = r.scheduledEndTime;
           const isPM = schEndStr.toLowerCase().includes('pm');
           const isAM = schEndStr.toLowerCase().includes('am');
           let [hoursStr, minutesStr] = schEndStr.replace(/am|pm/i, '').trim().split(':');
           let hours = parseInt(hoursStr, 10);
           const minutes = parseInt(minutesStr, 10);
           if (isPM && hours < 12) hours += 12;
           if (isAM && hours === 12) hours = 0;
           
           const schEndObj = new Date(baseDate);
           schEndObj.setHours(hours, minutes, 0, 0);
           
           if (r.scheduledStartTime) {
             const schStartStr = r.scheduledStartTime;
             const sIsPM = schStartStr.toLowerCase().includes('pm');
             let [sHoursStr] = schStartStr.replace(/am|pm/i, '').trim().split(':');
             let sHours = parseInt(sHoursStr, 10);
             if (sIsPM && sHours < 12) sHours += 12;
             if (hours < sHours) schEndObj.setDate(schEndObj.getDate() + 1);
           }
           
           if (now.getTime() >= schEndObj.getTime()) {
             handleClockOut(r);
           }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [records]);
`;
      // Find where to insert it. Just before `const handleRefresh = ...` or similar.
      // Easiest is just after checking limits or handleStartSession.
      // Let's insert it before `const handleStartSession =`
      content = content.replace('const handleStartSession =', autoClockOutStr + '\n  const handleStartSession =');
  }

  fs.writeFileSync(file, content, 'utf8');
}
console.log("Files updated successfully");
