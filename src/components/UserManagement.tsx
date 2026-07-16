import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  UserPlus, 
  Trash2, 
  Shield, 
  Key, 
  AlertTriangle, 
  Check, 
  X, 
  Users, 
  Mail, 
  Settings, 
  Eye, 
  EyeOff 
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase, supabaseAdmin } from "../lib/supabase";

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  created_at: string;
}

interface UserManagementProps {
  lang: "en" | "ar";
  currentUserProfile: any;
}

const AVAILABLE_PERMISSIONS = [
  { key: "contracts.upload", ar: "رفع التعاقدات", en: "Upload Contracts" },
  { key: "contracts.edit", ar: "تعديل وحذف التعاقدات", en: "Edit/Delete Contracts" },
  { key: "production.view", ar: "عرض الإنتاج والمراحل", en: "View Production & Stages" },
  { key: "production.edit", ar: "تعديل مراحل الإنتاج والعملاء", en: "Edit Production & Customers" },
  { key: "production.alexandria", ar: "الوصول لإنتاج الإسكندرية", en: "Access Alexandria Production" },
  { key: "production.cairo", ar: "الوصول لإنتاج القاهرة", en: "Access Cairo Production" },
  { key: "users.manage", ar: "إدارة المستخدمين والصلاحيات", en: "Manage Users & Permissions" },
  { key: "reports.view", ar: "عرض التقارير والجداول المنشورة", en: "View Reports & Published Sheets" },
];

const ROLES = [
  { key: "super_admin", ar: "مسؤول خارق (Super Admin)", en: "Super Admin" },
  { key: "contract_admin", ar: "مسؤول تعاقدات (Contract Admin)", en: "Contract Admin" },
  { key: "moderator", ar: "مراقب عام (Moderator)", en: "General Moderator" },
  { key: "production_alexandria", ar: "إنتاج الإسكندرية (Alexandria Production)", en: "Alexandria Production" },
  { key: "production_cairo", ar: "إنتاج القاهرة (Cairo Production)", en: "Cairo Production" },
];

