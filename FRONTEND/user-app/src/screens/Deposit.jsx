import React, { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const FALLBACK_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const BACKEND_URL = 'https://ludo-club-bacend.onrender.com';
const MERCHANT_UPI = '8690473929-2@ybl';
const MERCHANT_NAME = 'Ludo Royal Club';

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(FALLBACK_AMOUNTS);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'settings', 'app'))
      .then((d) => {
        if (d.exists() && d.data().depositOptions) {
          const arr = String(d.data().depositOptions).split(',').map((x) => parseInt(x)).filter((x) => x > 0);
          if (arr.length) setAmounts(arr);
        }
      })
      .catch(() => {});
  }, []);

  async function next() {
    const amt = parseInt(custom);
    let minDep = 1;
    try {
      const d = await getDoc(doc(db, 'settings', 'app'));
      if (d.exists() && d.data().minDeposit) minDep = parseFloat(d.data().minDeposit);
    } catch (e) {}
    if (!amt || amt < minDep) return toast('Minimum deposit Rs.' + minDep, '#ff3b30');
    if (amt > 5000) return toast('Maximum deposit Rs.5000', '#ff3b30');
    go('payqr:' + amt);
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        <div className="dp-label">Select Amount</div>
        <div className="dp-chips">
          {amounts.map((amt) => (
            <div key={amt} className={`dp-chip ${parseInt(custom) === amt ? 'selected' : ''}`} onClick={() => setCustom(String(amt))}>
              Rs.{amt}
            </div>
          ))}
        </div>
        <div className="dp-divider"><span>or enter custom amount</span></div>
        <div className="dp-custom">
          <span className="dp-rupee">Rs.</span>
          <input type="number" placeholder="Enter amount (min Rs.1)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <button className="dp-btn" onClick={next}>
          <i className="fas fa-arrow-right"></i> Next
        </button>
      </div>
    </div>
  );
}

export function PayQr({ amount, profile, uid, toast, go }) {
  const [step, setStep] = useState('qr');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(900);
  const [txnid, setTxnid] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    const id = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    setTxnid(id);
  }, []);

  useEffect(() => {
    if (step !== 'qr') return;
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step]);

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  }

  function openUPIApp(app) {
    const upiUrl = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&tn=${encodeURIComponent('Deposit ' + txnid)}&cu=INR`;
    window.location.href = upiUrl;
    setTimeout(() => {
      setStep('utr');
    }, 2000);
  }

  async function submitUtr() {
    if (!utr.trim() || utr.trim().length < 6) return toast('Valid UTR dalo (minimum 6 digits)', '#ff3b30');
    setBusy(true);
    try {
      const res = await fetch(BACKEND_URL + '/submit-utr.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnid: txnid,
          utr: utr.trim(),
          amount: parseInt(amount),
          userId: uid,
          userName: profile.name || 'Player',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('submitted');
      } else {
        toast(data.error || 'Submit failed', '#ff3b30');
      }
    } catch (e) {
      toast('Network error: ' + e.message, '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'submitted') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9200;</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Payment Submitted!</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 8 }}>
            UTR verify ho raha hai. 5-10 minute mein wallet mein add ho jayega.
          </div>
          <div style={{ fontSize: 12, color: '#636366', marginBottom: 20 }}>
            UTR: {utr}
          </div>
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  if (step === 'utr') {
    return (
      <div className="section active">
        <TopBar title="Enter UTR" onBack={() => setStep('qr')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>&#128221;</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>UTR / Reference Number Dalo</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 16 }}>
            Payment karne ke baad UPI app mein transaction details mein 12 digit ka UTR / Reference Number hota hai
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="12 digit UTR / Reference Number"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={12}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #e5e5ea',
                fontSize: 18, fontWeight: 700, textAlign: 'center', letterSpacing: 2, outline: 'none',
                background: '#1c1c1e', color: '#fff'
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#636366', marginBottom: 16 }}>
            Amount: Rs.{amount} | UPI: {MERCHANT_UPI}
          </div>
          <button className="dp-btn" onClick={submitUtr} disabled={busy || utr.length < 6}>
            {busy ? 'Verifying...' : 'Submit UTR'}
          </button>
          <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => setStep('qr')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const qrUrl = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${amount}&tn=${encodeURIComponent('Deposit ' + txnid)}&cu=INR`;

  return (
    <div className="section active">
      <TopBar title={'Pay Rs.' + amount} onBack={() => go('wallet')} />
      <div className="deposit-page-card" style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 28, fontWeight: 800, marginBottom: 12,
          color: timer < 120 ? '#ff3b30' : '#1c1c1e'
        }}>
          <i className="fas fa-clock" style={{ marginRight: 6 }}></i>
          {formatTime(timer)}
        </div>

        <div style={{ fontSize: 13, color: '#86868b', marginBottom: 12 }}>
          Neeche kisi bhi UPI app se scan karo
        </div>

        <img
          src={'https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(qrUrl) + '&size=250x250'}
          alt="UPI QR"
          style={{ width: 250, height: 250, borderRadius: 16, border: '3px solid #e5e5ea', marginBottom: 12 }}
        />

        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Rs.{amount}</div>
        <div style={{ fontSize: 12, color: '#86868b', marginBottom: 16 }}>{MERCHANT_UPI}</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => openUPIApp('gpay')} style={upiBtnStyle('#4285f4')}>
            <i className="fas fa-google-pay" style={{ fontSize: 18 }}></i> Google Pay
          </button>
          <button onClick={() => openUPIApp('phonepe')} style={upiBtnStyle('#5f259f')}>
            <i className="fas fa-mobile-alt" style={{ fontSize: 14 }}></i> PhonePe
          </button>
          <button onClick={() => openUPIApp('paytm')} style={upiBtnStyle('#00baf2')}>
            <i className="fas fa-wallet" style={{ fontSize: 14 }}></i> Paytm
          </button>
        </div>

        <button className="dp-btn" onClick={() => setStep('utr')} style={{ marginBottom: 8 }}>
          <i className="fas fa-check-circle"></i> Payment Ho Gaya - UTR Dalo
        </button>

        {txnid && (
          <div style={{ fontSize: 11, color: '#636366', marginBottom: 8 }}>
            Order ID: {txnid}
          </div>
        )}

        <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#856404', fontWeight: 600 }}>
            1. UPI app se scan karo<br/>
            2. Pay karo<br/>
            3. UTR number dalo<br/>
            4. Wallet mein add ho jayega
          </div>
        </div>
      </div>
    </div>
  );
}

function upiBtnStyle(color) {
  return {
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };
}
