import React, { useState } from 'react';
import { TopBar } from '../components/ui.jsx';

const DEFAULT_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000];

export default function Deposit({ profile, uid, toast, go }) {
  const [amounts] = useState(DEFAULT_AMOUNTS);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmt, setSelectedAmt] = useState(null);

  function handleProceed() {
    const amt = selectedAmt || parseInt(customAmount);
    if (!amt || amt <= 0) {
      toast('Amount select ya enter karo', '#ff3b30');
      return;
    }
    go('qr:' + amt);
  }

  return (
    <div className="section active">
      <TopBar title="Deposit Money" onBack={() => go('wallet')} />
      <div className="deposit-page-card">
        <div className="dp-label">Select Amount</div>
        <div className="dp-chips">
          {amounts.map((amt) => (
            <div
              key={amt}
              className={`dp-chip ${selectedAmt === amt ? 'selected' : ''}`}
              onClick={() => { setSelectedAmt(amt); setCustomAmount(''); }}
            >
              ₹{amt}
            </div>
          ))}
        </div>

            <div style={{ marginTop: 16 }}>
              <div className="dp-label">Ya Amount Likho</div>
              <input
                type="number"
                placeholder="Custom amount enter karo"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmt(null); }}
                style={{
                  width: '100%', padding: '14px 16px', fontSize: 16, fontWeight: 600,
                  border: '2px solid #e5e5ea', borderRadius: 12, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <button className="dp-btn" onClick={handleProceed} style={{ marginTop: 16 }}>
              <i className="fas fa-qrcode"></i> Proceed to Pay
            </button>
      </div>
    </div>
  );
}
