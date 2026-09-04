# NEETPrep Project Structure

```text
src/
├── App.tsx                    # Student app orchestration + learning/test flows
├── AdminApp.tsx               # Private teacher authentication shell
├── main.tsx                   # Route-level entry: /, /website, /admin
│
├── design/
│   ├── tokens.css             # Shared NEETPrep visual tokens
│   └── README.md
│
├── components/
│   ├── ui/                    # Reusable primitives
│   └── branding/              # Logo/brand primitives
│
├── student/                   # Student-home experience + prep intelligence
├── website/                   # Public website experience
├── admin/                     # Teacher console + teacher data operations
├── data/                      # Question bank
└── lib/                       # Supabase + cloud sync

supabase/
├── 001_neetprep_core.sql
├── 002_question_attempts.sql
├── 003_teacher_command_center.sql
└── 004_student_communication.sql
```

The three experiences share design tokens and reusable UI primitives, but their screen-level UI stays separated by product area.
