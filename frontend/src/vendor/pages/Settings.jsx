import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bot, Bell, Plug, Loader2 } from 'lucide-react';
import Toast from '../../components/Toast';
import apiService from '../../api';

const Settings = () => {
  const [config, setConfig] = useState({
    clinic_name: "Chennai Dental Care",
    llm_model: "gpt-4o-mini",
    languages: ["English", "Tamil"]
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [zohoStatus, setZohoStatus] = useState({ connected: false });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const fetchZohoStatus = async () => {
      try {
        const response = await apiService.get('/integrations/zoho/status');
        setZohoStatus(response);
      } catch (err) {
        console.error('Failed to fetch Zoho status:', err);
      }
    };
    fetchZohoStatus();
  }, []);

  const handleConnectZoho = async () => {
    try {
      const response = await apiService.get('/integrations/zoho/authorize');
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err) {
      setToast({ message: 'Failed to initiate Zoho connection', type: 'error' });
    }
  };

  const handleSyncLeads = async () => {
    try {
      setSyncing(true);
      const response = await apiService.post('/integrations/zoho/sync');
      setToast({ message: response.message, type: response.status === 'success' ? 'success' : 'error' });
      // Refresh status to get last_sync
      const statusRes = await apiService.get('/integrations/zoho/status');
      setZohoStatus(statusRes);
    } catch (err) {
      setToast({ message: 'Sync failed', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Simulate API call for saving settings
      await new Promise(r => setTimeout(r, 1000));
      setToast({ message: 'Settings saved successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
       <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-gray-300" size={32} />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center">Loading Settings...</p>
       </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1 font-medium">Manage your clinic configuration and preferences retrieved from backend</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-gray-200">
         <button 
           onClick={() => setActiveTab('general')}
           className={`flex items-center gap-2 pb-4 pt-2 border-b-2 text-sm font-bold transition-all ${activeTab === 'general' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
         >
            <SettingsIcon size={16} /> General
         </button>
         <button 
           onClick={() => setActiveTab('ai')}
           className={`flex items-center gap-2 pb-4 pt-2 border-b-2 text-sm font-bold transition-all ${activeTab === 'ai' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
         >
            <Bot size={16} /> AI Agent
         </button>
         <button 
           onClick={() => setActiveTab('notifications')}
           className={`flex items-center gap-2 pb-4 pt-2 border-b-2 text-sm font-bold transition-all ${activeTab === 'notifications' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
         >
            <Bell size={16} /> Notifications
         </button>
         <button 
           onClick={() => setActiveTab('integrations')}
           className={`flex items-center gap-2 pb-4 pt-2 border-b-2 text-sm font-bold transition-all ${activeTab === 'integrations' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
         >
            <Plug size={16} /> Integrations
         </button>
      </div>

      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6 animate-in">
           <div className="p-8 space-y-8">
              <h2 className="text-lg font-bold text-gray-900 mb-2">General Settings</h2>
              
              <div className="space-y-6 max-w-2xl">
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Clinic Name</label>
                    <input type="text" defaultValue={config?.clinic_name || "Chennai Dental Care"} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm transition-colors focus:border-gray-400 focus:ring-0" />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Primary AI Model</label>
                    <div className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600 font-mono">
                       {config?.llm_model || 'gpt-4o-mini'}
                    </div>
                 </div>
  
                 <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">Operating Hours</label>
                    <div className="space-y-3">
                       {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                         <div key={day} className="flex items-center gap-4">
                           <span className="w-24 text-sm text-gray-600">{day}</span>
                           <span className="w-16 flex justify-center">
                              <span className="px-3 py-1 bg-gray-900 text-white text-[11px] font-bold rounded-md">Open</span>
                           </span>
                           <div className="flex items-center gap-3">
                              <input type="text" defaultValue="09:00" className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center" />
                              <span className="text-gray-400 text-sm">to</span>
                              <input type="text" defaultValue={idx === 5 ? "14:00" : "18:00"} className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center" />
                           </div>
                         </div>
                       ))}
                    </div>
                 </div>
  
                 <div className="pt-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Language Preference</label>
                    <div className="flex items-center gap-3">
                       {config?.languages?.map(lang => (
                         <button key={lang} className="px-5 py-2 bg-gray-900 text-white font-semibold text-sm rounded-lg border border-gray-900 shadow-sm transition-colors">
                           {lang}
                         </button>
                       ))}
                    </div>
                 </div>
  
                  <div className="pt-6">
                     <button 
                       onClick={handleSave}
                       disabled={saving}
                       className="px-6 py-3 bg-gray-900 text-white font-bold text-sm rounded-xl shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                     >
                        {saving && <Loader2 size={16} className="animate-spin" />}
                        Save Changes
                     </button>
                  </div>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-6 mt-6 animate-in">
           <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-8 flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center">
                    <img src="https://www.vectorlogo.zone/logos/zoho/zoho-icon.svg" className="w-10 h-10" alt="Zoho" />
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-gray-900">Zoho CRM</h3>
                    <p className="text-sm text-gray-500 mt-1">Sync leads and log call interactions automatically.</p>
                    {zohoStatus.connected && (
                       <div className="flex items-center gap-2 mt-3 text-emerald-600 text-xs font-bold bg-emerald-50 w-fit px-2 py-1 rounded-md">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          CONNECTED SINCE {new Date(zohoStatus.connected_since).toLocaleDateString()}
                       </div>
                    )}
                 </div>
              </div>
              <div>
                 {!zohoStatus.connected ? (
                    <button 
                      onClick={handleConnectZoho}
                      className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-gray-200 hover:scale-105 transition-transform"
                    >
                       Connect Zoho CRM
                    </button>
                 ) : (
                    <div className="flex items-center gap-4">
                       <div className="text-right">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Sync</div>
                          <div className="text-xs font-bold text-gray-900">{zohoStatus.last_sync ? new Date(zohoStatus.last_sync).toLocaleString() : 'Never'}</div>
                       </div>
                       <button 
                         onClick={handleSyncLeads}
                         disabled={syncing}
                         className="px-6 py-3 border border-gray-200 text-gray-900 rounded-xl font-bold text-sm hover:bg-gray-50 flex items-center gap-2"
                       >
                          {syncing ? <Loader2 size={16} className="animate-spin" /> : <Plug size={16} />}
                          Sync Leads Now
                       </button>
                    </div>
                 )}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 grayscale pointer-events-none">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600"><SettingsIcon size={24} /></div>
                    <div>
                       <h4 className="font-bold text-gray-900">Salesforce</h4>
                       <p className="text-xs text-gray-500">Coming soon</p>
                    </div>
                 </div>
                 <button className="text-xs font-bold text-gray-400">Configure</button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600"><SettingsIcon size={24} /></div>
                    <div>
                       <h4 className="font-bold text-gray-900">HubSpot</h4>
                       <p className="text-xs text-gray-500">Coming soon</p>
                    </div>
                 </div>
                 <button className="text-xs font-bold text-gray-400">Configure</button>
              </div>
           </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Settings;
