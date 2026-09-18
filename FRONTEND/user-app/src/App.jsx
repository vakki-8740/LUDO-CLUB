import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { generateUserId, randomLogo } from './lib.js';
import Login from './screens/Login.jsx';
import Splash from './screens/Splash.jsx';
import Home from './screens/Home.jsx';
import Lobby from './screens/Lobby.jsx';
import Wallet from './screens/Wallet.jsx';
import Deposit from './screens/Deposit.jsx';
import Withdraw from './screens/Withdraw.jsx';
import History from './screens/History.jsx';
import PaymentSuccess from './screens/PaymentSuccess.jsx';
import Kyc from './screens/Kyc.jsx';
import Match from './screens/Match.jsx';
import Profile from './screens/Profile.jsx';
import Referral from './screens/Referral.jsx';
import { Mail } from './screens/MailSupport.jsx';
import { Support } from './screens/Support.jsx';
import QrPage from './screens/QrPage.jsx';
import UtrPage from './screens/UtrPage.jsx';
import InfoPage from './screens/InfoPage.jsx';
import './pagesContent.js';

// Login par HAR user ko ALAG 5-digit random UID (takrao check ke saath)
async function unique5Digit(field) {
  for (let i = 0; i < 20; i++) {
    const v = generateUserId();
    const snap = await getDocs(query(collection(db, 'users'), where(field, '==', v), limit(1)));
    if (snap.empty) return v;
  }
  return generateUserId() + String(Date.now()).slice(-2);
}

async function ensureUserDoc(g) {
  const ref = doc(db, 'users', g.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    if (data.status === 'blocked') throw new Error('Ye account blocked hai. Support se baat karo.');
    return data;
  }
  let referredBy = '';
  try {
    const q = new URLSearchParams(window.location.search).get('ref');
    if (q) referredBy = String(q).trim().slice(0, 20);
  } catch (e) {}
  const data = {
    name: g.displayName || 'Player',
    email: g.email || '',
    photoURL: g.photoURL || '',
    // HAR naye user ko PROFILES-LOGO folder se RANDOM logo (Google photo nahi)
    profileLogo: randomLogo(),
    userId: await unique5Digit('userId'),
    balance: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    totalWin: 0,
    status: 'active',
    referralCode: await unique5Digit('referralCode'),
    referredBy,
    referralCommission: 0,
    kycStatus: 'none',
    createdAt: serverTimestamp()
  };
  await setDoc(ref, data);
  // Welcome mail background me (login wait nahi karega — fast entry)
  (async () => {
    try {
      let msg = 'Welcome ' + data.name + '! Start playing and winning real money. Good luck!';
      const w = await getDoc(doc(db, 'settings', 'welcome'));
      if (w.exists() && w.data().message) msg = w.data().message;
      await addDoc(collection(db, 'users', g.uid, 'mails'), {
        subject: 'Welcome to LUDO KILLER! 🎉',
        body: msg,
        from: 'Admin',
        read: false,
        timestamp: serverTimestamp()
      });
    } catch (e) {}
  })();
  return data;
}

