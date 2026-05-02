import React, { useState, useEffect } from 'react';
import { Building2, Phone, Clock, FileText, AlertTriangle, RotateCcw, Loader2 } from 'lucide-react';
import { getCallLogs, startOutboundCall } from '../../api';
import Toast from '../../components/Toast';

const EscalationCard = ({ esc, onCall }) => {
  let badgeColor;
  const status = esc.status?.toLowerCase() || 'failed';
  
  if (status === 'failed') badgeColor = 'bg-amber-100 text-amber-800';
  else if (status === 'no-answer') badgeColor = 'bg-rose-100 text-rose-800';
  else badgeColor = 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:border-gray-900 transition-colors">
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-md">
              <Building2 size={14} className="text-gray-600" />
            </div>
            <h3 className="font-bold text-gray-900">{esc.clinic || 'Main Clinic'}</h3>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-tighter ${badgeColor}`}>
            {esc.status}
          </span>
        </div>
        <div className="text-xs text-gray-500 mb-5 ml-8">{esc.location || 'Remote'}</div>

        <div className="space-y-4 text-sm mt-2 ml-1">
          <div className="flex items-start gap-3">
             <div className="p-1.5 bg-gray-50 rounded-full mt-0.5"><Phone size={12} className="text-gray-500" /></div>
             <div className="flex-1 flex justify-between items-center">
               <div>
                 <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Caller Number</div>
                 <div className="text-gray-900 font-medium">{esc.caller_phone || esc.caller}</div>
               </div>
               <button 
                 onClick={() => onCall(esc.id, esc.caller_phone || esc.caller)}
                 className="p-2 bg-gray-900 text-white rounded-lg hover:scale-105 transition-transform shadow-sm"
               >
                 <Phone size={12} fill="currentColor" />
               </button>
             </div>
          </div>
          <div className="flex items-start gap-3">
             <div className="p-1.5 bg-gray-50 rounded-full mt-0.5"><Clock size={12} className="text-gray-500" /></div>
             <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Escalation Time</div>
                <div className="text-gray-900">{esc.created_at}</div>
             </div>
          </div>
          <div className="flex items-start gap-3">
             <div className="p-1.5 bg-gray-50 rounded-full mt-0.5"><FileText size={12} className="text-gray-500" /></div>
             <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Transcript Summary</div>
                <div className="text-gray-700 leading-relaxed text-[13px] italic">"{esc.transcriptSummary || 'No summary available.'}"</div>
             </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 p-4 bg-gray-50/50 flex justify-between items-center text-xs">
         <div className="flex items-center gap-1.5 text-amber-600 font-medium">
           <AlertTriangle size={14} /> {esc.aiDecision || 'Awaiting vendor resolution'}
         </div>
         <div className="text-gray-400 font-mono">#{esc.id}</div>
      </div>
    </div>
  );
};

const Escalations = () => {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        const data = await getCallLogs(1, 'failed');
        setEscalations(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch admin escalations:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEscalations();
  }, []);

  const handleCall = async (id, phone) => {
    try {
      await startOutboundCall(phone);
      setToast({ message: `Outbound call initiated for ${phone}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Escalations</h1>
        <p className="text-sm text-gray-500 mt-1">View all unresolved escalations across all clinics</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20 gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
           <Loader2 className="animate-spin text-gray-200" size={40} />
           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Fetching Global Escalations...</p>
        </div>
      ) : escalations.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
           <div className="p-4 bg-emerald-50 rounded-full text-emerald-500"><AlertTriangle size={32} /></div>
           <div>
              <p className="text-sm font-bold text-gray-900">All clear!</p>
              <p className="text-xs text-gray-500 mt-1">No unresolved escalations across the platform.</p>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {escalations.map(esc => <EscalationCard key={esc.id} esc={esc} onCall={handleCall} />)}
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Escalations;
