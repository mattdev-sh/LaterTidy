// MAIN world. Answers a config request with a JSON snapshot of ytcfg. Nothing else lives here.
document.addEventListener('latertidy:config-request', () => {
  const d = (window as any).ytcfg?.data_ ?? {};
  const detail = JSON.stringify({
    apiKey: d.INNERTUBE_API_KEY ?? '',
    clientVersion: d.INNERTUBE_CLIENT_VERSION ?? '',
    context: d.INNERTUBE_CONTEXT ?? null,
    sessionIndex: String(d.SESSION_INDEX ?? ''),
    delegatedSessionId: d.DELEGATED_SESSION_ID ?? '',
    datasyncId: d.DATASYNC_ID ?? '',
    visitorData: d.VISITOR_DATA ?? '',
    loggedIn: !!d.LOGGED_IN,
    hl: d.HL ?? '',
  });
  document.dispatchEvent(new CustomEvent('latertidy:config', { detail }));
});
