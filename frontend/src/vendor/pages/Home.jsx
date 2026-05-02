import React, { useState, useEffect } from 'react';
import { Phone, CalendarDays, Clock, Bot, AlertTriangle, Loader2, Play, CheckCircle2, Languages, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getStats, getAppointments, getLiveCalls, startOutboundCall } from '../../api';
import Toast from '../../components/Toast';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from 'recharts';

const COLORS = ['#111827', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

const StatusBadge = ({ status }) => {
  let styles = '';
  const s = status || 'Booked';
  if (s === 'Booked') styles = 'bg-emerald-100 text-emerald-800';
  else if (s === 'Rescheduled') styles = 'bg-amber-100 text-amber-800';
  else if (s === 'Cancelled') styles = 'bg-rose-100 text-rose-800';
  
  return <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${styles}`}>{s}</span>;
}

const StatCard = ({ icon: Icon, value, label, valueDetails, loading }) => (
  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col h-full">
    <div className={`p-3 rounded-lg w-fit bg-gray-50 text-gray-600 mb-6`}>
      <Icon size={20} strokeWidth={2} />
    </div>
    <div className="flex items-center gap-2 mb-1">
       {valueDetails}
       {loading ? (
         <div className="h-9 w-16 bg-gray-100 animate-pulse rounded-lg" />
       ) : (
         <div className="text-3xl font-bold text-gray-900">{value}</div>
       )}
    </div>
    <div className="text-sm text-gray-500 font-medium">{label}</div>
  </div>
);

const Home = () => {
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState(null);
  const [activeCalls, setActiveCalls] = useState([]);
  const [toast, setToast] = useState(null);

  const fetchDashboardData = async () => {
    try {
      const [statsData, aptData, live] = await Promise.all([
        getStats(),
        getAppointments(5),
        getLiveCalls()
      ]);
      setStats(statsData);
      setAppointments(aptData);
      setActiveCalls(live || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll for live calls every 10 seconds
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCallNow = async (id, phone) => {
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

  const outcomeData = stats?.analytics?.outcomes?.map(o => ({
    name: o.status.charAt(0).toUpperCase() + o.status.slice(1),
    value: o.count
  })) || [];

  const languageData = stats?.analytics?.languages?.map(l => ({
    name: l.language,
    value: l.count
  })) || [];

  const hourData = stats?.analytics?.hours?.map(h => ({
    hour: `${h.hour}:00`,
    bookings: h.count
  })) || [];

  return (
    <div className="space-y-6 pb-12">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Phone} value={stats?.call_logs?.total_calls || '0'} label="Total Calls Handled" loading={loading} />
        <StatCard icon={CalendarDays} value={stats?.appointments?.total || '0'} label="AI Booked Appointments" loading={loading} />
        <StatCard icon={Clock} value={stats?.appointments?.today || '0'} label="Appointments Today" loading={loading} />
        <StatCard icon={Bot} value="Active" label="Live Call Status" loading={loading} valueDetails={<span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Monitoring Dashboard */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
           <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                 <Activity size={16} className="text-rose-500" /> Live Monitoring
              </h2>
              <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full animate-pulse">2 LIVE</span>
           </div>
           <div className="p-4 flex-1 space-y-3">
              {activeCalls.map(call => (
                <div key={call.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                         <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                      </div>
                      <div>
                         <div className="text-sm font-bold text-gray-900">{call.phone}</div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{call.stage} ...</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-xs font-mono font-bold text-gray-600">{call.duration}</div>
                      <div className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">In Progress</div>
                   </div>
                </div>
              ))}
              <div className="pt-4 mt-auto">
                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Recently Completed
                 </div>
                 <div className="space-y-2 opacity-60">
                    <div className="text-[11px] font-medium text-gray-600 flex justify-between">
                       <span>+91 91XXX X1102</span>
                       <span>2m 14s</span>
                    </div>
                    <div className="text-[11px] font-medium text-gray-600 flex justify-between">
                       <span>+91 88XXX X9234</span>
                       <span>1m 05s</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Analytics Section */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Outcome Pie Chart */}
           <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-[350px]">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                 <Play size={14} className="text-amber-500" fill="currentColor" /> Outcome Distribution
              </h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {outcomeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Language Pie Chart */}
           <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-[350px]">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                 <Languages size={16} className="text-indigo-500" /> Language Usage
              </h3>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={languageData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {languageData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      </div>

      {/* Peak Booking Hours Line Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
         <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider mb-8 flex items-center gap-2">
            <Clock size={16} className="text-emerald-500" /> Peak Booking Hours
         </h3>
         <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={hourData}>
                  <defs>
                     <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111827" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#9ca3af'}} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="bookings" stroke="#111827" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden m-0">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Recent AI Bookings</h2>
          <Link to="/appointments" className="text-sm font-semibold text-gray-900 hover:text-gray-600 underline underline-offset-2">View All</Link>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="animate-spin text-gray-300" size={32} />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Syncing with DB...</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr className="bg-white text-gray-400 text-[10px] font-black uppercase tracking-[2px]">
                  <th className="w-1/4 pl-6">Patient Name</th>
                  <th className="w-1/6">Date</th>
                  <th className="w-1/6">Time</th>
                  <th className="w-1/4">Contact Number</th>
                  <th className="w-1/6 text-right pr-8">Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="font-semibold text-gray-900 pl-6 py-4">{apt.name}</td>
                    <td className="text-gray-500 font-medium">{apt.appointment_date}</td>
                    <td className="text-gray-500 font-medium">{apt.appointment_time?.split(':').slice(0, 2).join(':')}</td>
                    <td className="text-gray-600 font-bold">{apt.phone}</td>
                    <td className="text-right pr-8">
                       <button 
                         onClick={() => handleCallNow(apt.id, apt.phone)}
                         disabled={callingId === apt.id}
                         className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[11px] font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm"
                       >
                         {callingId === apt.id ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} fill="currentColor" />}
                         Call
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Home;
