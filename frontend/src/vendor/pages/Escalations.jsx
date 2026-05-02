import React, { useState, useEffect } from 'react';
import { AlertTriangle, Eye, CheckCircle2, Phone, Tag, ChevronDown, ChevronUp, MessageSquare, User, ArrowUp, ArrowDown, Send, FileText, Bot, Clock, Calendar, Loader2 } from 'lucide-react';
import { getCallLogs, getStats, startOutboundCall } from '../../api';
import TranscriptModal from '../../components/TranscriptModal';
import Toast from '../../components/Toast';

const StatCard = ({ icon: Icon, value, label, iconColor, iconBgColor }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-center h-28 shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl ${iconBgColor} ${iconColor}`}>
         <Icon size={24} strokeWidth={2} />
      </div>
      <div>
         <div className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</div>
         <div className="text-sm font-semibold text-gray-400">{label}</div>
      </div>
    </div>
  </div>
);

const PillFilter = ({ label, options, active }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100">
       {options.map(opt => (
         <button 
           key={opt} 
           className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${active === opt ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
         >
           {opt}
         </button>
       ))}
    </div>
  </div>
);

const PriorityBadge = ({ priority }) => {
  const p = priority || 'Low';
  if (p === 'High') return <span className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-rose-600 border border-rose-100 bg-rose-50/30 rounded-full w-24 justify-center"><ArrowUp size={12}/> High</span>;
  if (p === 'Medium') return <span className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-amber-600 border border-amber-100 bg-amber-50/30 rounded-full w-24 justify-center"><ArrowUp size={12}/> Medium</span>;
  return <span className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-gray-400 border border-gray-100 bg-gray-50/30 rounded-full w-24 justify-center"><ArrowDown size={12}/> Low</span>;
};

const StatusBadge = ({ status }) => {
  const s = status || 'Open';
  let color = '';
  if (s === 'Open' || s === 'failed') color = 'bg-rose-500';
  if (s === 'In Review' || s === 'processing') color = 'bg-amber-400';
  if (s === 'Resolved' || s === 'completed') color = 'bg-emerald-500';
  
  return (
    <span className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-gray-700 bg-gray-50 border border-gray-100 rounded-full w-28 justify-center">
      <span className={`w-1.5 h-1.5 rounded-full ${color} shadow-sm animate-pulse`} /> {s}
    </span>
  );
};

const Escalations = () => {
  const [escalations, setEscalations] = useState([]);
  const [stats, setStats] = useState({ open: 0, review: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [callingId, setCallingId] = useState(null);
  const [toast, setToast] = useState(null);
  
  // Transcript Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    const loadEscalations = async () => {
      try {
        const [logData, statsData] = await Promise.all([
          getCallLogs(1, 'failed'),
          getStats()
        ]);
        setEscalations(logData.logs || []);
        
        // Map stats if available
        if (statsData?.analytics?.outcomes) {
           const open = statsData.analytics.outcomes.find(o => o.status === 'failed')?.count || 0;
           const resolved = statsData.analytics.outcomes.find(o => o.status === 'completed')?.count || 0;
           setStats({ open, review: 0, resolved });
        }
      } catch (err) {
        console.error('Failed to load escalations:', err);
      } finally {
        setLoading(false);
      }
    };
    loadEscalations();
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleStatusChange = (id, newStatus) => {
    setEscalations(escalations.map(esc => esc.id === id ? { ...esc, status: newStatus } : esc));
  };

  const handleAddNote = (id) => {
    if (!newNote.trim()) return;
    setEscalations(escalations.map(esc => {
      if (esc.id === id) {
        return {
          ...esc,
          notes: [...(esc.notes || []), { id: Date.now(), author: 'Dr. Meena Rajan', date: 'Just now', text: newNote }],
          messages: (esc.messages || 0) + 1
        };
      }
      return esc;
    }));
    setNewNote('');
  };

  const handleCallNow = async (id, phone) => {
    try {
      setCallingId(id);
      await startOutboundCall(phone);
      setToast({ message: `Outbound call triggered for ${phone}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to trigger outbound call: ' + err.message, type: 'error' });
    } finally {
      setCallingId(null);
    }
  };

  const openTranscript = (call) => {
    setSelectedCall(call);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Escalations</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Review and resolve calls that required human intervention</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-medium">
         <StatCard icon={AlertTriangle} value={stats.open} label="Open Issues" iconColor="text-rose-600" iconBgColor="bg-rose-50" />
         <StatCard icon={Eye} value={stats.review} label="In Review" iconColor="text-amber-600" iconBgColor="bg-amber-50" />
         <StatCard icon={CheckCircle2} value={stats.resolved} label="Resolved" iconColor="text-emerald-600" iconBgColor="bg-emerald-50" />
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4 flex items-center gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
         <PillFilter label="Status" options={['All', 'Open', 'In Review', 'Resolved']} active="All" />
         <div className="w-px h-6 bg-gray-100 shrink-0"></div>
         <PillFilter label="Priority" options={['All', 'High', 'Medium', 'Low']} active="All" />
         <div className="ml-auto text-xs font-bold text-gray-400 uppercase tracking-widest">{escalations.length} results</div>
      </div>

      <div className="space-y-4">
         {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-gray-400 tracking-widest uppercase">Fetching Escalations...</p>
            </div>
         ) : escalations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <div className="p-4 bg-emerald-50 text-emerald-500 rounded-2xl mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">All Clear!</h3>
                <p className="text-sm font-medium text-gray-500">No calls require human intervention at the moment.</p>
            </div>
         ) : (
          escalations.map(esc => (
            <React.Fragment key={esc.id}>
              <div 
                onClick={() => toggleExpand(esc.id)}
                className={`bg-white border shadow-sm rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all ${expandedId === esc.id ? 'border-gray-900 ring-4 ring-gray-900/5' : 'border-gray-200 hover:border-gray-300'}`}
              >
                 <div className="w-28 text-[11px] font-bold text-gray-400 font-mono tracking-tighter">#{esc.id}</div>
                 
                 <div className="flex-1">
                    <div className="flex items-center gap-6 mb-1.5">
                       <div className="flex items-center gap-2.5 font-bold text-gray-900 text-[14px]">
                          <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400 shadow-inner"><Phone size={12} fill="currentColor" /></div>
                          {esc.caller || esc.caller_phone}
                       </div>
                       <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                          <Tag size={12} className="text-gray-300" /> {esc.intent || esc.direction}
                       </div>
                    </div>
                    <div className="text-[11px] font-bold text-gray-400 ml-8 uppercase tracking-widest flex items-center gap-2">
                       <Calendar size={12} /> {esc.date} <span className="text-gray-200">|</span> <Clock size={12} /> {esc.duration}
                    </div>
                 </div>

                 <div className="flex items-center gap-8 pr-6">
                    <div className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5 w-20">
                       <span className="font-serif font-black text-gray-300 transform scale-125">文A</span> {esc.lang || 'English'}
                    </div>
                    <PriorityBadge priority={esc.priority} />
                    <StatusBadge status={esc.status} />
                    <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600 w-32 border-l border-gray-50 pl-6">
                       <User size={14} className="text-gray-300" /> {esc.assignee || 'Unassigned'}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 w-8">
                       <MessageSquare size={14} /> {esc.messages || 0}
                    </div>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         handleCallNow(esc.id, esc.caller || esc.caller_phone);
                       }}
                       disabled={callingId === esc.id}
                       className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors ml-4"
                     >
                       {callingId === esc.id ? (
                         <Loader2 size={12} className="animate-spin" />
                       ) : (
                         <Phone size={12} fill="currentColor" />
                       )}
                       Call Now
                     </button>
                 </div>

                <div className="text-gray-300 pl-4 border-l border-gray-100">
                   {expandedId === esc.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
             </div>

             {expandedId === esc.id && (
                <div className="bg-gray-50/30 rounded-3xl p-6 border border-gray-100 shadow-inner space-y-6 animate-in">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                         <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                            <FileText size={14} /> Transcript Summary
                         </div>
                         <p className="text-sm text-gray-700 leading-relaxed font-medium">
                            {esc.transcriptSummary || "No detailed summary available for this escalation."}
                         </p>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                         <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                            <Bot size={14} /> AI Decision Note
                         </div>
                         <p className="text-sm text-gray-700 leading-relaxed font-medium italic">
                            {esc.aiDecision || "Defaulting to human triage based on call complexity."}
                         </p>
                         <div className="pt-2">
                           <button 
                             onClick={() => openTranscript(esc)}
                             className="text-xs font-bold text-gray-900 underline underline-offset-4 hover:text-gray-600"
                           >
                             View Full Transcript &rarr;
                           </button>
                         </div>
                      </div>
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                         <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                            <CheckCircle2 size={14} /> Update Status
                         </div>
                         <div className="space-y-2">
                           {['Open', 'In Review', 'Resolved'].map(s => (
                             <button 
                               key={s}
                               onClick={() => handleStatusChange(esc.id, s)}
                               className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${esc.status === s ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                             >
                                <div className={`w-2 h-2 rounded-full ${s === 'Open' ? 'bg-rose-500' : s === 'In Review' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                {s}
                                {esc.status === s && <div className="ml-auto bg-white/20 p-0.5 rounded-full"><CheckCircle2 size={12} /></div>}
                             </button>
                           ))}
                         </div>
                      </div>
                   </div>

                   <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                         <MessageSquare size={14} /> Internal Notes <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-[9px]">{esc.notes?.length || 0}</span>
                      </div>
                      
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {(esc.notes || []).map(note => (
                           <div key={note.id} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                              <div className="flex items-center justify-between mb-2">
                                 <div className="text-[11px] font-bold text-gray-900 flex items-center gap-1.5">
                                    <div className="w-5 h-5 bg-gray-900 text-white flex items-center justify-center rounded-full text-[9px]">MR</div>
                                    {note.author}
                                 </div>
                                 <div className="text-[10px] font-bold text-gray-400 uppercase">{note.date}</div>
                              </div>
                              <p className="text-sm text-gray-600 font-medium leading-relaxed">{note.text}</p>
                           </div>
                         ))}
                         {(!esc.notes || esc.notes.length === 0) && (
                            <div className="text-center py-6 text-xs text-gray-400 font-medium italic">No internal notes yet. Use the field below to add one.</div>
                         )}
                      </div>

                      <div className="relative pt-2">
                         <input 
                           type="text" 
                           placeholder="Add an internal note..." 
                           value={newNote}
                           onChange={(e) => setNewNote(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && handleAddNote(esc.id)}
                           className="w-full pl-5 pr-14 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:border-gray-900 focus:bg-white transition-all outline-none"
                         />
                         <button 
                           onClick={() => handleAddNote(esc.id)}
                           className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-200 hover:scale-105 transition-transform"
                         >
                            <Send size={16} />
                         </button>
                      </div>
                   </div>
                </div>
             )}
           </React.Fragment>
          ))
         )}
      </div>

      <TranscriptModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        transcript={selectedCall?.transcript} 
        caller={selectedCall?.caller || selectedCall?.caller_phone} 
        date={selectedCall?.date || ''}
      />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Escalations;
