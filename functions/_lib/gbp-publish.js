// The single path from a stored gbp_posts row to a live Google post.
//
// Both the Posts Manager endpoint and the background job runner call this, so
// validation, the circuit breaker and the failure bookkeeping cannot drift
// between "publish now" and "publish on schedule".

import { createLocalPost, deleteLocalPost, updateLocalPost } from './gbp-client.js';
import { buildLocalPost, nextBlockState, postingBlocked, validatePost } from './gbp-posts.js';
import { logSync, updatePostingState } from './gbp-repository.js';
import { updatePost } from './gbp-store.js';

function rowToPost(row) {
  return {
    topicType: row.topic_type,
    summary: row.summary,
    ctaType: row.cta_type,
    ctaUrl: row.cta_url,
    mediaUrl: row.media_url,
    eventTitle: row.event_title,
    eventStart: row.event_start ? `${row.event_start}Z`.replace(' ', 'T') : null,
    eventEnd: row.event_end ? `${row.event_end}Z`.replace(' ', 'T') : null,
    offerCoupon: row.offer_coupon,
    offerTerms: row.offer_terms,
    offerRedeemUrl: row.offer_redeem_url,
  };
}

/**
 * Publish (or re-publish) one stored post.
 * Returns { published: boolean, post, errors?, blocked? }.
 */
export async function publishStoredPost(env, { connection, location, post, userId }) {
  const blocked = postingBlocked(location);
  if (blocked) {
    return {
      published: false,
      blocked,
      errors: [
        `Posting is paused for ${location.business_name} until ${blocked.until} after ${blocked.failures} rejections. Clear the block once the cause is fixed.`,
      ],
      post,
    };
  }

  const payload = rowToPost(post);
  const validation = validatePost(payload);
  if (!validation.valid) {
    // A post that fails our own checks never reaches Google, so it does not
    // count towards the circuit breaker.
    const updated = await updatePost(userId, post.id, {
      status: 'failed',
      lastError: validation.errors.join(' '),
    });
    return { published: false, errors: validation.errors, warnings: validation.warnings, post: updated };
  }

  const localPost = buildLocalPost(payload, { languageCode: 'en' });

  try {
    const created = post.google_post_name
      ? await updateLocalPost(env, connection, post.google_post_name, localPost, [
          'summary',
          'callToAction',
          'media',
          ...(payload.topicType === 'STANDARD' ? [] : ['event']),
          ...(payload.topicType === 'OFFER' ? ['offer'] : []),
        ])
      : await createLocalPost(env, connection, connection.account_id, location.location_id, localPost);

    const updated = await updatePost(userId, post.id, {
      status: 'published',
      googlePostName: created?.name || post.google_post_name || null,
      publishedAt: new Date(),
      lastError: null,
      incrementAttempts: true,
    });

    await updatePostingState(userId, location.id, nextBlockState(location, 'success'));
    await logSync({
      userId,
      projectId: post.project_id,
      locationRowId: location.id,
      syncType: 'post-publish',
      status: 'success',
      message: created?.name || null,
    });

    return { published: true, post: updated, warnings: validation.warnings };
  } catch (error) {
    const message = error?.message || 'Google rejected the post.';

    // Quota exhaustion is a temporary condition, not a policy problem, so it
    // must not push the location towards a posting block.
    const isQuota = error?.code === 'QUOTA_EXCEEDED' || error?.status === 429;
    if (!isQuota) {
      await updatePostingState(userId, location.id, nextBlockState(location, 'failure', message));
    }

    const updated = await updatePost(userId, post.id, {
      status: isQuota ? 'scheduled' : 'failed',
      lastError: message,
      incrementAttempts: true,
    });

    await logSync({
      userId,
      projectId: post.project_id,
      locationRowId: location.id,
      syncType: 'post-publish',
      status: 'error',
      message,
    });

    return { published: false, errors: [message], retryable: isQuota, post: updated };
  }
}

export async function deleteStoredPost(env, { connection, post, userId }) {
  if (post.google_post_name) {
    try {
      await deleteLocalPost(env, connection, post.google_post_name);
    } catch (error) {
      // A post already removed inside Google should still be removable here.
      if (error?.status !== 404) throw error;
    }
  }
}
