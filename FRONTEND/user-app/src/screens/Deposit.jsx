import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { TopBar } from '../components/ui.jsx';

const DEFAULT_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

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
    const link = payLinks[String(amt)];
    if (link) {
      window.open(link, '_blank');
    } else {
      toast('Payment link set nahi hai. Admin se contact karo.', '#ff3b30');
    }
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
                Amount select karo → Payment page khulega → Pay karo → Wallet auto update
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PayQr() {
  return (
    <div className="section active">
      <div className="deposit-page-card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 14, color: '#86868b' }}>Payment external page pe ho raha hai...</div>
      </div>
    </div>
  );
}
