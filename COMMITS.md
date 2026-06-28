## כללי כתיבת commit messages
- fix: תיקון באג → מקדם PATCH (1.0.0 → 1.0.1)
- feat: תוספת feature → מקדם MINOR (1.0.0 → 1.1.0)
- feat!: שינוי שבור → מקדם MAJOR (1.0.0 → 2.0.0)
- chore: תחזוקה, עדכון תלויות → לא מקדם גרסה
- docs: עדכון תיעוד → לא מקדם גרסה

## איך מקדמים גרסה
npm run release        ← קידום אוטומטי לפי commits
npm run release:patch  ← כפיית PATCH
npm run release:minor  ← כפיית MINOR
npm run release:major  ← כפיית MAJOR
