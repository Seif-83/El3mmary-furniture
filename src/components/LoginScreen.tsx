// The screen shown when there's no valid admin session yet - either a
// signed-in-but-unauthorized account, or the login form itself. Extracted
// from App.tsx. Purely presentational: all auth state/logic stays in the
// parent and is passed in as props/callbacks.
import React from "react";
import { motion } from "motion/react";
import { Armchair, ChevronRight, Eye, EyeOff } from "lucide-react";

export const LoginScreen: React.FC<{
  isAuthorizedButWrongAccount: boolean;
  lang: "en" | "ar";
  t: Record<string, string>;
  username: string;
  password: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onLogout: () => void;
}> = ({
  isAuthorizedButWrongAccount,
  lang,
  t,
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  isLoading,
  onSubmit,
  onLogout,
}) => {
  if (isAuthorizedButWrongAccount) {
    return (
      <motion.div
        key="unauthorized"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8"
      >
        <div className="glass rounded-[2.5rem] p-12 shadow-2xl text-center">
          <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" />
          <h2 className="heading-accent text-4xl md:text-5xl font-light mb-4">
            {lang === "ar"
              ? "لا تملك صلاحية الدخول"
              : "Access not authorized"}
          </h2>
          <p className="text-zinc-500 text-base md:text-lg mb-8">
            {lang === "ar"
              ? "تم تسجيل الدخول ولكن هذا الحساب غير مصرح له باستخدام لوحة التحكم."
              : "You are signed in, but this account is not authorized to access the admin portal."}
          </p>
          <button
            onClick={onLogout}
            className="bg-zinc-900 text-white py-4 px-8 rounded-3xl font-bold uppercase tracking-widest btn-3d btn-3d-zinc"
          >
            {lang === "ar" ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <Armchair className="w-14 h-14 text-accent-tan mx-auto mb-5" />
        <h2 className="heading-accent text-4xl md:text-5xl font-light">
          {t.welcome}
        </h2>
        <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-2xl mx-auto">
          {t.enterCreds}
        </p>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-[2.5rem] p-10 md:p-12 shadow-2xl login-panel"
      >
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          onSubmit={onSubmit}
          className="space-y-8"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">
              {t.adminUser}
            </label>
            <input
              required
              className="w-full px-6 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400 px-1 tracking-[0.2em]">
              {t.passphrase}
            </label>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                className="w-full ps-12 pe-5 py-5 text-base md:text-lg bg-white/60 border border-black/10 rounded-3xl shadow-sm"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
              />
              <button
                type="button"
                onClick={onToggleShowPassword}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              >
                {showPassword ? (
                  <EyeOff className="w-6 h-6" />
                ) : (
                  <Eye className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
          <button
            disabled={isLoading}
            type="submit"
            className="w-full bg-zinc-900 text-white py-5 rounded-3xl font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 group text-lg btn-3d btn-3d-zinc"
          >
            {isLoading ? t.authenticating : t.adminAccess}{" "}
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.form>
      </motion.div>
    </div>
  );
};