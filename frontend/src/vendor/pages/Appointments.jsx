import React, { useState, useEffect } from 'react';
import { Loader2, Phone } from 'lucide-react';
import { getAppointments, updateAppointmentStatus, startOutboundCall } from '../../api';
import Toast from '../../components/Toast';

const StatusBadge = ({ status }) => {
  let styles = '';
  const s = status || 'Booked';
  if (s === 'Booked') styles = 'bg-emerald-100 text-emerald-800';
  else if (s === 'Rescheduled') styles = 'bg-amber-100 text-amber-800';
  else if (s === 'Cancelled') styles = 'bg-rose-100 text-rose-800';
  
  return <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${styles}`}>{s}</span>;
}

const WhatsAppBadge = ({ status }) => {
  if (status === 'delivered') return <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> WhatsApp Delivered</span>;
  if (status === 'read') return <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> WhatsApp Read</span>;
  if (status === 'failed') return <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> WhatsApp Failed</span>;
  return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><div className="w-1.5 h-1.5 bg-gray-300 rounded-full" /> Sent</span>;
}

const Appointments = () => {
  const [activeTab, setActiveTab] = useState('Today');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoading(true);
        const data = await getAppointments(100); // Fetch a larger set
        setAppointments(data);
      } catch (error) {
        console.error('Failed to fetch appointments', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  const handleCallNow = async (id, phone) => {
    // Normalise phone: strip non-digits, ensure it starts with country code if needed
    const normalizedPhone = phone.replace(/\D/g, '');
    const finalPhone = normalizedPhone.startsWith('91') ? normalizedPhone : `91${normalizedPhone}`;
    
    try {
      setCallingId(id);
      await startOutboundCall(finalPhone);
      setToast({ message: `Outbound call initiated for ${finalPhone}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Error triggering call: ' + err.message, type: 'error' });
    } finally {
      setCallingId(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  
  const filteredData = appointments.filter(apt => {
    if (activeTab === 'Today') {
      return apt.appointment_date === today;
    } else {
      return apt.appointment_date > today;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <p className="text-sm text-gray-500 mt-1">View and manage AI-confirmed appointments mapped from Database</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden m-0">
        <div className="border-b border-gray-200 flex items-center px-4">
           <button 
             onClick={() => setActiveTab('Today')}
             className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'Today' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           >
             Today
           </button>
           <button 
             onClick={() => setActiveTab('Upcoming')}
             className={`px-4 py-3.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'Upcoming' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           >
             Upcoming
           </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
             <div className="flex flex-col items-center py-20 gap-4">
                <Loader2 className="animate-spin text-gray-300" size={32} />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Querying Appointments...</p>
             </div>
          ) : (
            <table>
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="w-1/4">Patient Name</th>
                  <th className="w-1/6">Date</th>
                  <th className="w-1/6">Time</th>
                  <th className="w-1/4">Contact Number</th>
                  <th className="w-1/6">Status</th>
                  <th className="w-1/6 text-right pr-8">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((apt) => (
                  <tr key={apt.id}>
                    <td className="font-semibold text-gray-900">{apt.name}</td>
                    <td className="text-gray-500">{apt.appointment_date}</td>
                    <td className="text-gray-500">{apt.appointment_time?.split(':').slice(0, 2).join(':')}</td>
                    <td className="text-gray-600">
                       <div className="flex flex-col gap-1">
                          <span>{apt.phone}</span>
                          <WhatsAppBadge status={apt.whatsapp_status} />
                       </div>
                    </td>
                    <td>
                      <select 
                        value={apt.call_status || 'Booked'}
                        onChange={async (e) => {
                          try {
                            const newStatus = e.target.value;
                            await updateAppointmentStatus(apt.id, newStatus);
                            // Optimistically update UI or re-fetch
                            setAppointments(prev => prev.map(p => p.id === apt.id ? { ...p, call_status: newStatus } : p));
                            setToast({ message: `Status updated to ${newStatus}`, type: 'success' });
                          } catch (err) {
                            setToast({ message: 'Failed to update status', type: 'error' });
                          }
                        }}
                        className="bg-transparent text-[11px] font-bold border-none focus:ring-0 cursor-pointer hover:bg-gray-100 rounded-md py-1"
                      >
                        <option value="Booked">Booked</option>
                        <option value="checked-in">Checked In</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no-show">No Show</option>
                      </select>
                    </td>
                    <td className="text-right pr-8">
                       <button 
                         onClick={() => handleCallNow(apt.id, apt.phone)}
                         disabled={callingId === apt.id}
                         className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[11px] font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
                       >
                         {callingId === apt.id ? (
                           <Loader2 size={12} className="animate-spin" />
                         ) : (
                           <Phone size={12} fill="currentColor" />
                         )}
                         Call Now
                       </button>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400 font-medium">No {activeTab.toLowerCase()} appointments found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Appointments;
