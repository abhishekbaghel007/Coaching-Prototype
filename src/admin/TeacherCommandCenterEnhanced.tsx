import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import TeacherCommandCenter from './TeacherCommandCenter';
import MockTestStudio from './MockTestStudio';

type Props = { user: User; onExit: () => void };

export default function TeacherCommandCenterEnhanced({ user, onExit }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let button: HTMLButtonElement | null = null;
    let sidebar: HTMLElement | null = null;
    let retry = 0;
    let timer: number | undefined;

    const install = () => {
      sidebar = document.querySelector('.tcc-sidebar');
      if (!sidebar) {
        if (retry++ < 30) timer = window.setTimeout(install, 100);
        return;
      }
      if (sidebar.querySelector('[data-mock-test-nav]')) return;
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.mockTestNav = 'true';
      button.innerHTML = '<i>✦</i><span>Mock Tests</span>';
      button.addEventListener('click', () => setOpen(true));
      sidebar.insertBefore(button, sidebar.querySelector('.tcc-sidebar-bottom'));
    };

    install();
    return () => {
      if (timer) window.clearTimeout(timer);
      button?.remove();
    };
  }, []);

  return <>
    <style>{`
      [data-mock-test-nav]{border:0;background:transparent;color:#8c979e;width:100%;display:flex;align-items:center;gap:11px;border-radius:12px;padding:11px 12px;margin:2px 0;font:inherit;font-size:13px;font-weight:750;text-align:left;cursor:pointer}
      [data-mock-test-nav]:hover{background:rgba(255,255,255,.055);color:#f3f6f7}
      [data-mock-test-nav] i{font-style:normal;width:18px;text-align:center;color:#58d0c0}
      @media(max-width:900px){.tcc-sidebar{grid-template-columns:repeat(7,1fr)!important}.tcc-sidebar>[data-mock-test-nav]{display:grid;justify-items:center;gap:3px;padding:8px 3px;margin:0;font-size:8px}.tcc-sidebar>[data-mock-test-nav] i{font-size:15px}}
    `}</style>
    <TeacherCommandCenter user={user} onExit={onExit} />
    {open && <MockTestStudio onClose={() => setOpen(false)} />}
  </>;
}
