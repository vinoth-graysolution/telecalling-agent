import React, { useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, ChevronUp, Clock, User, ClipboardList, CheckCircle, Phone, Loader2 } from 'lucide-react';
import { getPatients, getPatientHistory, startOutboundCall } from '../../api';
import Toast from '../../components/Toast';

const StatusBadge = ({ status }) => {
  return (
    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
       {status}
    </span>
  );
};

const Tag = ({ text }) => (
  <span className="px-2 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-md border border-gray-100 whitespace-nowrap">
    {text}
  </span>
);

const PatientHistory = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [callingId, setCallingId] = useState(null);
  const [patientHistory, setPatientHistory] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const data = await getPatients();
        setPatients(data.patients || []);
      } catch (err) {
        console.error('Failed to fetch patients:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, []);

  const toggleExpand = async (id, phone) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(id);
    if (!patientHistory[phone]) {
      try {
        setLoadingHistory(true);
        const history = await getPatientHistory(phone.replace(/\D/g, ''));
        setPatientHistory(prev => ({ ...prev, [phone]: history }));
      } catch (err) {
        console.error('Failed to fetch patient history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
  };

  const handleCallNow = async (id, phone) => {
    try {
      setCallingId(id);
      await startOutboundCall(phone);
      setToast({ message: `Outbound call initiated for ${phone}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error triggering call: ' + err.message, type: 'error' });
    } finally {
      setCallingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Patient History</h1>
        <p className="text-sm text-gray-500 mt-1">Search and view complete patient treatment records</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-6">
         
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by patient name or phone number..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-gray-400"
            />
         </div>

         <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
            <div className="flex-1">
               <label className="block text-xs font-semibold text-gray-700 mb-1">Treatment Type</label>
               <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none font-medium">
                  <option>All</option>
               </select>
            </div>
            <div className="flex-1">
               <label className="block text-xs font-semibold text-gray-700 mb-1">Patient Status</label>
               <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm appearance-none font-medium">
                  <option>All</option>
                  <option>Active</option>
                  <option>Inactive</option>
               </select>
            </div>
            <div className="flex-1 relative">
               <label className="block text-xs font-semibold text-gray-700 mb-1">Last Visit From</label>
               <div className="relative">
                 <input type="text" placeholder="-/-/-" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm" />
                 <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
               </div>
            </div>
            <div className="flex-1 relative">
               <label className="block text-xs font-semibold text-gray-700 mb-1">Last Visit To</label>
               <div className="relative">
                 <input type="text" placeholder="-/-/-" className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm" />
                 <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
               </div>
            </div>
         </div>

         <div className="text-sm text-gray-400 font-medium pb-2">Showing <span className="font-bold text-gray-900">12</span> patients</div>

         <div className="overflow-x-auto -mx-6">
            <table className="w-full">
               <thead>
                  <tr className="bg-white">
                     <th className="pl-6 w-10"></th>
                     <th>Patient Name</th>
                     <th>Phone Number</th>
                     <th>Last Visit</th>
                     <th>Total Visits</th>
                     <th className="w-1/4">Treatment Types</th>
                     <th>Status</th>
                     <th className="pr-6 text-right">Action</th>
                  </tr>
               </thead>
               <tbody className="text-sm">
                 {loading ? (
                    <tr>
                       <td colSpan="8" className="py-20 text-center">
                          <Loader2 className="animate-spin text-gray-300 mx-auto" size={32} />
                          <p className="text-xs font-bold text-gray-400 mt-4 tracking-widest uppercase">Loading Patient Records...</p>
                       </td>
                    </tr>
                 ) : patients.map(patient => (
                   <React.Fragment key={patient.id}>
                     <tr 
                        className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors ${expandedId === patient.id ? 'bg-gray-50/30' : ''}`}
                     >
                        <td className="pl-6 py-4 text-gray-400 cursor-pointer" onClick={() => toggleExpand(patient.id, patient.phone)}>
                          {expandedId === patient.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td className="py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold shrink-0 shadow-inner">
                                 {patient.initials}
                              </div>
                              <span className="font-bold text-gray-900">{patient.name}</span>
                           </div>
                        </td>
                        <td className="text-gray-600 font-medium">{patient.phone}</td>
                        <td className="text-gray-600">{patient.lastVisit}</td>
                        <td>
                           <span className="px-2.5 py-1 bg-gray-100 text-gray-900 text-[11px] font-bold rounded-full">{patient.visits} visits</span>
                        </td>
                        <td>
                           <div className="flex flex-wrap gap-1.5">
                              {(patient.treatments || ['Cleaning']).map(t => <Tag key={t} text={t} />)}
                           </div>
                        </td>
                        <td><StatusBadge status={patient.status} /></td>
                        <td className="pr-6 text-right">
                           <button 
                             onClick={() => handleCallNow(patient.id, patient.phone)}
                             disabled={callingId === patient.id}
                             className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[11px] font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                           >
                             {callingId === patient.id ? (
                               <Loader2 size={12} className="animate-spin" />
                             ) : (
                               <Phone size={12} fill="currentColor" />
                             )}
                             Call Now
                           </button>
                        </td>
                     </tr>
                     {expandedId === patient.id && (
                       <tr className="bg-gray-50/30">
                         <td colSpan="7" className="px-6 py-6 border-b border-gray-100">
                           <div className="space-y-6 animate-in">
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                  <ClipboardList size={18} className="text-gray-400" /> Visit History
                                </h3>
                             </div>
                             <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                               {loadingHistory ? (
                                 <div className="flex flex-col items-center py-12">
                                    <Loader2 className="animate-spin text-gray-200" size={32} />
                                    <p className="text-[10px] font-bold text-gray-400 mt-4 uppercase tracking-widest">Building Interaction Timeline...</p>
                                 </div>
                               ) : (patientHistory[patient.phone] || []).map((visit, idx) => (
                                 <div key={idx} className="relative">
                                    <div className="absolute -left-[30px] top-1 w-5 h-5 bg-white border-2 border-gray-900 rounded-full flex items-center justify-center z-10 shadow-sm">
                                       <div className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
                                    </div>
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4 hover:border-gray-900 transition-colors">
                                       <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                             <span className="text-xs font-black text-gray-900">{visit.date}</span>
                                             <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full uppercase tracking-widest">{visit.time}</span>
                                             <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tighter ${visit.type === 'call' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                {visit.type}
                                             </span>
                                          </div>
                                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${['Completed', 'Booked'].includes(visit.outcome) ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                             {visit.outcome}
                                          </span>
                                       </div>
                                       
                                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                          <div className="space-y-1">
                                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Activity</span>
                                             <p className="text-sm font-bold text-gray-900">{visit.treatment}</p>
                                          </div>
                                          <div className="space-y-1">
                                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Agent/Doctor</span>
                                             <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><User size={14} className="text-gray-300" /> {visit.doctor}</p>
                                          </div>
                                          <div className="space-y-1">
                                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Reference ID</span>
                                             <p className="text-xs font-mono text-gray-500">{visit.ref}</p>
                                          </div>
                                       </div>

                                       <div className="pt-4 border-t border-gray-50 flex items-start gap-3">
                                          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0"><ClipboardList size={14} /></div>
                                          <p className="text-xs text-gray-600 leading-relaxed italic font-medium">
                                             "{visit.notes}"
                                          </p>
                                       </div>
                                    </div>
                                 </div>
                               ))}
                               {!loadingHistory && (!patientHistory[patient.phone] || patientHistory[patient.phone].length === 0) && (
                                 <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                                    <div className="p-3 bg-gray-50 text-gray-300 rounded-full w-fit mx-auto mb-3"><ClipboardList size={32} /></div>
                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Interaction History</p>
                                 </div>
                               )}
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

export default PatientHistory;
