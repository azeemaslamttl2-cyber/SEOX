import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { exchangeGbpCode, parseGbpOAuthState } from '../../lib/gbpApi.js';

// The stages the server reports, in the order they run. Rendering the whole
// list - not just the one that failed - is the point: someone who has just
// completed a Google consent screen needs to see that the consent worked and
// that the problem is further along, rather than a bare "Failed" that implies
// they did something wrong.
const STAGE_STEPS = [
  { key: 'authentication', label: 'Google authentication', stage: 'oauth_callback' },
  { key: 'permission_granted', label: 'Business Profile permission', stage: 'scope_check' },
  { key: 'token_received', label: 'Access token received', stage: 'token_exchange' },
  { key: 'accounts_fetched', label: 'Business Profile accounts', stage: 'business_profile_api' },
  { key: 'locations_fetched', label: 'Business Profile locations', stage: 'locations' },
  { key: 'profile_saved', label: 'Profile saved', stage: 'save' },
];

/**
 * Which row gets the ✗.
 *
 * The server names the stage that failed, so mark that one - not simply the
 * first unfinished row. Those differ whenever a stage fails before an earlier
 * one could be *checked*: a token exchange rejected outright never gets as far
 * as reading the granted scopes, and putting the cross on "Business Profile
 * permission" then told the user their permission was the problem while the
 * FAILED STEP line above it said something else entirely.
 */
function failedStepIndex(report) {
  const named = STAGE_STEPS.findIndex((step) => step.stage === report.stage);
  if (named >= 0) return named;
  return STAGE_STEPS.findIndex((step) => !report[step.key]);
}

const OWNER_LABEL = {
  application: 'This is a problem on the SEOX server, not with your Google account.',
  google_cloud: 'This needs a change in the Google Cloud project.',
  google_account: 'This needs a change to the Google account’s Business Profile access.',
  user: 'This can be resolved by connecting again.',
};

/**
 * The structured diagnostics for a failure, from either transport:
 * a non-2xx response (thrown, payload attached) or a 2xx that reports
 * `success: false` because a later stage failed after the tokens were stored.
 */
function diagnosticsOf(source) {
  if (!source) return null;
  const payload = source.payload || source;
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.stage && !payload.error_type) return null;
  return payload;
}

function StageRow({ label, done, failed }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
      ) : failed ? (
        <X className="h-4 w-4 shrink-0 text-rose-400" />
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full border border-white/15" />
      )}
      <span className={done ? 'text-white/70' : failed ? 'text-rose-200' : 'text-white/30'}>{label}</span>
    </li>
  );
}

function Field({ label, children }) {
  if (!children) return null;
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-0.5 text-sm text-white/70">{children}</p>
    </div>
  );
}

export default function GbpOAuthCallback() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const exchangeStartedRef = useRef(false);
  const rawState = params.get('state');
  const state = useMemo(() => parseGbpOAuthState(rawState), [rawState]);

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

    // Google reports the scopes it actually granted on the callback URL, so the
    // missing permission can be named here - before spending the single-use
    // code. Without this the user sees whatever the token exchange happens to
    // fail with (a reused code returns a bare "Bad Request"), which hides the
    // real problem: the Business Profile permission was never granted.
    const granted = params.get('scope');
    if (granted && !granted.includes('business.manage')) {
      setReport({
        authentication: true,
        permission_granted: false,
        token_received: false,
        accounts_fetched: false,
        locations_fetched: false,
        profile_saved: false,
        stage: 'scope_check',
        stage_label: 'Business Profile permission',
        error_code: 403,
        error_type: 'SCOPE_NOT_GRANTED',
        message:
          'Google signed the account in but did not grant "Manage your Business Profile". ' +
          `It returned only: ${granted}`,
        possible_cause:
          'Either the permission was unticked on the consent screen, or the OAuth consent screen ' +
          'for this Google Cloud project does not list the business.manage scope — in which case ' +
          'Google never offers it, and every attempt will come back like this.',
        owner: 'google_cloud',
      });
      return;
    }

    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    exchangeGbpCode({ projectId: state.projectId, code, state: rawState })
      .then((data) => {
        // A stored connection whose later stage failed still belongs on the GBP
        // page, where the profile picker and the connection card live - but not
        // silently. Show the report, and let the user carry on from here.
        if (data.success === false) {
          setReport(diagnosticsOf(data));
          return;
        }
        const query = new URLSearchParams({ connected: '1' });
        if (data.next) query.set('next', data.next);
        if (data.needsAccountAccess) query.set('noAccounts', '1');
        navigate(`${returnTo}?${query.toString()}`, { replace: true });
      })
      .catch((err) => {
        console.error('GBP OAuth exchange failed:', err);
        const structured = diagnosticsOf(err);
        if (structured) setReport(structured);
        else setError(err?.message || 'Failed to connect the Business Profile.');
      });
  }, [loading, navigate, params, rawState, state, user]);

  const returnTo = state.returnTo || '/local-seo/gbp';
  const back = (
    <button
      onClick={() => navigate(returnTo, { replace: true })}
      className="mt-5 rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.1]"
    >
      Back to Business Profile
    </button>
  );

  if (report) {
    const failedIndex = failedStepIndex(report);
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 py-10 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <AlertCircle className="h-9 w-9 text-amber-400" />
          <h1 className="mt-3 font-display text-lg font-bold">
            {report.authentication
              ? 'Google sign-in worked — the Business Profile data did not load'
              : 'Business Profile connection failed'}
          </h1>

          <ul className="mt-4 space-y-1.5 rounded-xl border border-white/[0.08] bg-black/20 p-3">
            {STAGE_STEPS.map((step, index) => (
              <StageRow
                key={step.key}
                label={step.label}
                done={Boolean(report[step.key])}
                failed={index === failedIndex}
              />
            ))}
          </ul>

          <Field label="Failed step">{report.stage_label || report.stage}</Field>
          <Field label="HTTP status">{report.error_code ? String(report.error_code) : null}</Field>
          <Field label="Google error">{report.message}</Field>
          <Field label="Possible cause">{report.possible_cause}</Field>
          <Field label="Where the fix is">{OWNER_LABEL[report.owner]}</Field>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => navigate(returnTo, { replace: true })}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Continue to Business Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        {error ? (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
            <h1 className="mt-4 font-display text-lg font-bold">Business Profile connection failed</h1>
            <p className="mt-2 text-sm text-white/50">{error}</p>
            {back}
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
