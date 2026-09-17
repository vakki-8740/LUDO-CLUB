import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { compressPhoto } from '../lib.js';
import { TopBar } from '../components/ui.jsx';

const BACKEND_URL = 'https://php-vakki-8740.wasmer.app';

async function sendPhotoToTelegram(botToken, chatId, photoFile, caption) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('photo', photoFile);
  form.append('caption', caption);
  const res = await fetch('https://api.telegram.org/bot' + botToken + '/sendPhoto', {
    method: 'POST',
    body: form
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.description || 'Telegram send fail');
}

export default function Kyc({ profile, uid, toast, go }) {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobile, setMobile] = useState('');
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [reqId, setReqId] = useState('');
  const [status, setStatus] = useState(profile.kycStatus || 'none');
  const [otpLoading, setOtpLoading] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, 'kyc_requests'), where('userId', '==', uid), limit(5)))
      .then(async (snap) => {
        let latest = null, latestId = '', latestTs = -1;
        snap.forEach((d) => {
          const t = d.data().timestamp;
          const ms = t && t.toMillis ? t.toMillis() : 0;
          if (ms >= latestTs) { latestTs = ms; latest = d.data(); latestId = d.id; }
        });
        if (!latest) return;
        setStatus(latest.status || 'pending');
        if (latest.status === 'pending') setReqId(latestId);
      })
      .catch(() => {});
  }, [uid]);

  function pick(setFile, e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
  }

  // STEP 1: Send OTP
  async function sendOtp() {
    const em = email.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return toast('Sahi email dalo', '#ff3b30');
    }
    setOtpLoading(true);
    try {
      const res = await fetch(BACKEND_URL + '/send-otp.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        toast('OTP sent! Check your email.', '#34c759');
        // Debug ke liye (production mein hata dena)
        if (data.debug_otp) toast('Debug OTP: ' + data.debug_otp, '#007aff');
      } else {
        toast(data.error || 'OTP send failed', '#ff3b30');
      }
    } catch (e) {
      toast('Network error', '#ff3b30');
    } finally {
      setOtpLoading(false);
    }
  }

  // STEP 2: Verify OTP
  async function verifyOtp() {
    const em = email.trim().toLowerCase();
    const code = otp.trim();
    if (code.length !== 4) return toast('4 digit OTP dalo', '#ff3b30');
    try {
      const res = await fetch(BACKEND_URL + '/verify-otp.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, otp: code }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailVerified(true);
        toast('Email verified!', '#34c759');
      } else {
        toast(data.error || 'OTP galat hai', '#ff3b30');
      }
    } catch (e) {
      toast('Network error', '#ff3b30');
    }
  }

  // STEP 3: Submit KYC
  async function submit() {
    if (status === 'pending' || status === 'approved') {
      toast('Tumhari KYC request pehle se hai', '#ff9500');
      return;
    }
    const mob = mobile.replace(/\D/g, '');
    if (mob.length !== 10) return toast('Sahi 10-digit mobile number dalo', '#ff3b30');
    if (!front) return toast('Aadhaar FRONT photo lagao', '#ff3b30');
    if (!back) return toast('Aadhaar BACK photo lagao', '#ff3b30');
    setBusy(true);
    setStep('Photos taiyaar ho rahi hain...');
    try {
      const cfgSnap = await getDoc(doc(db, 'settings', 'kyc_telegram'));
      const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
      if (!cfg.botToken || !cfg.chatId) throw new Error('KYC abhi band hai. Thodi der baad try karo.');
      const [frontSmall, backSmall] = await Promise.all([compressPhoto(front), compressPhoto(back)]);
      setStep('Request bheji ja rahi hai...');
      const head =
        '🪪 KYC DETAILS\n' +
        '🆔 UID: "' + uid + '"\n\n' +
        '👤 Name: ' + (profile.name || 'Player') + '\n\n' +
        '📧 Email: ' + email.trim() + '\n\n' +
        '📱 Mobile: ' + mob + '\n\n' +
        '📄 Aadhaar: ';
      const [reqRef] = await Promise.all([
        (async () => {
          await sendPhotoToTelegram(cfg.botToken, cfg.chatId, frontSmall, head + 'FRONT');
          await sendPhotoToTelegram(cfg.botToken, cfg.chatId, backSmall, head + 'BACK');
          return addDoc(collection(db, 'kyc_requests'), {
            userId: uid,
            userName: profile.name || 'Player',
            email: email.trim(),
            mobile: mob,
            emailVerified: true,
            status: 'pending',
            timestamp: serverTimestamp()
          });
        })()
      ]);
      await Promise.all([
        addDoc(collection(db, 'users', uid, 'mails'), {
          subject: 'KYC Request Sent',
          body: 'Tumhari KYC request bhej di gayi hai. Admin check karega.',
          from: 'Admin',
          read: false,
          kind: 'kyc',
          refId: reqRef.id,
          timestamp: serverTimestamp()
        }),
        updateDoc(doc(db, 'users', uid), { kycStatus: 'pending', email: email.trim() })
      ]);
      setStatus('pending');
      setReqId(reqRef.id);
      toast('KYC submit ho gayi! Admin check karega.', '#34c759');
      setTimeout(() => go('profile'), 1500);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  async function cancelHere() {
    if (!reqId) return;
    if (!confirm('KYC request cancel karein?')) return;
    try {
      await updateDoc(doc(db, 'kyc_requests', reqId), { status: 'cancelled' });
      await updateDoc(doc(db, 'users', uid), { kycStatus: 'none' });
      setStatus('none');
      setReqId('');
      toast('KYC request cancelled', '#ff9500');
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    }
  }

  // Approved
  if (status === 'approved') {
    return (
      <div className="section active">
        <TopBar title="KYC" onBack={() => go('profile')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ margin: '0 auto 12px' }}>
            <circle cx="30" cy="30" r="30" fill="#34c759" opacity="0.12"/>
            <circle cx="30" cy="30" r="22" fill="#34c759"/>
            <path d="M21 31L27 37L40 24" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h3 style={{ color: '#34c759', marginTop: 8 }}>KYC Approved!</h3>
        </div>
      </div>
    );
  }

  // Pending
  if (status === 'pending') {
    return (
      <div className="section active">
        <TopBar title="KYC" onBack={() => go('profile')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <span className="loader-dot" style={{ width: 30, height: 30 }}></span>
          <h3 style={{ marginTop: 12 }}>Request Processing...</h3>
          <p style={{ fontSize: 13, color: '#86868b', marginTop: 6 }}>Admin check karega. Thodi der wait karo.</p>
          <button className="dp-btn" style={{ background: '#ff3b30', marginTop: 16 }} onClick={cancelHere}>
            <i className="fas fa-times"></i> Cancel
          </button>
        </div>
      </div>
    );
  }

  // STEP 1 & 2: Email Verification
  if (!emailVerified) {
    return (
      <div className="section active">
        <TopBar title="KYC Verification" onBack={() => go('profile')} />
        <div className="deposit-page-card" style={{ padding: '24px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none" style={{ margin: '0 auto 12px' }}>
              <rect x="3" y="12" width="44" height="28" rx="4" fill="#667eea"/>
              <path d="M3 16L25 30L47 16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Email Verify Karo</div>
            <div style={{ fontSize: 13, color: '#86868b' }}>OTP aapke email pe aayega</div>
          </div>

          {!otpSent ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="email"
                  placeholder="Email address dalo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '14px 16px', fontSize: 15,
                    border: '2px solid #e5e5ea', borderRadius: 12, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
              <button className="dp-btn" onClick={sendOtp} disabled={otpLoading}>
                {otpLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#636366', marginBottom: 12, textAlign: 'center' }}>
                OTP bhej diya: <strong>{email}</strong>
              </div>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="4 digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={4}
                  style={{
                    width: '100%', padding: '14px 16px', fontSize: 20, fontWeight: 700,
                    letterSpacing: 8, textAlign: 'center',
                    border: '2px solid #e5e5ea', borderRadius: 12, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
              <button className="dp-btn" onClick={verifyOtp} style={{ marginBottom: 10 }}>
                <i className="fas fa-check-circle"></i> Verify OTP
              </button>
              <button
                style={{ background: 'none', border: 'none', color: '#007aff', fontSize: 13, cursor: 'pointer' }}
                onClick={() => { setOtpSent(false); setOtp(''); }}
              >
                Email change karo
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // STEP 3: KYC Form (after email verified)
  return (
    <div className="section active">
      <TopBar title="KYC Verification" onBack={() => go('profile')} />
      <div className="deposit-page-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: '#e8f5e9', borderRadius: 10 }}>
          <i className="fas fa-check-circle" style={{ color: '#34c759' }}></i>
          <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 600 }}>Email verified: {email}</span>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 6 }}>Mobile Number</div>
        <div style={{ marginBottom: 16 }}>
          <input type="tel" placeholder="10-digit mobile number" value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            style={{
              width: '100%', padding: '14px 16px', fontSize: 15,
              border: '2px solid #e5e5ea', borderRadius: 12, outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 6 }}>Aadhaar FRONT Photo</div>
        <label className="dp-btn" style={{ background: front ? '#34c759' : '#667eea', marginBottom: 12 }}>
          <i className={`fas ${front ? 'fa-check-circle' : 'fa-camera'}`}></i> {front ? front.name : 'Photo Lagao'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pick(setFront, e)} />
        </label>

        <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c1e', marginBottom: 6 }}>Aadhaar BACK Photo</div>
        <label className="dp-btn" style={{ background: back ? '#34c759' : '#667eea', marginBottom: 16 }}>
          <i className={`fas ${back ? 'fa-check-circle' : 'fa-camera'}`}></i> {back ? back.name : 'Photo Lagao'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pick(setBack, e)} />
        </label>

        <button className="dp-btn" onClick={submit} disabled={busy}>
          {busy ? step || 'Submitting...' : 'Submit KYC'}
        </button>
      </div>

      {busy && (
        <div className="popup-overlay" style={{ display: 'flex' }}>
          <div className="popup" style={{ textAlign: 'center' }}>
            <span className="loader-dot" style={{ width: 26, height: 26 }}></span>
            <div className="popup-header" style={{ marginTop: 10 }}>KYC Sending...</div>
            <p style={{ fontSize: 13, color: '#86868b' }}>{step}</p>
          </div>
        </div>
      )}
    </div>
  );
}
