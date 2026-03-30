import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_SOCKET_URL || '';

export function useCreators() {
  const [creatorStatus, setCreatorStatus] = useState(null); // { handle_name, status, coins_earned, earnings_rs, referral_code }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const storedId = window.localStorage.getItem('mm_creatorId');
      const logoutFlag = window.localStorage.getItem('mm_logout_flag');
      
      let url = `${API_BASE}/api/creators/status`;
      if (storedId) {
        url += `?id=${storedId}`;
        // If we have an ID, we clear the logout flag because they've explicitly logged in or resumed
        window.localStorage.removeItem('mm_logout_flag');
      } else if (logoutFlag) {
        // If they manually logged out, don't auto-fetch by IP
        setCreatorStatus(null);
        setLoading(false);
        return;
      }

      const res = await fetch(url);
      const data = await res.json();
      setCreatorStatus(data.data);
    } catch (e) {
      console.error('Creator status fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  const registerCreator = async (handle, platform, link) => {
    try {
      const res = await fetch(`${API_BASE}/api/creators/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, platform, link })
      });
      if (res.ok) {
        fetchStatus();
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error };
    } catch (e) {
      return { success: false, error: 'Network failure' };
    }
  };

  const verifyReferral = async (code) => {
    try {
      const res = await fetch(`${API_BASE}/api/creators/verify-ref`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      return await res.json();
    } catch (e) {
       return { error: 'Sync failed' };
    }
  };

  const requestWithdrawal = async (upi) => {
    try {
      const res = await fetch(`${API_BASE}/api/creators/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upi })
      });
      const data = await res.json();
      if (res.ok) fetchStatus();
      return data;
    } catch (e) {
       return { error: 'Withdrawal failed' };
    }
  };

  return { creatorStatus, loading, registerCreator, verifyReferral, requestWithdrawal, fetchStatus };
}
