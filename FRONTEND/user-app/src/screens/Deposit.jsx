import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const DEFAULT_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const BACKEND_URL = 'https://ludo-club-bacend.onrender.com';

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts, setAmounts] = useState(DEFAULT_AMOUNTS);
  const [payLinks, setPayLinks] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const appDoc = await getDoc(doc(db, 'settings', 'app'));
        if (appDoc.exists() && appDoc.data().depositOptions) {
          const arr = String(appDoc.data().depositOptions).split(',').map(x => parseInt(x)).filter(x => x > 0);
          if (arr.length) setAmounts(arr);
        }
      } catch (e) {}

      try {
        const payDoc = await getDoc(doc(db, 'settings', 'paylinks'));
        if (payDoc.exists() && payDoc.data().links) {
          setPayLinks(payDoc.data().links);
        }
      } catch (e) {}

      setLoading(false);
    }
    load();
  }, []);

  function selectAmount(amt) {
    go('payutr:' + amt);
  }

  return (
    <div id="deposit-page-section" className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <span className="loader-dot" style={{ width: 24, height: 24 }}></span>
            <div style={{ marginTop: 10, fontSize: 13, color: '#86868b' }}>Loading...</div>
          </div>
        ) : (
          <>
            <div className="dp-label">Select Amount</div>
            <div className="dp-chips">
              {amounts.map((amt) => (
                <div key={amt} className="dp-chip" onClick={() => selectAmount(amt)}>
                  Rs.{amt}
                </div>
              ))}
            </div>
            <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10, marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#856404', fontWeight: 600, textAlign: 'center' }}>
                Amount select karo → Pay karo → UTR dalo → Wallet auto update
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Pay UTR Flow: Amount select → Payment link → UTR submit → Auto verify
export function PayQr({ amount, profile, uid, toast, go }) {
  const [step, setStep] = useState('info');
  const [payLinks, setPayLinks] = useState({});
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [txnid, setTxnid] = useState('');

  useEffect(() => {
    const id = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    setTxnid(id);

    async function loadLinks() {
      try {
        const payDoc = await getDoc(doc(db, 'settings', 'paylinks'));
        if (payDoc.exists() && payDoc.data().links) {
          setPayLinks(payDoc.data().links);
        }
      } catch (e) {}
    }
    loadLinks();
  }, []);

  function openPaymentLink() {
    const link = payLinks[String(amount)];
    if (link) {
      window.open(link, '_blank');
      setStep('utr');
    } else {
      toast('Payment link set nahi hai', '#ff3b30');
    }
  }

  async function submitUtr() {
    if (!utr.trim() || utr.trim().length < 6) {
      return toast('Valid UTR dalo (minimum 6 digits)', '#ff3b30');
    }
    setBusy(true);
    try {
      const res = await fetch(BACKEND_URL + '/verify-utr.php', {
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
        if (data.verified) {
          setStep('success');
        } else {
          setStep('pending');
        }
      } else {
        toast(data.error || 'Submit failed', '#ff3b30');
      }
    } catch (e) {
      toast('Network error', '#ff3b30');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'success') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9989;</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#34c759', marginBottom: 8 }}>Payment Verified!</div>
          <div style={{ fontSize: 14, color: '#86868b', marginBottom: 8 }}>Rs.{amount} wallet mein add ho gaya</div>
          <div style={{ fontSize: 12, color: '#636366', marginBottom: 20 }}>UTR: {utr}</div>
          <button className="dp-btn" onClick={() => go('wallet')}>
            <i className="fas fa-wallet"></i> Wallet pe jao
          </button>
        </div>
      </div>
    );
  }

  if (step === 'pending') {
    return (
      <div className="section active">
        <TopBar title="Payment" onBack={() => go('wallet')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9200;</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Payment Submitted!</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 8 }}>
            UTR verify ho raha hai. 5-10 minute mein wallet mein add ho jayega.
          </div>
          <div style={{ fontSize: 12, color: '#636366', marginBottom: 20 }}>UTR: {utr}</div>
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
        <TopBar title="Enter UTR" onBack={() => setStep('info')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 50, marginBottom: 16 }}>&#128221;</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>UTR / Reference Number</div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 6 }}>
            Payment karne ke baad UPI app mein transaction details mein 12 digit ka UTR hota hai
          </div>
          <div style={{ fontSize: 13, color: '#86868b', marginBottom: 16 }}>
            Amount: Rs.{amount}
          </div>
          <input
            type="text"
            placeholder="12 digit UTR number"
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={12}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #e5e5ea',
              fontSize: 18, fontWeight: 700, textAlign: 'center', letterSpacing: 2, outline: 'none',
              background: '#1c1c1e', color: '#fff', marginBottom: 16
            }}
          />
          <button className="dp-btn" onClick={submitUtr} disabled={busy || utr.length < 6}>
            {busy ? 'Verifying...' : 'Submit UTR'}
          </button>
          <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => setStep('info')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // Step: info (Payment instructions)
  return (
    <div className="section active">
      <TopBar title={'Pay Rs.' + amount} onBack={() => go('wallet')} />
      <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#007aff', marginBottom: 4 }}>Rs.{amount}</div>
        {txnid && <div style={{ fontSize: 11, color: '#636366', marginBottom: 16 }}>Order: {txnid}</div>}

        <div style={{ background: '#1c1c1e', borderRadius: 16, padding: 16, marginBottom: 16, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Steps:</div>
          <div style={{ fontSize: 13, color: '#86868b', lineHeight: 2.2 }}>
            1. Neeche "Pay" button dabao<br/>
            2. Payment page pe pay karo<br/>
            3. UPI app se pay karo (GPay/PhonePe/Paytm)<br/>
            4. Wapas aao aur UTR dalo<br/>
            5. Wallet auto update hoga
          </div>
        </div>

        <button className="dp-btn" onClick={openPaymentLink} style={{ fontSize: 16 }}>
          <i className="fas fa-external-link-alt"></i> Pay Rs.{amount}
        </button>
        <button className="dp-btn" style={{ background: '#636366', marginTop: 10 }} onClick={() => go('wallet')}>
          Cancel
        </button>
      </div>
    </div>
  );
}
