import React, { useState } from 'react';
import { TopBar } from '../components/ui.jsx';
import { db } from '../firebase.js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function UtrPage({ amount, uid, profile, toast, go }) {
  const [utr, setUtr] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const amt = parseInt(amount) || 0;

  async function handleSubmit() {
    if (!utr.trim()) {
      toast('UTR number dalo', '#ff3b30');
      return;
    }
    if (utr.trim().length < 6) {
      toast('UTR kam se kam 6 digits ka hona chahiye', '#ff3b30');
      return;
    }

    setLoading(true);
    try {
      const orderId = 'LRC_' + uid + '_' + Date.now();
      await setDoc(doc(db, 'transactions', orderId), {
        userId: uid,
        userName: profile?.name || 'Player',
        type: 'Deposit',
        amount: amt,
        status: 'Pending',
        paymentId: orderId,
        utr: utr.trim(),
        method: 'manual_upi',
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN'),
        createdAt: serverTimestamp(),
      });
      setShowPopup(true);
    } catch (e) {
      toast('Error: ' + e.message, '#ff3b30');
    } finally {
      setLoading(false);
    }
  }

  if (showPopup) {
    return (
      <div className="section active">
        <TopBar title="Request Submitted" onBack={() => go('home')} />
        <div className="deposit-page-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>&#9989;</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1c1c1e', marginBottom: 12, lineHeight: 1.3 }}>
            Request Submitted Successfully
          </div>
          <div style={{ fontSize: 14, color: '#636366', lineHeight: 1.6, marginBottom: 24 }}>
            Your payment request has been sent for verification.<br />
            Please wait 1–2 minutes while our team confirms your request.<br /><br />
            Once approved, the amount will be credited to your account automatically.
          </div>
          <div style={{ fontSize: 13, color: '#86868b' }}>
            Thank you for your patience.
          </div>
          <button className="dp-btn" onClick={() => go('home')} style={{ marginTop: 24 }}>
            <i className="fas fa-home"></i> Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section active">
      <TopBar title="Enter UTR Number" onBack={() => go('qr:' + amt)} />
      <div className="deposit-page-card" style={{ padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 50, marginBottom: 12 }}>&#128179;</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>UTR Number Dalo</div>
          <div style={{ fontSize: 13, color: '#86868b' }}>Amount: <strong>₹{amt}</strong></div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="UTR / Transaction ID"
            value={utr}
            onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={16}
            style={{
              width: '100%', padding: '14px 16px', fontSize: 16, fontWeight: 600,
              letterSpacing: 1, border: '2px solid #e5e5ea', borderRadius: 12,
              outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          className="dp-btn"
          onClick={handleSubmit}
          disabled={loading || !utr.trim()}
          style={{ opacity: loading || !utr.trim() ? 0.6 : 1 }}
        >
          {loading ? (
            <><span className="loader-dot" style={{ width: 16, height: 16 }}></span> Submitting...</>
          ) : (
            <><i className="fas fa-check-circle"></i> Confirm</>
          )}
        </button>

        <div style={{ padding: 10, background: '#fffbe6', borderRadius: 10, marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#856404', fontWeight: 600, textAlign: 'center' }}>
            UTR number UPI app ke transaction history mein milta hai
          </div>
        </div>
      </div>
    </div>
  );
}
