import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { exchangeGbpCode, parseGbpOAuthState } from '../../lib/gbpApi.js';

export default function GbpOAuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const exchangeStartedRef = useRef(false);
  const state = useMemo(() => parseGbpOAuthState(params.get('state')), [params]);

  useEffect(() => {
    if (loading) return;

    const code = params.get('code');
    const googleError = params.get('error');
    const returnTo = state.returnTo || '/local-seo/gbp';

    if (googleError) {
      setError(
        googleError === 'access_denied'
          ? 'The Google account did not grant Business Profile access.'
          : `Google returned: ${googleError}`
      );
      return;
    }
    if (!code) {
      setError('Google did not return an authorization code.');
      return;
    }
    if (!user?.uid && !user?.id) {
      setError('Please sign in to SEOX before connecting a Business Profile.');
      return;
    }
    if (!state.projectId) {
      setError('The connection lost its project reference. Start again from the GBP page.');
      return;
    }

    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    exchangeGbpCode({ projectId: state.projectId, code })
      .then((data) => {
        const query = new URLSearchParams({ connected: '1' });
        if (data.needsAccountAccess) query.set('noAccounts', '1');
        navigate(`${returnTo}?${query.toString()}`, { replace: true });
      })
      .catch((err) => {
        console.error('GBP OAuth exchange failed:', err);
        setError(err?.message || 'Failed to connect the Business Profile.');
      });
  }, [loading, navigate, params, state, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        {error ? (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
            <h1 className="mt-4 font-display text-lg font-bold">Business Profile connection failed</h1>
            <p className="mt-2 text-sm text-white/50">{error}</p>
            <button
              onClick={() => navigate(state.returnTo || '/local-seo/gbp', { replace: true })}
              className="mt-5 rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.1]"
            >
              Back to Business Profile
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-400" />
            <h1 className="mt-4 font-display text-lg font-bold">Connecting Business Profile</h1>
            <p className="mt-2 text-sm text-white/45">
              Finishing Google authorisation and reading the accounts you manage.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
