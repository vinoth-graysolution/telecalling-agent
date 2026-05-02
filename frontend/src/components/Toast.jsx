import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-rose-600';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className={`fixed bottom-8 right-8 z-[100] flex items-center gap-3 px-6 py-4 ${bgColor} text-white rounded-2xl shadow-2xl animate-in slide-in-from-right-10 duration-300`}>
      <Icon size={20} />
      <span className="text-sm font-bold tracking-tight">{message}</span>
      <button onClick={onClose} className="ml-4 p-1 hover:bg-white/10 rounded-lg transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
