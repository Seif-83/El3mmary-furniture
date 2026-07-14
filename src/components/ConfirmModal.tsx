// Generic confirm/delete dialog, extracted from App.tsx. Purely
// presentational - all state (open/closed, title, message, what happens on
// confirm) lives in the parent and is passed in as props.
import React from "react";
import { motion } from "motion/react";
import { Trash2 } from "lucide-react";

export const ConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  lang: "en" | "ar";
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ isOpen, title, message, lang, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl relative z-10 overflow-hidden text-center"
      >
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">{title}</h2>
        <p className="text-zinc-500 mb-10 leading-relaxed">{message}</p>
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-4 border border-zinc-200 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-zinc-50 transition-all active:scale-95 btn-3d btn-3d-glass"
          >
            {lang === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-200 btn-3d btn-3d-danger"
          >
            {lang === "ar" ? "تأكيد" : "Confirm"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};