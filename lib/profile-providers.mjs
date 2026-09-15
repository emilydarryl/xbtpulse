// Provider ownership links telemetry to a profile, never to on-chain blocks.
export function profileProviderIds(store, registry, id) {
  const ids = new Set(registry.find((entry) => entry.id === id)?.providerIds || []);
  const profile = store.get('pool-profile:' + id);
  if (profile?.applicationId) {
    const application = store.applications().find((app) => app.id === profile.applicationId);
    if (application?.status === 'approved' && application.body.profileConsent === true) {
      for (const provider of store.db.prepare('SELECT id FROM providers WHERE application = ?').all(application.id)) {
        ids.add(provider.id);
      }
    }
  }
  return [...ids];
}
