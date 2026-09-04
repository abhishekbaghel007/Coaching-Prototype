# NEETPrep Design System

The student app, public website, and teacher console are separate experiences but share one visual foundation.

- `tokens.css` owns brand colours, surfaces, spacing, radii and shadows.
- `components/ui` contains reusable primitives.
- `components/branding` owns brand identity.
- Feature-specific screens stay in `student/`, `website/`, and `admin/`.

Do not create another ad-hoc design system inside a feature. Add reusable primitives here when a pattern appears in more than one experience.