const NAV_INDEX = { home: 0, lobby: 1, wallet: 2, profile: 3 };

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false); // splash jab tak session pata na chale
  const [screen, setScreen] = useState(() => {
    // Page load/refresh pe URL hash se screen restore karo
    const hash = window.location.hash.replace('#', '') || '';
    return hash || 'home';
  });
  const [bets, setBets] = useState([]);
  const [menu, setMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const autoNavRef = useRef('');
  const [installEvt, setInstallEvt] = useState(null);
  const [iosHelp, setIosHelp] = useState(false);

  const isIOS =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

  // Install prompt pakdo (Chrome/Android)
  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault();
      setInstallEvt(e);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function installApp() {
    if (installEvt) {
      installEvt.prompt();
      try {
        await installEvt.userChoice;
      } catch (e) {}
      setInstallEvt(null);
    } else if (isIOS && !isInstalled) {
      setIosHelp(true);
      setMenu(false);
    }
  }

  const canInstall = !!installEvt || (isIOS && !isInstalled);

  const toast = useCallback((msg, bg) => {
    setToastMsg({ msg, bg: bg || 'rgba(28,28,30,0.95)' });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const go = useCallback((s) => {
    setScreen(s);
    setMenu(false);
    document.getElementById('main-content')?.scrollTo(0, 0);
    // URL hash update karo (back button + refresh support)
    if (window.location.hash !== '#' + s) {
      history.pushState(null, '', '#' + s);
    }
  }, []);

  // Back button support: hashchange pe screen restore karo
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '') || 'home';
      setScreen(hash);
      setMenu(false);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Auth + profile — Firebase Auth se auto-login
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        // Firebase user mila — Firestore se profile lo
        try {
          const snap = await import('firebase/firestore').then(m =>
            m.getDoc(m.doc(db, 'users', fbUser.uid))
          );
          if (snap.exists()) {
            const data = { uid: fbUser.uid, ...snap.data() };
            setUser(data);
            setProfile(data);
          } else {
            setUser({ uid: fbUser.uid });
            setProfile(null);
          }
        } catch (e) {
          setUser({ uid: fbUser.uid });
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  // Realtime bets
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      query(collection(db, 'bets'), orderBy('timestamp', 'desc'), limit(100)),
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setBets(arr);
      },
      (err) => console.error('Bets load failed:', err)
    );
    return unsub;
  }, [user]);

  // Live profile — Firestore se realtime
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = { uid: snap.id, ...snap.data() };
        setProfile(data);
      }
    }, () => {});
    return unsub;
  }, [user?.uid]);

  // AUTO-OPEN match page:
  // - Creator: meri waiting bet par koi aaya (joined) -> match page
  // - Joiner: maine join kiya aur room code aa gaya -> match page
  useEffect(() => {
    if (!user || !bets.length) return;
    const mine = bets.find(
      (b) =>
        b.status === 'joined' &&
        (b.creatorId === user.uid || b.joinerId === user.uid) &&
        (b.creatorId === user.uid || b.roomCode)
    );
    if (mine && autoNavRef.current !== mine.id) {
      autoNavRef.current = mine.id;
      setScreen('match:' + mine.id);
      setMenu(false);
    }
  }, [bets, user]);

  if (!authChecked) {
    return <Splash />;
  }

  if (!user || !profile) {
    return (
      <>
        <Login toast={toast} />
        {toastMsg && <div id="toast" style={{ display: 'block', background: toastMsg.bg }}>{toastMsg.msg}</div>}
      </>
    );
  }

  const [base, param] = screen.split(':');

  return (
    <div id="home-page" className="page" style={{ display: 'flex' }}>
      <div className="header">
        <div className="header-left">
          <i className="fas fa-bars menu-hamburger" onClick={() => setMenu((m) => !m)}></i>
          <img src="./logo.png" alt="logo" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
          <span className="header-title">LUDO KILLER</span>
        </div>
        <div className="header-right">
          <div className="bal-badge" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> ₹<span>{profile.balance || 0}</span>
          </div>
          <i className="fas fa-bell" onClick={() => go('mail')} style={{ fontSize: 20, color: 'var(--primary)', cursor: 'pointer' }}></i>
        </div>
      </div>

      <div className="main-content" id="main-content">
        {base === 'home' && <Home profile={profile} go={go} canInstall={canInstall} onInstall={installApp} />}
        {base === 'lobby' && <Lobby bets={bets} profile={profile} uid={user.uid} toast={toast} go={go} />}
        {base === 'wallet' && <Wallet profile={profile} go={go} />}
        {base === 'deposit' && <Deposit profile={profile} uid={user.uid} toast={toast} go={go} />}
        {base === 'qr' && <QrPage amount={param} uid={user.uid} toast={toast} go={go} />}
        {base === 'utr' && <UtrPage amount={param} uid={user.uid} profile={profile} toast={toast} go={go} />}
        {base === 'withdraw' && <Withdraw profile={profile} uid={user.uid} toast={toast} go={go} />}
        {base === 'history' && <History uid={user.uid} go={go} />}
        {base === 'success' && <PaymentSuccess txnId={param} toast={toast} go={go} />}
        {base === 'kyc' && <Kyc profile={profile} uid={user.uid} toast={toast} go={go} />}
        {base === 'match' && (
          <Match betId={param} bets={bets} uid={user.uid} toast={toast} go={go} />
        )}
        {base === 'profile' && (
          <Profile
            profile={profile}
            uid={user.uid}
            toast={toast}
            go={go}
            onLogout={() => {
              setUser(null);
              setProfile(null);
              setScreen('home');
            }}
          />
        )}
        {base === 'referral' && <Referral profile={profile} toast={toast} go={go} />}
        {base === 'mail' && <Mail uid={user.uid} go={go} toast={toast} />}
        {base === 'support' && <Support go={go} profile={profile} />}
        {base === 'info' && <InfoPage type={param} go={go} />}
      </div>

      <div className="bottom-nav">
        {[
          ['home', 'fa-home', 'Home'],
          ['lobby', 'fa-gamepad', 'Games'],
          ['wallet', 'fa-wallet', 'Wallet'],
          ['profile', 'fa-user', 'Profile']
        ].map(([key, icon, label]) => (
          <div key={key} className={`bn-item ${base === key ? 'active' : ''}`} onClick={() => go(key)}>
            <i className={`fas ${icon}`}></i>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {menu && <div className="menu-overlay" style={{ display: 'block' }} onClick={() => setMenu(false)}></div>}
      <div className={`side-menu ${menu ? 'open' : ''}`}>
        <div className="sm-item" onClick={() => go('home')}><i className="fas fa-home"></i> Home</div>
        <div className="sm-item" onClick={() => go('wallet')}><i className="fas fa-wallet"></i> Wallet</div>
        <div className="sm-item" onClick={() => go('profile')}><i className="fas fa-user"></i> Profile</div>
        <div className="sm-item" onClick={() => go('referral')}><i className="fas fa-share-alt"></i> Referral</div>
        <div className="sm-item" onClick={() => go('mail')}><i className="fas fa-envelope"></i> Inbox</div>
        <div className="sm-item" onClick={() => go('kyc')}><i className="fas fa-id-card"></i> KYC Verification</div>
        <div className="sm-item" onClick={() => go('support')}><i className="fas fa-headset"></i> Support Team</div>
        {canInstall && (
          <div className="sm-item" onClick={installApp} style={{ color: 'var(--success)' }}>
            <i className="fas fa-download"></i> Install App
          </div>
        )}
        <div className="sm-divider"></div>
        <div className="sm-item" onClick={() => go('info:privacy')}><i className="fas fa-shield-alt"></i> Privacy Policy</div>
        <div className="sm-item" onClick={() => go('info:terms')}><i className="fas fa-file-contract"></i> Terms &amp; Conditions</div>
        <div className="sm-item" onClick={() => go('info:about')}><i className="fas fa-info-circle"></i> About Us</div>
        <div className="sm-item" onClick={() => go('info:gst')}><i className="fas fa-receipt"></i> GST</div>
        <div className="sm-item" onClick={() => go('info:rules')}><i className="fas fa-book"></i> Game Rules</div>
      </div>

      {toastMsg && <div id="toast" style={{ display: 'block', background: toastMsg.bg }}>{toastMsg.msg}</div>}

      {/* iPhone install help */}
      {iosHelp && (
        <div className="popup-overlay" style={{ display: 'flex' }} onClick={() => setIosHelp(false)}>
          <div className="popup" style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">App Install Karo</div>
            <p style={{ fontSize: 14, lineHeight: 2, color: 'var(--text-muted)' }}>
              1. Neeche <b>Share</b> button dabao<br />
              2. <b>Add to Home Screen</b> chuno<br />
              3. <b>Add</b> dabao — ho gaya!
            </p>
            <button className="btn" style={{ marginTop: 8 }} onClick={() => setIosHelp(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
