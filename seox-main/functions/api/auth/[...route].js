// Cloudflare Pages Functions use [[route]].js for a catch-all segment, not the
// Next.js [...route].js this file is named with, so it is unlikely to be routed
// at all. It is kept as a thin, correct delegate rather than left in a state
// that cannot even be parsed: the previous version imported onRequestPost and
// re-declared the same name, which is a SyntaxError in ESM.
//
// /api/auth/* is served by functions/api/auth.js.
import { onRequestPost as authOnRequestPost } from '../auth.js';

export async function onRequestPost(context) {
  return authOnRequestPost(context);
}
