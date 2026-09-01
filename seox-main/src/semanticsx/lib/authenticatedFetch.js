import { auth } from '../../lib/firebase.js';

export async function authenticatedFetch(input, init = {}) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Please sign in to continue.');
    const headers = new Headers(init.headers || {});
    if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    headers.set('Authorization', `Bearer ${await currentUser.getIdToken()}`);
    let response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
        headers.set('Authorization', `Bearer ${await currentUser.getIdToken(true)}`);
        response = await fetch(input, { ...init, headers });
    }
    return response;
}

export async function authenticatedJson(input, init = {}) {
    const response = await authenticatedFetch(input, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
}
