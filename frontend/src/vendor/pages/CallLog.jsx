import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronUp, Phone, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { getCallLogs } from '../../api';
import TranscriptModal from '../../components/TranscriptModal';

const FilterPills = ({ label, options, active, onChange }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs font-semibold text-gray-500">{label}</span>
    <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
      {options.map(opt => (
        <button 
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-colors ${opt === active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const OutcomeBadge = ({ outcome }) => {
  let bgColor, textColor;
  const s = outcome?.toLowerCase() || '';
  if (s === 'completed' || s === 'resolved') {
    bgColor = 'bg-emerald-100'; textColor = 'text-emerald-700';
  } else if (s === 'transferred') {
    bgColor = 'bg-amber-100'; textColor = 'text-amber-700';
  } else if (s === 'failed' || s === 'escalated') {
    bgColor = 'bg-rose-100'; textColor = 'text-rose-700';
  } else if (s === 'missed' || s === 'no-answer') {
    bgColor = 'bg-gray-100'; textColor = 'text-gray-700';
  } else {
    bgColor = 'bg-gray-100'; textColor = 'text-gray-700';
  }
  return <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${bgColor} ${textColor}`}>{outcome || 'Unknown'}</span>;
}

const CallLog = () => {
  const [expandedId, setExpandedId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Transcript Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const filter = statusFilter === 'All' ? null : statusFilter.toLowerCase();
        const data = await getCallLogs(page, filter);
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch call logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [page, statusFilter]);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const openTranscript = (call) => {
    setSelectedCall(call);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Call Log</h1>
        <p className="text-sm text-gray-500 mt-1">Review all AI-handled calls and their outcomes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
        {/* Filters Top Bar */}
        <div className="flex flex-wrap items-center gap-6 border-b border-gray-100 pb-6 mb-2">
           <div className="flex items-center gap-3">
              <div className="relative">
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                 <input type="text" placeholder="-/-/-" className="w-32 pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
              </div>
              <span className="text-gray-400 text-sm">to</span>
              <div className="relative">
                 <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                 <input type="text" placeholder="-/-/-" className="w-32 pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm" />
              </div>
           </div>

           <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
           
           <FilterPills 
             label="Outcome" 
             options={['All', 'Completed', 'Failed', 'No-Answer']} 
             active={statusFilter} 
             onChange={setStatusFilter}
           />
           
           <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

           <div className="ml-auto text-xs text-gray-400 font-bold uppercase tracking-widest pt-2 md:pt-0">
             {total} results
           </div>
        </div>

        {/* List */}
        <div className="overflow-x-auto -mx-6">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
               <Loader2 className="animate-spin text-gray-200" size={40} />
               <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Retrieving Logs...</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-white">
                  <th className="pl-6">Caller Number</th>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Direction</th>
                  <th>Outcome</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {logs.map((call) => (
                  <React.Fragment key={call.id}>
                    <tr 
                      onClick={() => toggleExpand(call.id)}
                      className={`border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${expandedId === call.id ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'}`}
                    >
                      <td className="pl-6 py-4">
                         <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-gray-50 rounded-full text-gray-500"><Phone size={12} fill="currentColor" /></div>
                            <span className="font-semibold text-gray-900">{call.caller_phone}</span>
                         </div>
                      </td>
                      <td className="text-gray-500 font-medium">{new Date(call.date).toLocaleString()}</td>
                      <td className="text-gray-500 py-4">
                         <div className="flex items-center gap-1.5 h-full">
                           <span className="text-gray-400 text-[10px]">⏰</span> {call.duration}
                         </div>
                      </td>
                      <td className="text-gray-600 capitalize font-bold text-[11px] tracking-tight">{call.direction}</td>
                      <td><OutcomeBadge outcome={call.status} /></td>
                      <td className="pr-6 text-gray-400">
                        {expandedId === call.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {expandedId === call.id && (
                      <tr className="bg-gray-50/30">
                        <td colSpan="6" className="px-6 py-4 border-b border-gray-100">
                          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-medium">
                              <div className="space-y-3">
                                 <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Transcript Snippet</h4>
                                 <p className="text-sm text-gray-700 leading-relaxed italic border-l-2 border-gray-100 pl-4">
                                   "{call.transcript ? (call.transcript.substring(0, 150) + '...') : "No transcript snippet available."}"
                                 </p>
                              </div>
                              <div className="space-y-3">
                                 <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">AI Audit Actions</h4>
                                 <p className="text-sm text-gray-500 leading-relaxed">
                                   Detailed processing notes for this interaction are available in the full session log.
                                 </p>
                                 <div className="pt-2">
                                    <button 
                                      onClick={() => openTranscript(call)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-[11px] font-bold rounded-lg hover:bg-gray-800 transition-all shadow-md shadow-gray-100"
                                    >
                                      View Full Transcript &rarr;
                                    </button>
                                 </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-20 text-gray-400 font-medium">No call logs found in the database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-6 mt-4">
             <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
               Page {page} of {Math.ceil(total / 20)}
             </div>
             <div className="flex items-center gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                   <ArrowLeft size={16} />
                </button>
                <button 
                  disabled={page * 20 >= total}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                   <ArrowRight size={16} />
                </button>
             </div>
          </div>
        )}
      </div>

      <TranscriptModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        transcript={selectedCall?.transcript} 
        caller={selectedCall?.caller_phone} 
        date={selectedCall ? new Date(selectedCall.date).toLocaleString() : ''}
      />
    </div>
  );
};

export default CallLog;
