/**
 * Piano Invaders Plugin Registry
 *
 * Creates a registry that merges contributions from an array of plugin objects.
 * Each plugin can provide songs, themes, leaderboard backends, song parsers,
 * and event listeners. The game works identically with zero plugins.
 */
export function createPluginRegistry(plugins = []) {
  const registry = {
    plugins: [...plugins],
    _disposed: false,
  };

  // Initialize all plugins
  registry.init = async () => {
    for (const p of registry.plugins) {
      if (p.init) {
        try { await p.init(); }
        catch (e) { console.warn(`Plugin ${p.name} init error:`, e); }
      }
    }
  };

  // Collect songs from all plugins that provide them
  registry.getSongs = async () => {
    const allSongs = [];
    for (const p of registry.plugins) {
      if (p.songs) {
        try {
          const songs = await p.songs();
          allSongs.push(...songs);
        } catch (e) { console.warn(`Plugin ${p.name} songs error:`, e); }
      }
    }
    return allSongs;
  };

  // Get leaderboard provider (last plugin wins), or null for default localStorage
  registry.getLeaderboard = () => {
    for (let i = registry.plugins.length - 1; i >= 0; i--) {
      if (registry.plugins[i].leaderboard) return registry.plugins[i].leaderboard;
    }
    return null;
  };

  // Merge all theme overrides (later plugins override earlier)
  registry.getTheme = () => {
    const merged = { cssVars: {}, className: '' };
    for (const p of registry.plugins) {
      if (p.theme) {
        try {
          const t = p.theme();
          Object.assign(merged.cssVars, t.cssVars || {});
          if (t.backgroundImage) merged.backgroundImage = t.backgroundImage;
          if (t.className) merged.className += ' ' + t.className;
        } catch (e) { console.warn(`Plugin ${p.name} theme error:`, e); }
      }
    }
    return merged;
  };

  // Try custom parsers in order; first non-null result wins
  registry.parseSong = (data) => {
    for (const p of registry.plugins) {
      if (p.parseSong) {
        try {
          const result = p.parseSong(data);
          if (result) return result;
        } catch (e) { console.warn(`Plugin ${p.name} parseSong error:`, e); }
      }
    }
    return null;
  };

  // Emit an event to all listeners
  registry.emit = (eventName, data) => {
    for (const p of registry.plugins) {
      if (p[eventName]) {
        try { p[eventName](data); }
        catch (e) { console.warn(`Plugin ${p.name} ${eventName} error:`, e); }
      }
    }
  };

  // Dispose all plugins
  registry.dispose = () => {
    if (registry._disposed) return;
    registry._disposed = true;
    for (const p of registry.plugins) {
      if (p.dispose) {
        try { p.dispose(); }
        catch (e) { console.warn(`Plugin ${p.name} dispose error:`, e); }
      }
    }
  };

  return registry;
}
