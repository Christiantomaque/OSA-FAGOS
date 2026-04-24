export const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  } catch (e) {
    return dateString;
  }
};

export const calculateDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return 0;
  
  const start = getHHMM(startTime);
  const end = getHHMM(endTime);
  
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  let durationHours = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
  if (durationHours < 0) durationHours += 24;
  return Number(durationHours.toFixed(2));
};

export const getHHMM = (timeString: string) => {
  if (!timeString) return '';
  if (timeString.includes('T')) {
    const d = new Date(timeString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return timeString;
};

export const formatTime = (timeString: string) => {
  if (!timeString) return 'N/A';
  try {
    const hhmm = getHHMM(timeString);
    const [hours, minutes] = hhmm.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    const mStr = minutes.toString().padStart(2, '0');
    return `${h12}:${mStr} ${period}`;
  } catch (e) {
    return timeString;
  }
};

export const getTodayYYYYMMDD = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
