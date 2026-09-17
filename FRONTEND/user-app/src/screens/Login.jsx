import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

export default function Login({ toast }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);

  // Login fields
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
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
      const fakeEmail = mobile + '@lrc.app';
      await signInWithEmailAndPassword(auth, fakeEmail, pass);
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

    // Check if mobile already registered
    setBusy(true);
    try {
      const existCheck = await getDocs(query(collection(db, 'users'), where('mobile', '==', mobile)));
      if (!existCheck.empty) {
        toast('Ye mobile number pehle se registered hai. Login karo.', '#ff3b30');
        setBusy(false);
        return;
      }

      const fakeEmail = mobile + '@lrc.app';
      const cred = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
      const uid = cred.user.uid;
      const userId = generateUserId();

      let referredBy = '';
      if (referral) {
        const refSnap = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referral)));
        if (!refSnap.empty) {
          referredBy = referral;
        }
      }

      await setDoc(doc(db, 'users', uid), {
        name,
        mobile,
        userId,
        balance: 0,
        totalDeposit: 0,
        totalWithdraw: 0,
        totalWin: 0,
        status: 'active',
        referralCode: userId,
        referredBy: referredBy || '',
        referralCommission: 0,
        kycStatus: 'none',
        createdAt: new Date().toISOString(),
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
      <div id="login-page" className="page">
        <div className="login-container">
          <div className="login-logo">
            <img
              src="./logo.png"
              alt="Ludo Royal Club"
              style={{ width: 90, height: 90, borderRadius: 22, objectFit: 'cover', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
            />
            <h1 style={{ fontSize: 22 }}>Create Account</h1>
          </div>
          <div className="login-form">
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Username"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <input
                type="tel"
                placeholder="Mobile Number"
                value={regMobile}
                onChange={(e) => setRegMobile(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={10}
                inputMode="numeric"
                style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <input
                type="password"
                placeholder="Set Password"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Referral Code (Optional)"
                value={regReferral}
                onChange={(e) => setRegReferral(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
              />
            </div>
            <button className="login-btn" onClick={handleRegister} disabled={busy}
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', marginBottom: 12 }}>
              {busy ? 'Creating Account...' : 'Register'}
            </button>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              Already have account?{' '}
              <span style={{ color: '#fff', fontWeight: 700, cursor: 'pointer' }} onClick={() => setMode('login')}>
                Login
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN
  return (
    <div id="login-page" className="page">
      <div className="login-container">
        <div className="login-logo">
          <img
            src="./logo.png"
            alt="Ludo Royal Club"
            style={{ width: 110, height: 110, borderRadius: 28, objectFit: 'cover', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
          />
          <h1>Ludo Royal Club</h1>
          <p>Play &amp; Win Real Money</p>
        </div>
        <div className="login-form">
          <div style={{ marginBottom: 12 }}>
            <input
              type="tel"
              placeholder="Mobile Number"
              value={loginMobile}
              onChange={(e) => setLoginMobile(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={10}
              inputMode="numeric"
              style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', fontSize: 15, border: 'none', borderRadius: 12, outline: 'none', boxSizing: 'border-box', background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            />
          </div>
          <button className="login-btn" onClick={handleLogin} disabled={busy}
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', marginBottom: 12 }}>
            {busy ? 'Logging in...' : 'Login'}
          </button>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            New user?{' '}
            <span style={{ color: '#fff', fontWeight: 700, cursor: 'pointer' }} onClick={() => setMode('register')}>
              Register
            </span>
          </p>
        </div>
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
