import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authAPI, walletAPI } from "../api/client";

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  // Account state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: false,
  });

  // Wallet state
  const [wallet, setWallet] = useState({ balance: 0, reserved: 0, available: 0, intradayLeverage: 5 });
  const [walletAmount, setWalletAmount] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [walletError, setWalletError] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const requestedTab = query.get("tab");
    if (requestedTab === "wallet") {
      setActiveTab("wallet");
    }
  }, [location.search]);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await authAPI.me();
        setProfile({ name: data.user.name || "", email: data.user.email || "" });
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    };
    fetchProfile();
  }, []);

  // Fetch wallet
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const data = await walletAPI.getWallet();
        setWallet(data.wallet || { balance: 0, reserved: 0, available: 0, intradayLeverage: 5 });
      } catch {
        // Keep defaults on error
      }
    };
    fetchWallet();
  }, []);

  // Load notifications from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("notificationSettings");
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
      } catch {
        // Use defaults
      }
    }
  }, []);

  const handleProfileUpdate = async () => {
    setProfileMessage("");
    setProfileError("");
    if (!profile.name.trim()) {
      setProfileError("Name is required");
      return;
    }
    try {
      setLoading(true);
      await authAPI.updateProfile(profile.name);
      setProfileMessage("Profile updated successfully");
      setProfileEditing(false);
    } catch (err) {
      setProfileError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setAccountMessage("");
    setAccountError("");
    if (!currentPassword || !newPassword) {
      setAccountError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setAccountError("Password must be at least 6 characters");
      return;
    }
    try {
      setLoading(true);
      await authAPI.changePassword(currentPassword, newPassword);
      setAccountMessage("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setAccountError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationsUpdate = () => {
    localStorage.setItem("notificationSettings", JSON.stringify(notifications));
    setProfileMessage("Notification settings updated");
    setTimeout(() => setProfileMessage(""), 3000);
  };

  const handleAddFunds = async () => {
    setWalletError("");
    setWalletMessage("");
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWalletError("Enter a valid amount");
      return;
    }
    try {
      setWalletLoading(true);
      const data = await walletAPI.addFunds(amount);
      setWallet(data.wallet);
      setWalletAmount("");
      setWalletMessage(`₹${amount.toFixed(2)} added successfully`);
    } catch (err) {
      setWalletError(err.message || "Failed to add funds");
    } finally {
      setWalletLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      setAccountError("Type DELETE to confirm");
      return;
    }
    try {
      setDeleteLoading(true);
      await authAPI.deleteAccount();
      localStorage.clear();
      navigate("/login");
    } catch (err) {
      setAccountError(err.message || "Failed to delete account");
    } finally {
      setDeleteLoading(false);
    }
  };

  const tabButtonClass = (tab) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
      activeTab === tab
        ? "bg-blue-600 text-white"
        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
    }`;

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen px-6 py-10">
      <h2 className="text-3xl font-semibold mb-6">Settings</h2>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button className={tabButtonClass("profile")} onClick={() => setActiveTab("profile")}>
          👤 Profile Settings
        </button>
        <button className={tabButtonClass("account")} onClick={() => setActiveTab("account")}>
          🔐 Account Settings
        </button>
        <button className={tabButtonClass("notifications")} onClick={() => setActiveTab("notifications")}>
          🔔 Notification Settings
        </button>
        <button className={tabButtonClass("billing")} onClick={() => setActiveTab("billing")}>
          💳 Subscription / Billing
        </button>
        <button className={tabButtonClass("wallet")} onClick={() => setActiveTab("wallet")}>
          💰 Wallet
        </button>
        <button className={tabButtonClass("danger")} onClick={() => setActiveTab("danger")}>
          ⚠️ Danger Zone
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        {/* Profile Settings */}
        {activeTab === "profile" && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Profile Settings</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block mb-1 text-sm text-gray-300">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  disabled={!profileEditing}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 disabled:opacity-60"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm text-gray-300">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full bg-gray-900 border border-gray-700 text-gray-400 rounded-md p-2 opacity-60"
                  placeholder="Email cannot be changed"
                />
              </div>
              {profileMessage && <p className="text-sm text-emerald-400">{profileMessage}</p>}
              {profileError && <p className="text-sm text-red-400">{profileError}</p>}
              <div className="flex gap-2">
                {!profileEditing ? (
                  <button
                    onClick={() => setProfileEditing(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleProfileUpdate}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md disabled:bg-gray-600"
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      onClick={() => setProfileEditing(false)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Account Settings */}
        {activeTab === "account" && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Account Settings</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block mb-1 text-sm text-gray-300">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm text-gray-300">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm text-gray-300">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2"
                  placeholder="Confirm new password"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="twoFactor"
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  className="cursor-pointer"
                />
                <label htmlFor="twoFactor" className="text-sm text-gray-300 cursor-pointer">
                  Enable Two-Factor Authentication
                </label>
              </div>
              {accountMessage && <p className="text-sm text-emerald-400">{accountMessage}</p>}
              {accountError && <p className="text-sm text-red-400">{accountError}</p>}
              <button
                onClick={handlePasswordChange}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:bg-gray-600"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === "notifications" && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Notification Settings</h3>
            <div className="space-y-3 max-w-md">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emailAlerts"
                  checked={notifications.emailAlerts}
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailAlerts: e.target.checked })
                  }
                  className="cursor-pointer"
                />
                <label htmlFor="emailAlerts" className="text-sm text-gray-300 cursor-pointer">
                  📧 Email Alerts
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="smsAlerts"
                  checked={notifications.smsAlerts}
                  onChange={(e) =>
                    setNotifications({ ...notifications, smsAlerts: e.target.checked })
                  }
                  className="cursor-pointer"
                />
                <label htmlFor="smsAlerts" className="text-sm text-gray-300 cursor-pointer">
                  📱 SMS Alerts
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pushNotifications"
                  checked={notifications.pushNotifications}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      pushNotifications: e.target.checked,
                    })
                  }
                  className="cursor-pointer"
                />
                <label htmlFor="pushNotifications" className="text-sm text-gray-300 cursor-pointer">
                  🔔 Push Notifications
                </label>
              </div>
              <button
                onClick={handleNotificationsUpdate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}

        {/* Billing */}
        {activeTab === "billing" && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Subscription / Billing</h3>
            <div className="max-w-md space-y-4">
              <div className="bg-gray-900 border border-gray-700 rounded-md p-4">
                <p className="text-sm text-gray-400">Current Plan</p>
                <p className="text-2xl font-bold text-emerald-400">Free</p>
                <p className="text-xs text-gray-500 mt-1">Unlimited paper trading • No premium features</p>
              </div>
              <div>
                <label className="block mb-1 text-sm text-gray-300">Upgrade Plan</label>
                <select className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2">
                  <option>Free - ₹0/mo</option>
                  <option>Pro - ₹199/mo (Advanced Analytics)</option>
                  <option>Enterprise - ₹499/mo (API Access)</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">
                💡 All users get unlimited paper trading and full market data access.
              </p>
            </div>
          </div>
        )}

        {/* Wallet */}
        {activeTab === "wallet" && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Wallet</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <WalletStat label="Balance" value={wallet.balance} />
              <WalletStat label="Reserved" value={wallet.reserved} />
              <WalletStat label="Available" value={wallet.available} />
            </div>
            <p className="text-sm text-gray-400 mb-4">Intraday leverage: {wallet.intradayLeverage}x</p>
            <div className="space-y-3 max-w-md">
              <div>
                <label className="block mb-1 text-sm text-gray-300">Add Funds (₹)</label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2"
                />
              </div>
              <button
                disabled={walletLoading}
                onClick={handleAddFunds}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md disabled:bg-gray-600"
              >
                {walletLoading ? "Adding..." : "Add Funds"}
              </button>
              {walletMessage && <p className="text-sm text-emerald-400">{walletMessage}</p>}
              {walletError && <p className="text-sm text-red-400">{walletError}</p>}
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {activeTab === "danger" && (
          <div>
            <h3 className="text-xl font-semibold mb-4 text-red-500">⚠️ Danger Zone</h3>
            <p className="text-gray-400 mb-6">These actions are irreversible. Please proceed with caution.</p>
            <div className="space-y-6 max-w-md">
              <div className="bg-red-900/20 border border-red-800 rounded-md p-4">
                <h4 className="font-semibold text-red-400 mb-2">Delete Account Permanently</h4>
                <p className="text-sm text-gray-400 mb-4">
                  This will delete your account, all holdings, and trading history. This cannot be undone.
                </p>
                <input
                  type="text"
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="w-full bg-gray-900 border border-red-700 text-gray-200 rounded-md p-2 mb-2 placeholder-gray-600"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirm !== "DELETE"}
                  className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md disabled:bg-gray-600 disabled:opacity-50"
                >
                  {deleteLoading ? "Deleting..." : "Delete Account"}
                </button>
                {accountError && <p className="text-sm text-red-400 mt-2">{accountError}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const WalletStat = ({ label, value }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-md p-3">
    <p className="text-xs text-gray-400">{label}</p>
    <p className="text-lg font-bold text-white">₹{Number(value || 0).toFixed(2)}</p>
  </div>
);

/* Reusable Components */
const Input = ({ label, type = "text", placeholder, value, onChange }) => (
  <div>
    <label className="block mb-1 text-sm text-gray-300">{label}</label>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
    />
  </div>
);

const Checkbox = ({ label, defaultChecked = false }) => (
  <label className="flex items-center space-x-2 text-gray-300">
    <input
      type="checkbox"
      defaultChecked={defaultChecked}
      className="w-4 h-4 accent-blue-600"
    />
    <span>{label}</span>
  </label>
);

const SaveButton = ({ text = "Save Changes" }) => (
  <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
    {text}
  </button>
);
