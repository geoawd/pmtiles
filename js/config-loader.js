(() => {
  const profileConfigs = {
    public: 'config/config.js',
    internal: 'config/config.internal.js'
  };
  const profile = new URLSearchParams(window.location.search).get('profile') || 'public';

  const showError = message => {
    console.error(message);
    const panel = document.createElement('div');
    panel.setAttribute('role', 'alert');
    Object.assign(panel.style, {
      position: 'fixed',
      zIndex: '10000',
      inset: '1rem 1rem auto',
      padding: '1rem',
      border: '1px solid #b00020',
      background: '#fff',
      color: '#b00020',
      fontFamily: 'sans-serif'
    });
    panel.textContent = message;
    document.body.prepend(panel);
  };

  if (!Object.prototype.hasOwnProperty.call(profileConfigs, profile)) {
    showError(`Unknown configuration profile "${profile}". Choose ${Object.keys(profileConfigs).join(' or ')}.`);
    return;
  }

  window.CONFIG_PROFILE = profile;
  const loadScript = src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}.`));
    document.body.appendChild(script);
  });
  const encodeCogUrls = config => {
    const encode = value => typeof value === 'string' ? encodeURI(value) : value;
    (config.overlays || []).forEach(overlay => {
      if (overlay && typeof overlay === 'object' && typeof overlay.cog === 'string') {
        overlay.cog = encode(overlay.cog);
      }
    });
    if (typeof config.terrain?.cog === 'string') config.terrain.cog = encode(config.terrain.cog);
    (config.terrain?.models || []).forEach(model => {
      if (model && typeof model === 'object' && typeof model.cog === 'string') {
        model.cog = encode(model.cog);
      }
    });
  };

  loadScript(profileConfigs[profile])
    .then(() => {
      if (!window.CONFIG) throw new Error(`${profileConfigs[profile]} did not define window.CONFIG.`);
      encodeCogUrls(window.CONFIG);
      return loadScript('js/styles.js');
    })
    .catch(error => showError(`Could not start the ${profile} profile: ${error.message}`));
})();
