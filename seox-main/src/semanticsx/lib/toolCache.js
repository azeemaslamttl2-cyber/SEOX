const buildToolCacheKey = (toolName, projectId) => {
    const scope = projectId ? projectId : 'global';
    return `tool_cache:${toolName}:${scope}`;
};

export const readToolCache = (toolName, projectId, maxAgeMs) => {
    try {
        const key = buildToolCacheKey(toolName, projectId);
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
            const ts = parsed?.timestamp;
            const isValidTimestamp = Number.isFinite(ts) && ts > 0;
            const isExpired = !isValidTimestamp || (Date.now() - ts > maxAgeMs);
            if (isExpired) {
                localStorage.removeItem(key);
                return null;
            }
        }

        return parsed;
    } catch (error) {
        console.error(`Error reading ${toolName} cache:`, error);
        return null;
    }
};

export const writeToolCache = (toolName, projectId, data) => {
    try {
        localStorage.setItem(buildToolCacheKey(toolName, projectId), JSON.stringify(data));
        return true;
    } catch (error) {
        console.error(`Error saving ${toolName} cache:`, error);
        return false;
    }
};

export const removeToolCache = (toolName, projectId) => {
    try {
        localStorage.removeItem(buildToolCacheKey(toolName, projectId));
    } catch (error) {
        console.error(`Error clearing ${toolName} cache:`, error);
    }
};