export const UserManagement: React.FC<UserManagementProps> = ({ lang, currentUserProfile }) => {
  const isAr = lang === "ar";
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Form state for creating new user
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState("moderator");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  const fetchUsers = async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error("Failed to fetch user profiles:", err);
      toast.error(isAr ? "فشل تحميل المستخدمين" : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isOnline]);

  const handleRoleChange = (roleKey: string) => {
    setSelectedRole(roleKey);
    // Assign default permissions for the role
    if (roleKey === "super_admin") {
      setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.key));
    } else if (roleKey === "contract_admin") {
      setSelectedPermissions(["contracts.upload", "production.view"]);
    } else if (roleKey === "moderator") {
      setSelectedPermissions(["production.view", "production.alexandria", "production.cairo"]);
    } else if (roleKey === "production_alexandria") {
      setSelectedPermissions(["production.view", "production.alexandria"]);
    } else if (roleKey === "production_cairo") {
      setSelectedPermissions(["production.view", "production.cairo"]);
    }
  };

  const togglePermission = (permissionKey: string) => {
    if (selectedPermissions.includes(permissionKey)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== permissionKey));
    } else {
      setSelectedPermissions([...selectedPermissions, permissionKey]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      toast.error(isAr ? "يجب أن تكون متصلاً بالإنترنت" : "Must be online");
      return;
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password) {
      toast.error(isAr ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create auth user in Supabase Auth using supabaseAdmin
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
      });

      if (authError) throw authError;

      const newUser = authData.user;
      if (!newUser) throw new Error("Auth user creation returned null");

      // 2. Insert into public.user_profiles
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          id: newUser.id,
          username: cleanUsername,
          email: cleanEmail,
          role: selectedRole,
          permissions: selectedPermissions,
        });

      if (profileError) {
        // Rollback auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(newUser.id);
        throw profileError;
      }

      toast.success(isAr ? "تم إنشاء المستخدم بنجاح" : "User created successfully");
      setShowAddModal(false);
      setUsername("");
      setEmail("");
      setPassword("");
      setSelectedRole("moderator");
      setSelectedPermissions([]);
      fetchUsers();
    } catch (err: any) {
      console.error("Create user error:", err);
      toast.error(err.message || (isAr ? "فشل إنشاء المستخدم" : "Failed to create user"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!isOnline) {
      toast.error(isAr ? "يجب أن تكون متصلاً بالإنترنت" : "Must be online");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          role: editingUser.role,
          permissions: editingUser.permissions,
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast.success(isAr ? "تم تحديث صلاحيات المستخدم" : "User permissions updated");
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error("Update user error:", err);
      toast.error(err.message || (isAr ? "فشل تحديث الصلاحيات" : "Failed to update user"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (userToDelete.id === currentUserProfile?.id) {
      toast.error(isAr ? "لا يمكنك حذف حسابك الحالي" : "You cannot delete your own account");
      return;
    }
    const confirmMsg = isAr 
      ? `هل أنت متأكد من حذف الحساب "${userToDelete.username}"؟ سيؤدي ذلك لحذفه نهائياً.`
      : `Are you sure you want to delete user "${userToDelete.username}"? This cannot be undone.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      // Delete from Auth which cascades to profiles
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
      if (error) throw error;

      toast.success(isAr ? "تم حذف المستخدم" : "User deleted");
      fetchUsers();
    } catch (err: any) {
      console.error("Delete user error:", err);
      toast.error(err.message || (isAr ? "فشل حذف المستخدم" : "Failed to delete user"));
    }
  };

  if (!isOnline) {
    return (
      <div className="glass rounded-[2.5rem] py-20 text-center border border-white/40">
        <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-2xl font-bold text-zinc-900 mb-2">
          {isAr ? "أنت غير متصل بالإنترنت" : "You are offline"}
        </h3>
        <p className="text-zinc-500 max-w-md mx-auto">
          {isAr 
            ? "إدارة المستخدمين والصلاحيات تتطلب اتصالاً مباشراً بقاعدة البيانات السحابية. يرجى التحقق من اتصالك بالإنترنت." 
            : "User management requires a live connection to the cloud database. Please verify your connection."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-light text-zinc-950 flex items-center gap-3">
            <Users className="w-8 h-8 text-accent-tan" />
            {isAr ? "إدارة المستخدمين" : "User Management"}
          </h1>
          <p className="text-zinc-500 mt-1">
            {isAr 
              ? "إنشاء وإدارة حسابات الموظفين والصلاحيات الدقيقة" 
              : "Create and manage employee accounts and detailed permissions"}
          </p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
            handleRoleChange("moderator");
          }}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-3 rounded-2xl text-sm font-bold uppercase transition-all duration-200 shadow-md active:scale-95 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          {isAr ? "إضافة مستخدم جديد" : "Add New User"}
        </button>
      </div>

      {/* Users List */}
      <div className="glass rounded-[2.5rem] p-6 shadow-xl border border-white/40 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-4 border-accent-tan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400 font-semibold">{isAr ? "جاري تحميل البيانات..." : "Loading data..."}</p>
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right table-zebra">
              <thead>
                <tr className="bg-zinc-900 text-white text-xs uppercase font-bold tracking-wider">
                  <th className="p-4 ltr:text-left rtl:text-right">{isAr ? "اسم المستخدم" : "Username"}</th>
                  <th className="p-4 ltr:text-left rtl:text-right">{isAr ? "البريد الإلكتروني" : "Email"}</th>
                  <th className="p-4 text-center">{isAr ? "الدور" : "Role"}</th>
                  <th className="p-4 text-center">{isAr ? "الصلاحيات النشطة" : "Permissions"}</th>
                  <th className="p-4 text-center">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const roleObj = ROLES.find((r) => r.key === u.role);
                  return (
                    <tr key={u.id} className="border-b border-zinc-100 hover:bg-white/60 transition-colors">
                      <td className="p-4 font-bold text-zinc-950 ltr:text-left rtl:text-right">
                        {u.username}
                      </td>
                      <td className="p-4 text-zinc-500 font-mono text-sm ltr:text-left rtl:text-right">
                        {u.email}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-accent-tan/10 text-accent-tan px-3 py-1 rounded-full text-xs font-bold">
                          <Shield className="w-3.5 h-3.5" />
                          {roleObj ? (isAr ? roleObj.ar : roleObj.en) : u.role}
                        </span>
                      </td>
                      <td className="p-4 text-center max-w-xs">
                        <div className="flex flex-wrap justify-center gap-1">
                          {u.permissions.map((p) => {
                            const pObj = AVAILABLE_PERMISSIONS.find((ap) => ap.key === p);
                            return (
                              <span 
                                key={p} 
                                className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-lg text-[9px] font-semibold"
                                title={pObj ? (isAr ? pObj.ar : pObj.en) : p}
                              >
                                {p.split(".")[1]}
                              </span>
                            );
                          })}
                          {u.permissions.length === 0 && (
                            <span className="text-zinc-400 text-xs italic">{isAr ? "لا يوجد" : "None"}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingUser({ ...u })}
                            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition-all active:scale-95 cursor-pointer"
                            title={isAr ? "تعديل الصلاحيات" : "Edit Permissions"}
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-2.5 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-all active:scale-95 cursor-pointer"
                            title={isAr ? "حذف الحساب" : "Delete User"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-400">
            <Users className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            {isAr ? "لا يوجد مستخدمون مسجلون" : "No registered users"}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative z-10 overflow-y-auto max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="absolute top-6 left-6 p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-500 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-2xl font-bold text-zinc-950 mb-6 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-accent-tan" />
                {isAr ? "إضافة حساب موظف جديد" : "Add New Employee Account"}
              </h3>

              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">
                      {isAr ? "اسم المستخدم (Username)" : "Username"} *
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      placeholder="e.g. omar_cairo"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-zinc-400">
                      {isAr ? "البريد الإلكتروني" : "Email"} *
                    </label>
                    <input
                      required
                      type="email"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      placeholder="e.g. omar@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    {isAr ? "كلمة المرور" : "Password"} *
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      className="w-full px-4 py-3 pe-12 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    {isAr ? "الدور الوظيفي الرئيسي" : "Main Job Role"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => handleRoleChange(r.key)}
                        className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                          selectedRole === r.key 
                            ? "bg-zinc-950 text-white border-zinc-950" 
                            : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {isAr ? r.ar : r.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    {isAr ? "صلاحيات الوصول الدقيقة" : "Granular Permissions Access"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    {AVAILABLE_PERMISSIONS.map((p) => {
                      const isSelected = selectedPermissions.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePermission(p.key)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold text-right transition-all ${
                            isSelected 
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isSelected ? "bg-emerald-500 border-emerald-400 text-white" : "border-zinc-300"
                          }`}>
                            {isSelected && "✓"}
                          </span>
                          {isAr ? p.ar : p.en}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-zinc-950 text-white py-4 rounded-2xl font-bold uppercase tracking-wider transition-all hover:bg-zinc-800 active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (isAr ? "جاري الإنشاء..." : "Creating...") : (isAr ? "إنشاء الحساب" : "Create Account")}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Permissions Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-xl p-8 shadow-2xl relative z-10"
            >
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="absolute top-6 left-6 p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-500 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-2xl font-bold text-zinc-950 mb-6 flex items-center gap-2">
                <Shield className="w-6 h-6 text-accent-tan" />
                {isAr ? "تعديل صلاحيات المستخدم" : "Edit User Permissions"}
              </h3>

              <div className="mb-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                <p className="text-sm font-semibold text-zinc-850">
                  {isAr ? "اسم المستخدم: " : "Username: "} <span className="font-bold text-zinc-900">{editingUser.username}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {isAr ? "البريد الإلكتروني: " : "Email: "} {editingUser.email}
                </p>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-6">
                {/* Role */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    {isAr ? "الدور الوظيفي" : "Role"}
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm"
                    value={editingUser.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      let newPerms = editingUser.permissions;
                      if (newRole === "super_admin") {
                        newPerms = AVAILABLE_PERMISSIONS.map((p) => p.key);
                      } else if (newRole === "contract_admin") {
                        newPerms = ["contracts.upload", "production.view"];
                      }
                      setEditingUser({
                        ...editingUser,
                        role: newRole,
                        permissions: newPerms,
                      });
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {isAr ? r.ar : r.en}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Permissions Grid */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-zinc-400">
                    {isAr ? "الصلاحيات النشطة" : "Active Permissions"}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-100 max-h-[40vh] overflow-y-auto">
                    {AVAILABLE_PERMISSIONS.map((p) => {
                      const isSelected = editingUser.permissions.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            const newPerms = isSelected 
                              ? editingUser.permissions.filter((k) => k !== p.key)
                              : [...editingUser.permissions, p.key];
                            setEditingUser({ ...editingUser, permissions: newPerms });
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold text-right transition-all ${
                            isSelected 
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isSelected ? "bg-emerald-500 border-emerald-400 text-white" : "border-zinc-300"
                          }`}>
                            {isSelected && "✓"}
                          </span>
                          {isAr ? p.ar : p.en}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-zinc-950 text-white py-4 rounded-2xl font-bold uppercase tracking-wider transition-all hover:bg-zinc-800 active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (isAr ? "جاري التحديث..." : "Updating...") : (isAr ? "حفظ التغييرات" : "Save Changes")}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
