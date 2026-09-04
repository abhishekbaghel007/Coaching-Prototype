import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { getStaffRole } from './admin/admin';
import AdminPanel from './admin/AdminPanel';

const adminCss = `
.admin-auth-shell{min-height:100vh;background:#07090b;color:#f4f7f8;display:grid;place-items:center;padding:28px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;overflow:hidden}
.admin-auth-shell:before{content:"";position:absolute;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(88,208,192,.13),transparent 66%);top:-250px;right:-170px;pointer-events:none}
.admin-auth-shell:after{content:"";position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(109,168,255,.08),transparent 68%);bottom:-260px;left:-170px;pointer-events:none}
.admin-auth-card{width:min(440px,100%);position:relative;z-index:1;padding:34px;border:1px solid rgba(255,255,255,.10);border-radius:30px;background:rgba(18,22,25,.78);backdrop-filter:blur(28px) saturate(135%);-webkit-backdrop-filter:blur(28px) saturate(135%);box-shadow:0 28px 90px rgba(0,0,0,.42)}
.admin-auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:34px}.admin-auth-mark{width:44px;height:44px;border-radius:14px;background:linear-gradient(145deg,#dce7f4,#94a8bd);color:#091014;display:grid;place-items:center;font-weight:900;font-size:19px;box-shadow:0 8px 28px rgba(180,205,225,.16)}.admin-auth-brand strong{font-size:20px;letter-spacing:-.04em}.admin-auth-brand span{display:block;color:#81909b;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-top:2px}
.admin-auth-eyebrow{color:#58d0c0;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px}.admin-auth-title{font-size:clamp(32px,7vw,46px);line-height:.98;letter-spacing:-.055em;margin:0 0 14px}.admin-auth-copy{color:#8d9aa4;line-height:1.55;margin:0 0 28px;font-size:15px}
.admin-auth-form{display:grid;gap:16px}.admin-auth-field{display:grid;gap:8px}.admin-auth-field label{font-size:12px;font-weight:800;color:#b7c1c7}.admin-auth-input-wrap{position:relative}.admin-auth-input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);color:#f5f7f8;border-radius:15px;padding:14px 15px;font:inherit;font-size:15px;outline:none;transition:.18s}.admin-auth-input:focus{border-color:rgba(88,208,192,.72);box-shadow:0 0 0 4px rgba(88,208,192,.09)}.admin-auth-input.has-toggle{padding-right:68px}.admin-auth-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#82919b;font-weight:800;font-size:12px;cursor:pointer;padding:8px}.admin-auth-submit{margin-top:4px;border:0;border-radius:15px;padding:15px 16px;background:#58d0c0;color:#071011;font:inherit;font-weight:900;font-size:15px;cursor:pointer;box-shadow:0 12px 32px rgba(88,208,192,.16);transition:transform .18s,filter .18s}.admin-auth-submit:hover{transform:translateY(-1px);filter:brightness(1.04)}.admin-auth-submit:disabled{opacity:.6;cursor:wait;transform:none}
.admin-auth-error{border:1px solid rgba(255,108,108,.22);background:rgba(255,108,108,.07);color:#ffb1b1;border-radius:13px;padding:11px 13px;font-size:13px;line-height:1.45}.admin-auth-footer{display:flex;justify-content:space-between;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.07)}.admin-auth-back{border:0;background:transparent;color:#8997a0;padding:0;font:inherit;font-weight:750;cursor:pointer}.admin-auth-back:hover{color:#dbe3e7}.admin-auth-security{font-size:11px;color:#66747d;align-self:center}.admin-auth-loading{min-height:100vh;display:grid;place-items:center;background:#07090b;color:#dce4e8;font-family:Inter,ui-sans-serif,system-ui}.admin-auth-loading-card{text-align:center}.admin-auth-spinner{width:28px;height:28px;border:2px solid rgba(255,255,255,.12);border-top-color:#58d0c0;border-radius:50%;animation:adminSpin .8s linear infinite;margin:0 auto 14px}@keyframes adminSpin{to{transform:rotate(360deg)}}
@media(max-width:520px){.admin-auth-shell{padding:16px}.admin-auth-card{padding:25px 20px;border-radius:24px}.admin-auth-footer{display:grid}.admin-auth-security{order:-1}}
`;

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) {
        setUser(data.user ?? null);
        setChecking(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message || 'Unable to sign in. Check your credentials.');
      setSubmitting(false);
      return;
    }

    if (!data.user) {
      setError('Sign-in did not return a user session.');
      setSubmitting(false);
      return;
    }

    const role = await getStaffRole(data.user.id);
    if (!role) {
      await supabase.auth.signOut();
      setError('This account is not authorized for the Teacher Console.');
      setSubmitting(false);
      return;
    }

    setUser(data.user);
    setSubmitting(false);
  }

  async function exitToStudentApp() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (checking) {
    return (
      <>
        <style>{adminCss}</style>
        <div className="admin-auth-loading">
          <div className="admin-auth-loading-card">
            <div className="admin-auth-spinner" />
            <strong>Checking secure staff session</strong>
          </div>
        </div>
      </>
    );
  }

  if (user) {
    return <AdminPanel user={user} onExit={exitToStudentApp} />;
  }

  return (
    <>
      <style>{adminCss}</style>
      <main className="admin-auth-shell">
        <section className="admin-auth-card" aria-label="Teacher Console sign in">
          <div className="admin-auth-brand">
            <div className="admin-auth-mark">N</div>
            <div>
              <strong>neetprep</strong>
              <span>Teacher Command</span>
            </div>
          </div>

          <div className="admin-auth-eyebrow">Secure staff access</div>
          <h1 className="admin-auth-title">Welcome back.</h1>
          <p className="admin-auth-copy">
            Sign in with the teacher account created by your administrator. Teacher accounts are private and cannot be created from this screen.
          </p>

          <form className="admin-auth-form" onSubmit={signIn}>
            <div className="admin-auth-field">
              <label htmlFor="teacher-email">Email</label>
              <input
                id="teacher-email"
                className="admin-auth-input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teacher@yourcoaching.com"
                required
              />
            </div>

            <div className="admin-auth-field">
              <label htmlFor="teacher-password">Password</label>
              <div className="admin-auth-input-wrap">
                <input
                  id="teacher-password"
                  className="admin-auth-input has-toggle"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  className="admin-auth-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <div className="admin-auth-error" role="alert">{error}</div>}

            <button className="admin-auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in to Teacher Console  ↗'}
            </button>
          </form>

          <div className="admin-auth-footer">
            <button className="admin-auth-back" type="button" onClick={() => { window.location.href = '/'; }}>
              ← Student app
            </button>
            <span className="admin-auth-security">Role-protected · Supabase Auth</span>
          </div>
        </section>
      </main>
    </>
  );
}
