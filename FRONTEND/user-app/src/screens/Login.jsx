import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

export default function Login({ toast }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [loginMobile, setLoginMobile] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regReferral, setRegReferral] = useState('');

  function generateUserId() {
    return String(Math.floor(10000 + Math.random() * 90000));
  }

  async function handleLogin() {
    const mobile = loginMobile.trim();
    const pass = loginPass.trim();
    if (!mobile || mobile.length !== 10) return toast('10 digit mobile number dalo', '#ff3b30');
    if (!pass) return toast('Password dalo', '#ff3b30');

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, mobile + '@lrc.app', pass);
      toast('Login ho gaya!', '#34c759');
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/user-not-found') toast('Account nahi mila. Pehle register karo.', '#ff3b30');
      else if (code === 'auth/wrong-password') toast('Galat password', '#ff3b30');
      else if (code === 'auth/invalid-credential') toast('Mobile ya password galat hai', '#ff3b30');
      else toast('Login failed: ' + (err.message || ''), '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    const name = regName.trim();
    const mobile = regMobile.trim();
    const pass = regPass.trim();
    const referral = regReferral.trim();

    if (!name) return toast('Username dalo', '#ff3b30');
    if (!mobile || mobile.length !== 10) return toast('10 digit mobile number dalo', '#ff3b30');
    if (!pass || pass.length < 4) return toast('Password kam se kam 4 characters ka ho', '#ff3b30');

    setBusy(true);
    try {
      const existCheck = await getDocs(query(collection(db, 'users'), where('mobile', '==', mobile)));
      if (!existCheck.empty) {
        toast('Ye mobile number pehle se registered hai. Login karo.', '#ff3b30');
        setBusy(false);
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, mobile + '@lrc.app', pass);
      const uid = cred.user.uid;
      const userId = generateUserId();

      let referredBy = '';
      if (referral) {
        const refSnap = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referral)));
        if (!refSnap.empty) referredBy = referral;
      }

      await setDoc(doc(db, 'users', uid), {
        name, mobile, userId, balance: 0, totalDeposit: 0, totalWithdraw: 0, totalWin: 0,
        status: 'active', referralCode: userId, referredBy: referredBy || '',
        referralCommission: 0, kycStatus: 'none', createdAt: new Date().toISOString(),
      });

      toast('Account ban gaya! Login karo.', '#34c759');
      setMode('login');
      setLoginMobile(mobile);
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') toast('Ye mobile pehle se registered hai', '#ff3b30');
      else toast('Register failed: ' + (err.message || ''), '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  // REGISTER
  if (mode === 'register') {
    return (
      <div className="nl-page">
        <div className="nl-top">
          <img src="./logo.png" alt="LRC" className="nl-logo-lg" />
          <h1 className="nl-title">Create Account</h1>
          <p className="nl-sub">Register to start playing</p>
        </div>

        <div className="nl-center">
          <div className="nl-card">
            <input type="text" placeholder="Username" value={regName}
              onChange={(e) => setRegName(e.target.value)} className="nl-input" />

            <input type="tel" placeholder="Mobile Number" value={regMobile}
              onChange={(e) => setRegMobile(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={10} inputMode="numeric" className="nl-input" />

            <div className="nl-pass-wrap">
              <input type={showPass ? 'text' : 'password'} placeholder="Set Password" value={regPass}
                onChange={(e) => setRegPass(e.target.value)} className="nl-input nl-pass-input" />
              <button type="button" className="nl-eye" onClick={() => setShowPass(!showPass)}>
                {showPass ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            <input type="tel" placeholder="Referral Code (Optional)" value={regReferral}
              onChange={(e) => setRegReferral(e.target.value.replace(/[^0-9]/g, ''))}
              className="nl-input" />
          </div>
        </div>

        <div className="nl-bottom">
          <button className="nl-btn-primary" onClick={handleRegister} disabled={busy}>
            {busy ? 'Creating...' : 'Create Account'}
          </button>
          <button className="nl-btn-secondary" onClick={() => { setMode('login'); setShowPass(false); }}>
            Login
          </button>
        </div>
      </div>
    );
  }

  // LOGIN
  return (
    <div className="nl-page">
      <div className="nl-top">
        <img src="./logo.png" alt="LRC" className="nl-logo-lg" />
        <h1 className="nl-title">Ludo Royal Club</h1>
        <p className="nl-sub">Login to continue playing</p>
      </div>

      <div className="nl-center">
        <div className="nl-card">
          <input type="tel" placeholder="Mobile Number" value={loginMobile}
            onChange={(e) => setLoginMobile(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={10} inputMode="numeric" className="nl-input" />

          <div className="nl-pass-wrap">
            <input type={showPass ? 'text' : 'password'} placeholder="Password" value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)} className="nl-input nl-pass-input" />
            <button type="button" className="nl-eye" onClick={() => setShowPass(!showPass)}>
              {showPass ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="nl-bottom">
        <button className="nl-btn-primary" onClick={handleLogin} disabled={busy}>
          {busy ? 'Logging in...' : 'Login'}
        </button>
        <button className="nl-btn-secondary" onClick={() => { setMode('register'); setShowPass(false); }}>
          Create Account
        </button>
      </div>
    </div>
  );
}

export async function logoutAll() {
  try {
    const { signOut } = await import('firebase/auth');
    const { auth } = await import('../firebase.js');
    await signOut(auth);
  } catch (e) {}
}
