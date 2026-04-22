import { useState, useMemo, useEffect } from 'react'
import { createEvents, EventAttributes } from 'ics'
import { saveAs } from 'file-saver'
import { Trash2, Settings2, Pencil, Calendar, Sun, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

interface TimeSlot { id: number; start: string; end: string; }
interface Course { id: string; name: string; instructor: string; location: string; type: 'weekly' | 'odd' | 'even' | 'custom'; weeks: number[]; }

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('isDarkMode');
    return saved ? JSON.parse(saved) : true;
  });

  const [totalWeeksValue, setTotalWeeksValue] = useState(() => {
    const saved = localStorage.getItem('totalWeeksValue');
    const val = saved ? JSON.parse(saved) : 15;
    return Math.max(1, typeof val === 'number' ? val : 15);
  });

  const [showWeekends, setShowWeekends] = useState(() => {
    const saved = localStorage.getItem('showWeekends');
    return saved ? JSON.parse(saved) : true;
  });

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(() => {
    const saved = localStorage.getItem('timeSlots');
    return saved ? JSON.parse(saved) : [
      { id: 1, start: '08:00', end: '09:00' },
      { id: 2, start: '09:00', end: '10:00' },
      { id: 3, start: '10:00', end: '11:00' },
      { id: 4, start: '11:00', end: '12:00' },
    ];
  });

  const [courses, setCourses] = useState<Record<string, Course[]>>(() => {
    const saved = localStorage.getItem('courses');
    return saved ? JSON.parse(saved) : {};
  });

  const [termStartDate, setTermStartDate] = useState(() => {
    const saved = localStorage.getItem('termStartDate');
    return saved || new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    localStorage.setItem('totalWeeksValue', JSON.stringify(totalWeeksValue));
    localStorage.setItem('showWeekends', JSON.stringify(showWeekends));
    localStorage.setItem('timeSlots', JSON.stringify(timeSlots));
    localStorage.setItem('courses', JSON.stringify(courses));
    localStorage.setItem('termStartDate', termStartDate);
  }, [isDarkMode, totalWeeksValue, showWeekends, timeSlots, courses, termStartDate]);

  const [activeCell, setActiveCell] = useState<{day: string, slotId: number} | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const days = useMemo(() => 
    showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    [showWeekends]
  );

  const handleAddCourse = () => {
    setEditingCourse({
      id: Math.random().toString(36).substr(2, 9),
      name: '', instructor: '', location: '', type: 'weekly',
      weeks: Array.from({length: totalWeeksValue}, (_, i) => i + 1)
    });
  };

  const handleEditCourse = (course: Course) => setEditingCourse({ ...course });

  const handleSaveCourse = () => {
    if (activeCell && editingCourse) {
      const key = `${activeCell.day}-${activeCell.slotId}`;
      const cellCourses = courses[key] || [];
      const exists = cellCourses.find(c => c.id === editingCourse.id);
      const newCellCourses = exists 
        ? cellCourses.map(c => c.id === editingCourse.id ? editingCourse : c)
        : [...cellCourses, editingCourse];
      setCourses({ ...courses, [key]: newCellCourses });
      setEditingCourse(null);
    }
  };

  const setWeekType = (type: Course['type']) => {
    if (!editingCourse) return;
    let newWeeks: number[] = [];
    if (type === 'weekly') newWeeks = Array.from({length: totalWeeksValue}, (_, i) => i + 1);
    else if (type === 'odd') newWeeks = Array.from({length: totalWeeksValue}, (_, i) => i + 1).filter(w => w % 2 !== 0);
    else if (type === 'even') newWeeks = Array.from({length: totalWeeksValue}, (_, i) => i + 1).filter(w => w % 2 === 0);
    else newWeeks = [];
    setEditingCourse({ ...editingCourse, type, weeks: newWeeks });
  };

  const toggleWeek = (week: number) => {
    if (!editingCourse) return;
    const newWeeks = editingCourse.weeks.includes(week)
      ? editingCourse.weeks.filter(w => w !== week)
      : [...editingCourse.weeks, week].sort((a, b) => a - b);
    setEditingCourse({ ...editingCourse, weeks: newWeeks, type: 'custom' });
  };

  const addNewTimeSlot = () => {
    const lastSlot = timeSlots[timeSlots.length - 1];
    const newStart = lastSlot ? lastSlot.end : "08:00";
    const [h, m] = newStart.split(':').map(Number);
    const newEnd = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setTimeSlots([...timeSlots, { id: Date.now(), start: newStart, end: newEnd }]);
  };

  const exportICS = () => {
    const events: EventAttributes[] = [];
    const baseDate = new Date(termStartDate);
    Object.keys(courses).forEach(key => {
      const [dayStr, slotId] = key.split('-');
      const slot = timeSlots.find(s => s.id === Number(slotId));
      if (!slot) return;
      const dayOffset = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(dayStr);
      courses[key].forEach(course => {
        course.weeks.forEach(weekNum => {
          const eventDate = new Date(baseDate);
          eventDate.setDate(baseDate.getDate() + ((weekNum - 1) * 7) + dayOffset);
          events.push({
            start: [eventDate.getFullYear(), eventDate.getMonth() + 1, eventDate.getDate(), ...slot.start.split(':').map(Number)] as [number, number, number, number, number],
            end: [eventDate.getFullYear(), eventDate.getMonth() + 1, eventDate.getDate(), ...slot.end.split(':').map(Number)] as [number, number, number, number, number],
            title: course.name, location: course.location, description: `Instructor: ${course.instructor}`,
          });
        });
      });
    });
    if (events.length === 0) return alert("No courses!");
    createEvents(events, (err, val) => {
      if (!err) saveAs(new Blob([val], {type: 'text/calendar'}), 'Schedule.ics');
    });
  };

  return (
    <div className={`h-screen flex flex-col transition-all duration-300 font-sans ${isDarkMode ? 'dark bg-black text-white' : 'bg-white text-black'}`}>
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3 border-b border-zinc-500/10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black uppercase tracking-tighter">ICS Studio</h1>
          <div className="flex flex-col">
            <span className="text-zinc-500 font-black text-[8px] uppercase tracking-widest ml-1 mb-1">ICS Start Date</span>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black ${isDarkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'}`}>
               <Calendar size={12} className="text-zinc-500" />
               <input type="date" value={termStartDate} onChange={e => setTermStartDate(e.target.value)} className="bg-transparent outline-none uppercase cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsDarkMode(!isDarkMode)} className="h-8 w-8 rounded-full"><Sun size={16} /></Button>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" className="h-8 px-4 rounded-full font-black uppercase text-[10px] tracking-widest"><Settings2 size={14} className="mr-2" /> Logic</Button>} />
            <DialogContent showCloseButton={false} className={`rounded-[2.5rem] max-w-md w-[90vw] p-8 border-none shadow-2xl ${isDarkMode ? 'bg-zinc-900 text-white' : 'bg-white text-black'} max-h-[90vh] overflow-y-auto custom-scrollbar`}>
              <div className="flex flex-col gap-10">
                <div className="space-y-6">
                   <h2 className="text-3xl font-black uppercase tracking-tight">Setup</h2>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Total Weeks</Label>
                        <span className="text-3xl font-black">{totalWeeksValue}</span>
                      </div>
                      <div className="relative w-full h-6 flex items-center">
                        <div className="absolute w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                        <div className="absolute h-1 bg-black dark:bg-white rounded-full" style={{ width: `${(totalWeeksValue / 25) * 100}%` }} />
                        <input type="range" min="1" max="25" value={totalWeeksValue} onChange={(e) => setTotalWeeksValue(Number(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className="absolute size-6 bg-white dark:bg-black border-[3px] border-black dark:border-white rounded-full pointer-events-none shadow-lg" style={{ left: `calc(${(totalWeeksValue / 25) * 100}% - 12px)` }} />
                      </div>
                   </div>
                   <div className="flex items-center justify-between py-4 border-y border-zinc-500/10">
                      <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Show Weekends</Label>
                      <button onClick={() => setShowWeekends(!showWeekends)} className={`relative w-12 h-6 rounded-full transition-colors ${showWeekends ? 'bg-black dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                        <div className={`absolute top-1 size-4 bg-white dark:bg-black rounded-full shadow transition-transform ${showWeekends ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest">Timeline</Label>
                      <Button variant="ghost" size="icon" onClick={addNewTimeSlot} className="h-8 w-8 rounded-full bg-zinc-500/10"><Plus size={16} /></Button>
                   </div>
                   <div className="space-y-2">
                      {timeSlots.map((slot, idx) => (
                        <div key={slot.id} className="flex items-center gap-3">
                          <span className="text-zinc-500 font-black text-xs w-4">{idx+1}</span>
                          <div className={`flex border rounded-xl px-4 py-3 gap-3 flex-1 ${isDarkMode ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                            <input type="time" value={slot.start} className="bg-transparent outline-none text-xs w-full font-black" onChange={e => {
                              const s = [...timeSlots]; s[idx].start = e.target.value; setTimeSlots(s);
                            }} />
                            <span className="opacity-20 font-black text-zinc-500">/</span>
                            <input type="time" value={slot.end} className="bg-transparent outline-none text-xs w-full font-black" onChange={e => {
                              const s = [...timeSlots]; s[idx].end = e.target.value; setTimeSlots(s);
                            }} />
                          </div>
                          <button onClick={() => setTimeSlots(timeSlots.filter(t => t.id !== slot.id))} className="text-zinc-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                      ))}
                   </div>
                </div>
                <Button onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))} className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-zinc-500/10 text-zinc-500">Close Panel</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={exportICS} className={`h-8 px-5 rounded-full font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>Export</Button>
        </div>
      </header>

      {/* Main Grid Area */}
      <main className="flex-1 overflow-auto p-4 custom-scrollbar">
        <div className={`max-w-[1400px] mx-auto rounded-[2.5rem] border shadow-xl overflow-hidden ${isDarkMode ? 'bg-zinc-950 border-zinc-900' : 'bg-white border-zinc-100'}`}>
          <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
            <div className="border-b border-r border-zinc-500/10 bg-zinc-500/5" />
            {days.map(d => <div key={d} className="text-center font-black text-zinc-500 text-[9px] tracking-[0.3em] uppercase py-4 border-b border-zinc-500/10">{d}</div>)}
            {timeSlots.map((slot, idx) => (
              <div key={slot.id} className="contents">
                <div className="flex flex-col items-center justify-center py-6 border-r border-b border-zinc-500/10 bg-zinc-500/5">
                  <span className="font-black text-3xl leading-none tracking-tighter">{idx + 1}</span>
                  <span className="text-[9px] text-zinc-500 font-black mt-1 tabular-nums">{slot.start}</span>
                </div>
                {days.map(day => {
                  const cellKey = `${day}-${slot.id}`;
                  const cellCourses = courses[cellKey] || [];
                  return (
                    <div key={cellKey} onClick={() => setActiveCell({day, slotId: slot.id})} className={`min-h-[120px] border-b border-r border-zinc-500/10 p-2.5 flex flex-col gap-2 transition-all cursor-pointer group last:border-r-0 ${isDarkMode ? 'hover:bg-zinc-900/40' : 'hover:bg-zinc-50'}`}>
                      {cellCourses.length > 0 ? (
                        cellCourses.map(course => (
                          <div key={course.id} className={`p-3 rounded-2xl flex flex-col justify-center items-center h-full min-h-[50px] shadow-lg ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>
                            <span className="text-[11px] font-black leading-tight text-center uppercase truncate w-full tracking-tight">{course.name}</span>
                            <div className="flex flex-col items-center mt-1">
                              {course.instructor && <span className="text-[7px] font-black opacity-40 uppercase truncate">Prof. {course.instructor}</span>}
                              {course.location && <span className="text-[7px] font-black opacity-40 uppercase truncate">@{course.location}</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-10"><Plus size={32} strokeWidth={1} /></div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Course Detail Dialog (Fully Vertical) */}
      <Dialog open={!!editingCourse} onOpenChange={o => !o && setEditingCourse(null)}>
        <DialogContent showCloseButton={false} className={`rounded-[3rem] max-w-sm w-[90vw] p-10 border-none shadow-2xl ${isDarkMode ? 'bg-zinc-900 text-white' : 'bg-white text-black'} max-h-[90vh] overflow-y-auto custom-scrollbar`}>
          <div className="flex flex-col gap-8">
            <h2 className="text-3xl font-black uppercase tracking-tight">Details</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest ml-1">Course Name</Label>
                <Input value={editingCourse?.name} onChange={e => setEditingCourse(p => p ? {...p, name: e.target.value} : null)} className={`h-14 rounded-2xl text-sm font-black border-2 px-5 ${isDarkMode ? 'bg-black border-zinc-800 focus:border-white' : 'bg-zinc-50 border-zinc-100 focus:border-black'}`} placeholder="e.g. VISUAL ARTS" />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest ml-1">Location</Label>
                <Input value={editingCourse?.location} onChange={e => setEditingCourse(p => p ? {...p, location: e.target.value} : null)} className={`h-14 rounded-2xl text-sm font-black border-2 px-5 ${isDarkMode ? 'bg-black border-zinc-800 focus:border-white' : 'bg-zinc-50 border-zinc-100 focus:border-black'}`} placeholder="Room 101" />
              </div>
              <div className="space-y-1">
                <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest ml-1">Instructor</Label>
                <Input value={editingCourse?.instructor} onChange={e => setEditingCourse(p => p ? {...p, instructor: e.target.value} : null)} className={`h-14 rounded-2xl text-sm font-black border-2 px-5 ${isDarkMode ? 'bg-black border-zinc-800 focus:border-white' : 'bg-zinc-50 border-zinc-100 focus:border-black'}`} placeholder="e.g. Dr. Smith" />
              </div>
              <div className="space-y-3">
                <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest ml-1">Repeat Cycle</Label>
                <div className="flex flex-wrap gap-2">
                  {['weekly', 'odd', 'even', 'custom'].map(t => (
                    <button key={t} onClick={() => setWeekType(t as any)} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase border-2 transition-all ${editingCourse?.type === t ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-zinc-500/20 text-zinc-400'}`}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className={`p-6 rounded-[2rem] border ${isDarkMode ? 'bg-black border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}>
              <Label className="text-zinc-500 font-black uppercase text-[10px] tracking-widest block mb-4 text-center">Select Weeks</Label>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({length: totalWeeksValue}, (_, i) => i + 1).map(w => (
                  <button key={w} onClick={() => toggleWeek(w)} className={`h-11 rounded-xl font-black text-xs transition-all ${editingCourse?.weeks.includes(w) ? (isDarkMode ? 'bg-white text-black' : 'bg-black text-white') : 'bg-zinc-500/5 text-zinc-400'}`}>{w}</button>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveCourse} className={`w-full h-16 rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>Save Course</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cell Courses List Dialog */}
      <Dialog open={!!activeCell && !editingCourse} onOpenChange={o => !o && setActiveCell(null)}>
        <DialogContent showCloseButton={false} className={`rounded-[2.5rem] max-w-sm w-[90vw] p-8 border-none shadow-2xl ${isDarkMode ? 'bg-zinc-900 text-white' : 'bg-white text-black'}`}>
          <h2 className="text-xl font-black uppercase mb-6 tracking-tight">Cell Courses</h2>
          <div className="space-y-3 mb-6">
            {activeCell && (courses[`${activeCell.day}-${activeCell.slotId}`] || []).map(course => (
              <div key={course.id} className={`flex items-center justify-between p-4 rounded-2xl border ${isDarkMode ? 'bg-black border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <span className="font-black text-sm uppercase truncate flex-1 mr-4">{course.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleEditCourse(course)} className="p-2 rounded-full hover:bg-zinc-500/10"><Pencil size={14} /></button>
                  <button onClick={() => {
                    const key = `${activeCell.day}-${activeCell.slotId}`;
                    setCourses({ ...courses, [key]: courses[key].filter(c => c.id !== course.id) });
                  }} className="p-2 rounded-full text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleAddCourse} className={`w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}><Plus size={16} className="mr-2" /> Add Course</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}