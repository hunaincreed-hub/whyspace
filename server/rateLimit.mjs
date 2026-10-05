export const createWindowLimiter = ({ limit, windowMs, now = Date.now }) => {
  const windows = new Map();
  let calls = 0;
  return (key) => {
    const currentTime = now();
    let window = windows.get(key);
    if (!window || currentTime >= window.resetAt) {
      window = { count: 0, resetAt: currentTime + windowMs };
      windows.set(key, window);
    }
    window.count += 1;
    calls += 1;
    if (calls % 100 === 0) {
      for (const [entryKey, entry] of windows) if (currentTime >= entry.resetAt) windows.delete(entryKey);
    }
    return { allowed: window.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - currentTime) / 1000)) };
  };
};