const cfg = await import('./appThemeConfig.ts');
const app = await import('./appTheme.mjs');
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) process.exitCode = 1; };
for (const p of cfg.THEME_PRESETS) {
  const r = cfg.appThemeConfigSchema.safeParse(p.config);
  if (!r.success) { ok(false, p.name + ' ' + JSON.stringify(r.error.issues[0])); continue; }
  const sp = app.resolveAppTheme({ id: 'x', config: r.data }).splash;
  ok(p.id === 'classic' ? sp === null : sp && sp.art === r.data.splash.art, `${p.name.padEnd(28)} art=${sp?.art ?? '-'}`);
}
ok(!cfg.appThemeConfigSchema.safeParse({ splash: { art: 'bogus' } }).success, 'server rejects unknown artwork');
ok(app.resolveAppTheme({ id: 'x', config: { splash: { enabled: true, art: 'future-art' } } }).splash.art === null, 'app ignores artwork it does not know (newer server)');
