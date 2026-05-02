import React, { useState, useEffect } from 'react';
import { Download, ChevronDown, ChevronUp, Phone, Loader2 } from 'lucide-react';
import { getCallLogs, startOutboundCall } from '../../api';
import Toast from '../../components/Toast';

const OutcomeBadge = ({ outcome }) => {
  let bgColor, textColor;
  switch(outcome.toLowerCase()) {
    case 'completed':
    case 'resolved':
      bgColor = 'bg-emerald-100'; textColor = 'text-emerald-700'; break;
    case 'transferred':
      bgColor = 'bg-gray-100'; textColor = 'text-gray-700'; break;
    case 'failed':
    case 'escalated':
      bgColor = 'bg-amber-100'; textColor = 'text-amber-700'; break;
    case 'no-answer':
    case 'missed':
      bgColor = 'bg-rose-100'; textColor = 'text-rose-700'; break;
    default:
      bgColor = 'bg-gray-100'; textColor = 'text-gray-700';
  }
  return <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${bgColor} ${textColor}`}>{outcome}</span>;
}

const CallLogs = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [callingId, setCallingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const data = await getCallLogs(1);
        setCalls(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch call logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalls();
  }, []);

  const handleCallNow = async (id, phone) => {
    try {
      setCallingId(id);
      await startOutboundCall(phone);
      setToast({ message: `Outbound call initiated for ${phone}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    } finally {
      setCallingId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Call Logs</h1>
        <p className="text-sm text-gray-500 mt-1">View all calls across all clinics</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-2 border-b border-gray-100">
          <div>
             <label className="block text-xs font-semibold text-gray-700 mb-1">Clinic</label>
             <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none text-gray-700 font-medium">
                <option>All Clinics</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-semibold text-gray-700 mb-1">Date Range</label>
             <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none text-gray-700 font-medium">
                <option>Today</option>
                <option>Last 7 Days</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-semibold text-gray-700 mb-1">Outcome</label>
             <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none text-gray-700 font-medium">
                <option>All Outcomes</option>
             </select>
          </div>
          <div>
             <label className="block text-xs font-semibold text-gray-700 mb-1">Language</label>
             <select className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none text-gray-700 font-medium">
                <option>All Languages</option>
             </select>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">Showing <span className="font-semibold text-gray-900">15</span> calls</div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 text-gray-700">
              <Download size={16} /> Export CSV
            </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-6">
          <table className="w-full">
            <thead>
              <tr className="bg-white">
                <th className="pl-6">Clinic Name</th>
                <th>Caller Number</th>
                <th>Date & Time</th>
                <th>Duration</th>
                <th>Language</th>
                <th>Intent</th>
                <th>Outcome</th>
                <th className="pr-6 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                   <td colSpan="8" className="py-20 text-center">
                      <Loader2 className="animate-spin text-gray-300 mx-auto" size={32} />
                      <p className="text-xs font-bold text-gray-400 mt-4 tracking-widest uppercase">Fetching Global Call Logs...</p>
                   </td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                   <td colSpan="8" className="py-20 text-center text-gray-400 font-medium">No calls found in the system yet.</td>
                </tr>
              ) : calls.map(call => (
                <React.Fragment key={call.id}>
                  <tr 
                    className={`cursor-pointer transition-colors ${expandedId === call.id ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'}`}
                    onClick={() => toggleExpand(call.id)}
                  >
                    <td className="pl-6 font-semibold text-gray-900">{call.clinic || 'Main Clinic'}</td>
                    <td className="text-gray-900">{call.caller_phone || call.caller}</td>
                    <td>{call.created_at}</td>
                    <td>{call.duration_seconds}s</td>
                    <td>{call.language}</td>
                    <td className="text-gray-900">{call.intent || 'Unknown'}</td>
                    <td><OutcomeBadge outcome={call.status} /></td>
                     <td className="pr-6 text-right">
                       <div className="flex items-center justify-end gap-3">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             handleCallNow(call.id, call.caller_phone || call.caller);
                           }}
                           disabled={callingId === call.id}
                           className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                           title="Call Now"
                         >
                           {callingId === call.id ? (
                             <Loader2 size={14} className="animate-spin" />
                           ) : (
                             <Phone size={14} fill="currentColor" />
                           )}
                         </button>
                         {expandedId === call.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                       </div>
                     </td>
                  </tr>
                  {expandedId === call.id && (
                    <tr>
                      <td colSpan="8" className="px-6 py-4 bg-gray-50/30 border-b border-gray-100">
                        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 animate-in">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Transcript Summary</h4>
                               <p className="text-sm text-gray-700 leading-relaxed font-medium italic">
                                 "{call.transcriptSummary || "No summary available for this call."}"
                               </p>
                            </div>
                            <div className="space-y-4">
                               <div>
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Decision Note</h4>
                                  <p className="text-sm text-gray-700 font-medium">
                                    {call.aiDecision || "No decision data available."}
                                  </p>
                               </div>
                               <div>
                                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Full Transcript Snippet</h4>
                                  <div className="text-[13px] bg-gray-50 p-4 rounded-lg text-gray-600 block w-full font-mono border border-gray-100 max-h-40 overflow-y-auto whitespace-pre-wrap">
                                    {call.transcript || "No transcript available."}
                                  </div>
                               </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CallLogs;

