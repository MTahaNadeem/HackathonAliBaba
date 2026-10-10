'use client';
import {useState, useEffect, useRef, useCallback} from 'react';
import {createClient, type SupabaseClient, type Session} from '@supabase/supabase-js';
import {
  ArrowRight,
  Compass,
  GraduationCap,
  BriefcaseBusiness,
  Route,
  Sparkles,
  ChevronRight,
  MapPin,
  Menu,
  UserRound,
  LogOut,
  Check,
  Cloud,
  Info
} from 'lucide-react';
import {SidebarProvider, Sidebar} from '@/components/ui/sidebar';
import {Sheet, SheetContent, SheetTitle, SheetDescription} from '@/components/ui/sheet';
import {Toaster, toast} from 'sonner';
import Dashboard from './dashboard';
import Explore from './explore';
import Universities from './universities';
import Jobs from './jobs';
import Learning from './learning';
import ProfileView from './profile';
import Adviser from './adviser';
import AuthDialog from './auth-dialog';
import {emptyProfile, createPlan, type Profile, type Plan} from '@/lib/domain';
import {degrees, type Degree, type University} from '@/lib/catalogue';
import {profileSchema, planSchema} from '@/lib/validation';
import {isAuthHash} from '@/lib/auth';


const validViews = ['dashboard', 'explore', 'universities', 'jobs', 'learning', 'profile'];

function normalizeView(v: string): string {
  const clean = v.toLowerCase().replace(/^#/, '');
  if (clean === 'education') return 'universities';
  if (clean === 'careers') return 'jobs';
  if (clean === 'roadmap' || clean === 'my-roadmap') return 'learning';
  if (clean === 'my-profile') return 'profile';
  if (validViews.includes(clean)) return clean;
  return 'dashboard';
}

function viewToHash(v: string): string {
  if (v === 'universities') return 'education';
  if (v === 'jobs') return 'careers';
  if (v === 'learning') return 'roadmap';
  return v;
}

const nav = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'universities', label: 'Education', icon: GraduationCap },
  { id: 'jobs', label: 'Careers', icon: BriefcaseBusiness },
  { id: 'learning', label: 'My Roadmap', icon: Route },
  { id: 'profile', label: 'My Profile', icon: UserRound },
];

