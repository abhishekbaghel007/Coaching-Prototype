import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import TeacherCommandCenter from './TeacherCommandCenter';
import MockTestStudioV2 from './MockTestStudioV2';
import StudentProgressView from './StudentProgressView';
import { loadAdminStudents, type AdminStudent } from './admin';

type Props = { user: User; onExit: () => void };

export default function TeacherCommandCenterEnhanced({ user, onExit }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [studentLookupBusy, setStudentLookupBusy] = useState(false);

  useEffect(() => {
    let button: HTMLButtonElement | null = null;
    let timer: number | undefined;
    let attempts = 0;
    const install = () => {
      const sidebar = document.querySelector<HTMLElement>('.tcc-sidebar');
      if (!sidebar) { if (attempts++ < 60) timer = window.setTimeout(install, 100); return; }
      if (sidebar.querySelector('[data-mock-test-nav]')) return;
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.mockTestNav = 'true';
      button.innerHTML = '<i>✦</i><span>Mock Tests</span>';
      button.addEventListener('click', () => setOpen(true));
      sidebar.insertBefore(button, sidebar.querySelector('.tcc-sidebar-bottom'));
    };
    install();
    return () => { if (timer) window.clearTimeout(timer); button?.remove(); };
  }, []);

  async function handleRosterClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button');
    if (!button || button.textContent?.trim() !== 'View →') return;
    const row = button.closest('.tcc-student-row');
    if (!row) return;
    const identity = row.querySelector('div:nth-child(2)');
    const name = identity?.querySelector('b')?.textContent?.trim() || '';
    const email = identity?.querySelector('small')?.textContent?.trim() || '';
    setStudentLookupBusy(true);
    try {
      const roster = await loadAdminStudents();
      const student = roster.find(item => (email && item.email === email) || (name && item.display_name === name));
      if (student) setSelectedStudent(student);
    } finally {
      setStudentLookupBusy(false);
    }
  }

  return <div onClickCapture={handleRosterClick}>
    <style>{`[data-mock-test-nav]{border:0;background:transparent;color:#8c979e;width:100%;display:flex;align-items:center;gap:11px;border-radius:12px;padding:11px 12px;margin:2px 0;font:inherit;font-size:13px;font-weight:750;text-align:left;cursor:pointer}[data-mock-test-nav]:hover{background:rgba(255,255,255,.055);color:#f3f6f7}[data-mock-test-nav] i{font-style:normal;width:18px;text-align:center;color:#58d0c0}@media(max-width:900px){.tcc-sidebar{grid-template-columns:repeat(7,1fr)!important}.tcc-sidebar>[data-mock-test-nav]{display:grid;justify-items:center;gap:3px;padding:8px 3px;margin:0;font-size:8px}.tcc-sidebar>[data-mock-test-nav] i{font-size:15px}}`}</style>
    <TeacherCommandCenter user={user} onExit={onExit} />
    {studentLookupBusy && <div className="student-lookup-toast">Loading student health profile…</div>}
    {open && <MockTestStudioV2 onClose={() => setOpen(false)} />}
    {selectedStudent && <StudentProgressView student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
    <style>{`.student-lookup-toast{position:fixed;right:20px;bottom:20px;z-index:70;padding:10px 13px;border:1px solid rgba(88,208,192,.2);background:rgba(8,14,16,.92);backdrop-filter:blur(16px);border-radius:12px;color:#9bd9d2;font:800 10px Inter,system-ui,sans-serif;box-shadow:0 15px 50px rgba(0,0,0,.35)}`}</style>
  </div>;
}
