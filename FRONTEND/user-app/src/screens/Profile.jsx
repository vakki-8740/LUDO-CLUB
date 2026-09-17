import React, { useState } from 'react';
import { TopBar } from '../components/ui.jsx';
import { winAmount } from './Wallet.jsx';
import { logoutAll } from './Login.jsx';

const BACKEND_URL = 'https://php-vakki-8740.wasmer.app';

// SVG Icons
const EditIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const UserSvgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const PhoneSvgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);

const LockSvgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const KycSvgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff9500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

const HistorySvgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const GiftSvgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#af52de" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12"/>
    <rect x="2" y="7" width="20" height="5"/>
    <line x1="12" y1="22" x2="12" y2="7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);

const SupportSvgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c7be" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const LogoutSvgIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function Profile({ profile, uid, toast, go, onLogout }) {
  const [showDetails, setShowDetails] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);
  const logo = profile.profile_logo || profile.profileLogo || profile.photoURL;

  async function saveName() {
    const newName = editName.trim();
    if (!newName) return toast('Name dalo', '#ff3b30');
    if (newName === (profile.name || '')) { setShowDetails(false); return; }

    setSaving(true);
    try {
      const res = await fetch(BACKEND_URL + '/update-profile.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, name: newName }),
      });
      const data = await res.json();
      if (data.success) {
        toast('Name updated!', '#34c759');
        // LocalStorage update
        const saved = JSON.parse(localStorage.getItem('lrc_user') || '{}');
        saved.name = newName;
        localStorage.setItem('lrc_user', JSON.stringify(saved));
        window.location.reload();
      } else {
        toast(data.error || 'Update failed', '#ff3b30');
      }
    } catch (e) {
      toast('Network error', '#ff3b30');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    logoutAll();
    onLogout();
  }

  // Personal Details Popup
  if (showDetails) {
    return (
      <div className="section active" style={{ background: '#fff' }}>
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowDetails(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1c1c1e', margin: 0 }}>Edit Personal Details</h2>
        </div>

        <div style={{ padding: 20 }}>
          {/* Username - Editable */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,122,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserSvgIcon />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#636366' }}>Username</div>
                <div style={{ fontSize: 11, color: '#8e8e93' }}>Edit kar sakte ho</div>
              </div>
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 15, fontWeight: 500,
                color: '#1c1c1e', background: '#f2f2f7', border: 'none',
                borderRadius: 12, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Mobile - Not Editable */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(142,142,147,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PhoneSvgIcon />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#636366' }}>Mobile Number</div>
                <div style={{ fontSize: 11, color: '#8e8e93' }}>Edit nahi kar sakte</div>
              </div>
            </div>
            <div style={{
              width: '100%', padding: '14px 16px', fontSize: 15, fontWeight: 500,
              color: '#8e8e93', background: '#f2f2f7', borderRadius: 12,
              boxSizing: 'border-box'
            }}>
              {profile?.mobile || '---'}
            </div>
          </div>

          {/* Password - Not Editable */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(142,142,147,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockSvgIcon />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#636366' }}>Password</div>
                <div style={{ fontSize: 11, color: '#8e8e93' }}>Support se contact karo</div>
              </div>
            </div>
            <div style={{
              width: '100%', padding: '14px 16px', fontSize: 15, fontWeight: 500,
              color: '#8e8e93', background: '#f2f2f7', borderRadius: 12,
              boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span>••••••••</span>
              <span style={{ fontSize: 12, color: '#007aff', cursor: 'pointer' }} onClick={() => go('support')}>Change via Support</span>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveName}
            disabled={saving || !editName.trim() || editName.trim() === (profile.name || '')}
            style={{
              width: '100%', padding: 16, fontSize: 16, fontWeight: 700,
              color: '#fff', background: '#007aff', border: 'none',
              borderRadius: 14, cursor: 'pointer', opacity: (saving || !editName.trim() || editName.trim() === (profile.name || '')) ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {saving ? 'Saving...' : <><CheckIcon /> Save Changes</>}
          </button>
        </div>
      </div>
    );
  }

  // Profile Main Page
  return (
    <div id="profile-section" className="section active">
      <TopBar title="Profile" onBack={() => go('home')} />
      <div className="profile-card">
        <div className="profile-avatar">
          {logo ? (
            <img src={logo} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
          ) : (
            (profile.name || '?')[0].toUpperCase()
          )}
        </div>
        <div className="profile-name">{profile.name || 'User'}</div>
        <div className="profile-id">ID: {profile.userId || profile.uid || '---'}</div>
      </div>

      <div className="profile-stats-card">
        <div className="p-stat">
          <div className="p-stat-icon green"><i className="fas fa-arrow-down"></i></div>
          <span className="p-stat-label">Deposit</span>
          <strong>₹{profile.total_deposit || profile.totalDeposit || 0}</strong>
        </div>
        <div className="p-stat-divider"></div>
        <div className="p-stat">
          <div className="p-stat-icon red"><i className="fas fa-arrow-up"></i></div>
          <span className="p-stat-label">Withdraw</span>
          <strong>₹{profile.total_withdraw || profile.totalWithdraw || 0}</strong>
        </div>
        <div className="p-stat-divider"></div>
        <div className="p-stat">
          <div className="p-stat-icon orange"><i className="fas fa-trophy"></i></div>
          <span className="p-stat-label">Win</span>
          <strong>₹{winAmount(profile)}</strong>
        </div>
      </div>

      <div className="profile-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Edit Personal Details */}
        <div className="pa-item" onClick={() => { setEditName(profile.name || ''); setShowDetails(true); }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(0,122,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <EditIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Personal Details</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Username edit karo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>

        {/* KYC */}
        <div className="pa-item" onClick={() => go('kyc')}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,149,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <KycSvgIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>KYC Verification</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aadhaar + mobile submit karo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>

        {/* History */}
        <div className="pa-item" onClick={() => go('history')}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <HistorySvgIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Transaction History</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Saari transactions dekho</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>

        {/* Referral */}
        <div className="pa-item" onClick={() => go('referral')}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(175,82,222,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GiftSvgIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Referral</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Doston ko invite karo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>

        {/* Support */}
        <div className="pa-item" onClick={() => go('support')}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(0,199,190,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SupportSvgIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Support</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Help chahiye?</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>

        {/* Logout */}
        <div className="pa-item" onClick={logout}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(255,59,48,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <LogoutSvgIcon />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Logout</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account se bahar niklo</div>
          </div>
          <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)' }}></i>
        </div>
      </div>
    </div>
  );
}
