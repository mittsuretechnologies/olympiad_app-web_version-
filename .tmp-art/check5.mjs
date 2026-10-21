const cfg = await import('./appThemeConfig.ts');
const app = await import('./appTheme.mjs');
let bad = 0;
for (const p of cfg.THEME_PRESETS) {
  const r = cfg.appThemeConfigSchema.safeParse(p.config);
  if (!r.success) { bad++; console.log('FAIL', p.name, JSON.stringify(r.error.issues[0])); continue; }
  const h = app.resolveAppTheme({ id: 'x', config: r.data }).hero;
  console.log(h ? 'ok  ' : '    ', p.name.padEnd(28), 'headerArt =', h?.headerArt ?? '(no festive top)');
}
const b = app.resolveAppTheme({ id: 'x', config: cfg.appThemeConfigSchema.parse({}) }).hero;
console.log(b.headerArt === null ? 'ok  ' : 'FAIL', 'blank theme → no header decoration');
process.exitCode = bad;