export default function CourseCompassApp() {
  const [view, setView] = useState('dashboard');
  const [mobile, setMobile] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [adviser, setAdviser] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState('Guest session');
  const [syncing, setSyncing] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const [catalogueData, setCatalogueData] = useState<{
    universities?: University[];
    dataSource?: 'database' | 'catalogue_fallback';
    ingestion?: {last_run_at: string | null; last_run_ok: boolean | null};
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/catalogue')
      .then(r => r.json() as Promise<{
        universities?: University[];
        dataSource?: 'database' | 'catalogue_fallback';
        ingestion?: {last_run_at: string | null; last_run_ok: boolean | null};
      }>)
      .then(data => {
        if (alive && data?.universities) setCatalogueData(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const go = useCallback((target: string) => {
    const normalized = normalizeView(target);
    setView(normalized);
    setMobile(false);
    window.location.hash = viewToHash(normalized);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    function handleHash() {
      const raw = location.hash.slice(1);
      if (isAuthHash(raw)) return;
      if (!raw) {
        setView('dashboard');
        return;
      }
      const normalized = normalizeView(raw);
      setView(normalized);
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    fetch('/api/config')
      .then(r => r.json() as Promise<{aiConfigured: boolean; authConfigured: boolean; supabaseUrl: string; supabaseKey: string}>)
      .then(c => {
        if (!alive) return;
        setAiConfigured(c.aiConfigured);
        if (c.authConfigured) {
          const sb = createClient(c.supabaseUrl, c.supabaseKey, {
            auth: {flowType: 'pkce', detectSessionInUrl: true, persistSession: true}
          });
          setClient(sb);
          sb.auth.getSession().then(({data}) => {
            if (alive) {
              sessionRef.current = data.session;
              setSession(data.session);
            }
          });
          const {data} = sb.auth.onAuthStateChange((event, s) => {
            if (!alive) return;
            sessionRef.current = s;
            setSession(s);
            if (event === 'SIGNED_IN') {
              go('dashboard');
            }
            if (event === 'PASSWORD_RECOVERY') {
              setRecovery(true);
              setAuthOpen(true);
            }
          });
          unsubscribe = () => data.subscription.unsubscribe();
        }
      })
      .catch(() => toast.error('Configuration could not be loaded. Refresh to retry.'));
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [go]);

  useEffect(() => {
    if (!session) {
      setSync('Guest session');
      return;
    }
    let alive = true;
    setSyncing(true);
    setSync('Loading account');
    const headers = {Authorization: `Bearer ${session.access_token}`};
    Promise.all([fetch('/api/profile', {headers}), fetch('/api/plans', {headers})])
      .then(async ([pr, pl]) => {
        const p = (await pr.json()) as {profile?: unknown; error?: string};
        const l = (await pl.json()) as {plan?: unknown; error?: string};
        if (!alive) return;
        if (!pr.ok || !pl.ok) throw new Error(p.error || l.error);
        if (p.profile) {
          const checked = profileSchema.safeParse(p.profile);
          if (checked.success) setProfile(checked.data);
        }
        if (l.plan) {
          const checked = planSchema.safeParse(l.plan);
          if (checked.success) setPlan(checked.data);
        }
        setSync('Account connected');
      })
      .catch(e => {
        if (alive) {
          setSync('Sync unavailable');
          toast.error(e instanceof Error ? e.message : 'Account data could not be loaded.');
        }
      })
      .finally(() => {
        if (alive) setSyncing(false);
      });
    return () => {
      alive = false;
    };
  }, [session?.user.id]);

  async function persist(path: string, data: unknown) {
    const s = sessionRef.current;
    if (!s) return false;
    const r = await fetch(path, {
      method: 'PUT',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}`},
      body: JSON.stringify(data)
    });
    const result = (await r.json()) as {error?: string};
    if (!r.ok) throw new Error(result.error || 'Your changes were not saved.');
    return true;
  }

  async function saveProfile(p: Profile) {
    setBusy(true);
    setProfile(p);
    try {
      const saved = await persist('/api/profile', p);
      setSync(saved ? 'Saved to account' : 'Guest session');
      toast.success(saved ? 'Profile saved.' : 'Preferences updated for this session.');
      go('dashboard');
    } catch (e) {
      setSync('Unsaved changes');
      toast.error(e instanceof Error ? e.message : 'Profile was not saved.');
    } finally {
      setBusy(false);
    }
  }

  async function updatePlan(p: Plan) {
    setPlan(p);
    try {
      const saved = await persist('/api/plans', p);
      setSync(saved ? 'Saved to account' : 'Guest session');
      if (saved) toast.success('Learning plan saved.');
    } catch (e) {
      setSync('Unsaved changes');
      toast.error(e instanceof Error ? e.message : 'Plan was not saved.');
    }
  }

  const startPlan = useCallback(
    async (goalTitle: string, skillsList: string[]) => {
      setBusy(true);
      toast('Generating your personalised learning plan...', { duration: 3000 });
      try {
        const r = await fetch('/api/plans/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: goalTitle, skills: skillsList.slice(0, 8) }) });
        if(r.ok) {
          const p = await r.json() as Plan;
          await updatePlan(p);
          go('learning');
          toast.success(session?'Your learning plan is ready.':'Plan ready for this session. Download it to keep a copy.');
          return;
        }
      } catch(e) {} finally { setBusy(false); }
      // Fallback
      const p = createPlan(goalTitle, skillsList, profile.hours);
      void updatePlan(p);
      go('learning');
      toast.success(session ? 'Your learning plan is ready.' : 'Plan ready for this session. Download it to keep a copy.');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile.hours, session, go]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const skills = params.get('skills');
    const source = params.get('source');
    if (skills && source === 'extension') {
      startPlan('Job Application (from Compass)', skills.split(','));
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, [startPlan]);

  function selectGoal(d: Degree) {
    const p = {...profile, goal: d.id};
    setProfile(p);
    void persist('/api/profile', p)
      .then(saved => setSync(saved ? 'Saved to account' : 'Guest session'))
      .catch(() => {
        setSync('Unsaved changes');
        toast.error('Direction selected, but account save failed.');
      });
    toast.success(`${d.name} is your current direction.`);
    go('dashboard');
  }

  async function signOut() {
    await client?.auth.signOut();
    sessionRef.current = null;
    setSession(null);
    setRecovery(false);
    setProfile(emptyProfile);
    setPlan(null);
    setSync('Guest session');
    go('dashboard');
    toast.success('Signed out. You are back in a guest session.');
  }

  useEffect(() => {
    type Registry = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: object;
          execute: (input: unknown) => unknown;
        },
        options: {signal: AbortSignal}
      ) => unknown;
    };
    const registry = (document as Document & {modelContext?: Registry}).modelContext;
    if (!registry) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        registry.registerTool(
          {
            name: 'navigate_coursecompass',
            description: 'Navigate to a CourseCompass AI workspace view. Does not change student records.',
            inputSchema: {
              type: 'object',
              properties: {
                view: {
                  type: 'string',
                  enum: [
                    'dashboard',
                    'explore',
                    'education',
                    'universities',
                    'careers',
                    'jobs',
                    'roadmap',
                    'learning',
                    'profile'
                  ]
                }
              },
              required: ['view'],
              additionalProperties: false
            },
            annotations: {readOnlyHint: false, untrustedContentHint: false},
            execute: input => {
              const v = (input as {view?: unknown})?.view;
              if (typeof v !== 'string') throw new Error('Unknown CourseCompass AI view');
              go(v);
              return {view: v};
            }
          },
          {signal: controller.signal}
        )
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [go]);

  function sidebarContent() {
    return (
      <>
        <a
          href="#dashboard"
          className={`brand ${view === 'dashboard' ? 'active-brand' : ''}`}
          onClick={e => {
            e.preventDefault();
            go('dashboard');
          }}
          aria-label="CourseCompass home and dashboard"
        >
          <span className="brand-mark">
            <Route size={24} />
          </span>
          CourseCompass<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">YOUR NEXT CHAPTER</div>
        <nav aria-label="Main navigation">
          {nav.map(n => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              aria-current={view === n.id ? 'page' : undefined}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {view === n.id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-note" onClick={() => setAdviser(true)}>
            <Sparkles size={25} />
            <strong>
              A little direction.
              <br />A world of possibility.
            </strong>
            <p>Talk it through with your career companion.</p>
            <span>
              Open adviser <ArrowRight size={14} />
            </span>
          </button>
          <button className="profile-link" onClick={() => go('profile')}>
            <span className="avatar">{profile.name?.[0]?.toUpperCase() || 'Y'}</span>
            <span>
              <strong>{profile.name || 'Your space'}</strong>
              <small>{profile.name ? 'Make your next move' : 'Make it your own'}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </div>
      </>
    );
  }

  return (
    <SidebarProvider className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar collapsible="none" className="sidebar desktop-sidebar">
        {sidebarContent()}
      </Sidebar>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="mobile-nav">
          <SheetTitle className="sr-only">CourseCompass AI navigation</SheetTitle>
          <SheetDescription className="sr-only">Explore your student workspace</SheetDescription>
          {sidebarContent()}
        </SheetContent>
      </Sheet>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button menu-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <button
              onClick={() => go('dashboard')}
              style={{ background: 'none', border: '0', padding: '0', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              aria-label="Go to home/dashboard"
            >
              <span>Your workspace</span>
            </button>
            <ChevronRight size={14} />
            <strong>
              {view === 'dashboard'
                ? session
                  ? 'Personalized Dashboard'
                  : 'Home'
                : nav.find(n => n.id === view)?.label || 'My Profile'}
            </strong>
          </div>
          <div className="top-actions">
            <span className="guest-pill">
              <span />
              {sync}
            </span>
            <button
              className="text-button sign-in-button"
              onClick={() => (session ? signOut() : setAuthOpen(true))}
            >
              {session ? (
                <>
                  <LogOut size={15} />
                  Sign out
                </>
              ) : (
                'Sign in'
              )}
            </button>
            <button className="avatar small" onClick={() => go('profile')} aria-label="Open profile">
              {profile.name?.[0]?.toUpperCase() || 'Y'}
            </button>
          </div>
        </header>
        <main id="main">
          {syncing && (
            <div className="inline-note" role="status">
              Loading your saved account…
            </div>
          )}
          {view === 'dashboard' && (
            <Dashboard
              go={go}
              onChat={() => setAdviser(true)}
              session={session}
              profile={profile}
              plan={plan}
              onStartPlan={startPlan}
              onSignIn={() => setAuthOpen(true)}
            />
          )}
          {view === 'explore' && <Explore profile={profile} onGoal={selectGoal} go={go} />}
          {view === 'universities' && (
            <Universities
              profile={profile}
              go={go}
              liveUniversities={catalogueData?.universities}
              dataSource={catalogueData?.dataSource}
              lastRunAt={catalogueData?.ingestion?.last_run_at}
              lastRunOk={catalogueData?.ingestion?.last_run_ok}
            />
          )}
          {view === 'jobs' && <Jobs profile={profile} onPlan={startPlan} />}
          {view === 'learning' && (
            <Learning plan={plan} profile={profile} onUpdate={updatePlan} onCreate={startPlan} go={go} />
          )}
          {view === 'profile' && (
            <ProfileView
              key={session?.user.id || 'guest'}
              profile={profile}
              onSave={saveProfile}
              cloud={!!session}
              busy={busy || syncing}
              email={session?.user.email || ''}
              onSignIn={() => setAuthOpen(true)}
              onSignOut={signOut}
              onChangePassword={() => {
                setRecovery(true);
                setAuthOpen(true);
              }}
            />
          )}
          <footer className="page-footer">
            <span>
              <MapPin size={14} />
              Rooted in Pakistan. Open to possibility.
            </span>
            <span>{session ? 'Your journey, in your account.' : 'Guest changes last for this session.'}</span>
          </footer>
        </main>
        <button className="floating-adviser" aria-label="Open career adviser" onClick={() => setAdviser(true)}>
          <Sparkles size={20} />
          <span>Ask CourseCompass AI</span>
        </button>
      </div>
      <Adviser
        open={adviser}
        onOpenChange={setAdviser}
        profile={profile}
        token={session?.access_token || ''}
        aiConfigured={aiConfigured}
        go={go}
      />
      <AuthDialog
        open={authOpen}
        onOpenChange={open => {
          setAuthOpen(open);
          if (!open) setRecovery(false);
        }}
        client={client}
        recovery={recovery}
        onRecovered={() => setRecovery(false)}
      />
      <Toaster position="bottom-center" />
    </SidebarProvider>
  );
}

