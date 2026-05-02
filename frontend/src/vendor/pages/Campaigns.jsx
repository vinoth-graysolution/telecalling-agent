import React, { useState, useEffect } from 'react';
import { Upload, Play, CheckCircle2, AlertCircle, Loader2, Users, PhoneCall, Clock } from 'lucide-react';
import { api } from '../../api';
import Toast from '../../components/Toast';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [csvData, setCsvData] = useState(null);
  const [campaignName, setCampaignName] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await api.get('/campaigns');
        setCampaigns(response || []);
      } catch (err) {
        console.error('Failed to fetch campaigns:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
    // Poll for updates if any campaign is 'processing'
    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      // Assume simple format: phone_number, name
      const numbers = lines.map(line => line.split(',')[0].trim()).filter(n => /^\+?\d+$/.test(n));
      setCsvData(numbers);
      if (!campaignName) setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
      setToast({ message: `Successfully loaded ${numbers.length} leads.`, type: 'success' });
    };
    reader.readAsText(file);
  };

  const startCampaign = async () => {
    if (!csvData || !campaignName) return;
    try {
      setTriggering(true);
      await api.post('/campaigns/trigger', {
        name: campaignName,
        phone_numbers: csvData
      });
      setCsvData(null);
      setCampaignName('');
      setToast({ message: 'Campaign started successfully!', type: 'success' });
      // Refresh list
      const response = await api.get('/campaigns');
      setCampaigns(response || []);
    } catch (err) {
      setToast({ message: 'Failed to start campaign: ' + err.message, type: 'error' });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Trigger automated AI calls to a list of leads</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creation Card */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                 <Upload size={14} /> New Campaign
              </div>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Campaign Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. EMI Reminders Jan" 
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium focus:border-gray-900 focus:bg-white transition-all outline-none"
                    />
                 </div>

                 <div className="relative group">
                    <input 
                      type="file" 
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 group-hover:border-gray-900 transition-colors bg-gray-50/50">
                       <div className="p-3 bg-white rounded-xl shadow-sm text-gray-400 group-hover:text-gray-900 transition-colors">
                          <Users size={24} />
                       </div>
                       <div className="text-center">
                          <p className="text-sm font-bold text-gray-900">Upload CSV List</p>
                          <p className="text-[11px] font-medium text-gray-400 mt-1">Phone numbers only (one per line)</p>
                       </div>
                    </div>
                 </div>

                 {csvData && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold text-xs">{csvData.length}</div>
                          <span className="text-xs font-bold text-emerald-700">Leads Identified</span>
                       </div>
                       <button 
                         onClick={startCampaign}
                         disabled={triggering}
                         className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-gray-200"
                       >
                          {triggering ? <Loader2 size={14} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                          Start Now
                       </button>
                    </div>
                 )}
              </div>
           </div>
           
           <div className="bg-gray-900 rounded-2xl p-6 text-white space-y-4">
              <h4 className="font-bold text-sm">Campaign Tips</h4>
              <ul className="text-xs text-gray-400 space-y-3 leading-relaxed">
                 <li className="flex gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    Ensure your CSV has one phone number per line including the country code (e.g. +91...)
                 </li>
                 <li className="flex gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    AI Agent will use the "Outbound Prompt" configured in Settings.
                 </li>
                 <li className="flex gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    Calls are rate-limited to 1 call every 2 seconds to ensure stability.
                 </li>
              </ul>
           </div>
        </div>

        {/* History List */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
              <Clock size={14} /> Campaign History
           </div>

           {loading ? (
             <div className="flex flex-col items-center py-20 gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Loader2 className="animate-spin text-gray-200" size={40} />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Fetching Campaigns...</p>
             </div>
           ) : campaigns.length === 0 ? (
             <div className="flex flex-col items-center py-20 gap-4 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
                <div className="p-4 bg-gray-50 rounded-full text-gray-300"><PhoneCall size={32} /></div>
                <div>
                   <p className="text-sm font-bold text-gray-900">No campaigns yet</p>
                   <p className="text-xs text-gray-500 mt-1">Upload a lead list to start your first outreach.</p>
                </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {campaigns.map(camp => (
                  <div key={camp.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex items-center justify-between mb-6">
                        <div>
                           <h3 className="font-bold text-gray-900">{camp.name}</h3>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             {new Date(camp.created_at).toLocaleString()}
                           </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          camp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                        }`}>
                           {camp.status}
                        </div>
                     </div>
                     
                     <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-500">
                           <span>Progress</span>
                           <span>{Math.round((camp.completed_calls / camp.total_calls) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-gray-900 transition-all duration-1000" 
                             style={{ width: `${(camp.completed_calls / camp.total_calls) * 100}%` }}
                           />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                           <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total</div>
                              <div className="text-lg font-black text-gray-900">{camp.total_calls}</div>
                           </div>
                           <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Success</div>
                              <div className="text-lg font-black text-emerald-600">{camp.completed_calls}</div>
                           </div>
                           <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Failed</div>
                              <div className="text-lg font-black text-rose-600">{camp.failed_calls}</div>
                           </div>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Campaigns;
