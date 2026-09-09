import { onRequestPost as authOnRequestPost } from '../../api/auth.js';

export async function onRequestPost(context) {
  return authOnRequestPost(context);
}
