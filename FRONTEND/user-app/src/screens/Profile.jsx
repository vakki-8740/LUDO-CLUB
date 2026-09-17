import React from 'react';
import { TopBar } from '../components/ui.jsx';

export default function Profile({ profile, uid, toast, go, onLogout }) {
  const logo = profile.profileLogo || profile.photoURL;

  async function editName() {
    const name = prompt('Enter new name:', profile.name || '');
    if (name && name.trim()) {
      try {
        const res = await fetch('https://php-vakki-8740.wasmer.app/wallet.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, action: 'set', amount: profile.balance || 0 }),
        });
        toast('Name updated!', '#34c759');
      } catch (e) {
        toast('Error: ' + e.message, '#ff3b30');
      }
    }
  }

  function logout() {
    localStorage.removeItem('lrc_user');
    onLogout();
  }

  return (
    <div id="profile-section" className="section active">
      <TopBar title="Profile" onBack={() => go('home')} />
      <div className="profile-card">
        <div className="profile-avatar">
          {logo ? (
            <img src={logo} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
          ) : (
            <span>{(profile.name || '?')[0].toUpperCase()}</span>
          )}
        </div>
        <h2 className="profile-name">{profile.name || 'Player'}</h2>
        <div className="profile-id">ID: {profile.uid || uid}</div>
      </div>

      <div className="profile-actions">
        <div className="pa-item" onClick={editName}>
          <i className="fas fa-user-edit"></i>
          <span>Edit Name</span>
          <i className="fas fa-chevron-right"></i>
        </div>
        <div className="pa-item" onClick={() => go('kyc')}>
          <i className="fas fa-id-card"></i>
          <span>KYC Verification</span>
          <i className="fas fa-chevron-right"></i>
        </div>
        <div className="pa-item" onClick={() => go('history')}>
          <i className="fas fa-history"></i>
          <span>Transaction History</span>
          <i className="fas fa-chevron-right"></i>
        </div>
        <div className="pa-item" onClick={() => go('referral')}>
          <i className="fas fa-gift"></i>
          <span>Referral</span>
          <i className="fas fa-chevron-right"></i>
        </div>
        <div className="pa-item" onClick={() => go('support')}>
          <i className="fas fa-headset"></i>
          <span>Support</span>
          <i className="fas fa-chevron-right"></i>
        </div>
        <div className="pa-item" onClick={logout} style={{ color: '#ff3b30' }}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
}
