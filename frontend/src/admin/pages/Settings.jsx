import React, { useState, useEffect } from 'react';
import { Pencil, Save, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../../api';

const Settings = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await api.get('/admin/config');
        setPrompts(response || []);
      } catch (err) {
        console.error('Failed to fetch prompts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrompts();
  }, []);

  const handlePromptChange = (key, newValue) => {
    setPrompts(prompts.map(p => p.key === key ? { ...p, value: newValue } : p));
  };

  const savePrompt = async (key, value) => {
    try {
      setSavingKey(key);
      await api.post(`/admin/config/${key}`, { value });
      setSaveSuccess(key);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to save prompt:', err);
      alert('Failed to save prompt: ' + err.message);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Global configuration for Gray AI Voice Agents</p>
      </div>

      {/* Company Profile (Static for now) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden opacity-60">
         <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Company Profile</h2>
            <p className="text-sm text-gray-500">Gray AI platform information</p>
         </div>
         <div className="p-6 space-y-6 pointer-events-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Name</label>
                  <input type="text" defaultValue="Gray AI" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900" />
               </div>
               <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Support Email</label>
                  <input type="email" defaultValue="support@gray.ai" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900" />
               </div>
            </div>
         </div>
      </div>

      {/* Dynamic Prompt Editor */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-lg font-bold text-gray-900">AI Agent Behavior & Prompts</h2>
           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-md">Live Production Sync</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3 bg-white rounded-xl border border-dashed border-gray-200">
             <Loader2 className="animate-spin text-gray-300" size={32} />
             <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Prompts...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
             {prompts.map((prompt) => (
               <div key={prompt.key} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                     <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                          {prompt.key.replace('_', ' ')}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Last updated: {new Date(prompt.updated_at).toLocaleString()}</p>
                     </div>
                     <button 
                       onClick={() => savePrompt(prompt.key, prompt.value)}
                       disabled={savingKey === prompt.key}
                       className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                         saveSuccess === prompt.key 
                           ? 'bg-emerald-500 text-white shadow-emerald-100' 
                           : 'bg-gray-900 text-white shadow-gray-200 hover:scale-105 active:scale-95'
                       }`}
                     >
                        {savingKey === prompt.key ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : saveSuccess === prompt.key ? (
                          <CheckCircle size={14} />
                        ) : (
                          <Save size={14} />
                        )}
                        {saveSuccess === prompt.key ? 'Saved!' : 'Save Changes'}
                     </button>
                  </div>
                  <div className="p-0">
                     <textarea 
                        value={prompt.value}
                        onChange={(e) => handlePromptChange(prompt.key, e.target.value)}
                        spellCheck="false"
                        className="w-full h-[500px] p-6 text-sm font-mono leading-relaxed text-gray-700 focus:outline-none bg-white resize-none"
                        placeholder="Paste system prompt here..."
                     />
                  </div>
                  <div className="p-4 bg-amber-50/50 border-t border-amber-100 flex items-start gap-3">
                     <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-black shrink-0">!</div>
                     <p className="text-[11px] font-bold text-amber-700/80 leading-snug">
                       Careful: Changes here apply instantly to all live calls. Ensure all placeholder variables like <code className="bg-amber-100 px-1 rounded">{'{day}'}</code> and <code className="bg-amber-100 px-1 rounded">{'{time_12h}'}</code> are preserved.
                     </p>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-2xl p-8 text-white flex items-center justify-between shadow-2xl shadow-gray-300">
         <div className="space-y-1">
            <h4 className="text-lg font-bold">Need a Custom Agent?</h4>
            <p className="text-sm text-gray-400">Our engineering team can build custom intent handlers for your specific industry.</p>
         </div>
         <button className="px-6 py-3 bg-white text-gray-900 rounded-xl font-bold text-sm hover:scale-105 transition-transform">
            Contact Engineering
         </button>
      </div>
    </div>
  );
};

export default Settings;
