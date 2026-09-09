// Shared request guards for the /api/gbp/* endpoints.

import { getStoredDocument } from './mysql-storage.js';
import { getConnection, getLocationRow, getPrimaryLocation } from './gbp-repository.js';

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function requireProject(env, userId, projectId) {
  if (!projectId) throw httpError('A project must be selected first.', 400);
  const project = await getStoredDocument(env, `users/${userId}/projects`, projectId);
  if (!project) throw httpError('Project was not found.', 404);
  return project;
}

export async function requireConnection(env, userId, projectId) {
  await requireProject(env, userId, projectId);
  const connection = await getConnection(userId, projectId);
  if (!connection) throw httpError('No Business Profile is connected to this project.', 404);
  if (connection.status !== 'connected') {
    throw httpError(
      connection.status_detail || 'Business Profile connection needs to be re-authorised.',
      401
    );
  }
  return connection;
}

export async function requireConnectionWithAccount(env, userId, projectId) {
  const connection = await requireConnection(env, userId, projectId);
  if (!connection.account_id) {
    throw httpError('Select a Business Profile account before loading locations.', 409);
  }
  return connection;
}

/**
 * The location an endpoint should act on: the one named, or the project's
 * primary. The project_id check is what stops a caller passing a location row
 * that belongs to one of their other projects.
 */
export async function resolveLocation(userId, projectId, locationRowId) {
  const location = locationRowId
    ? await getLocationRow(userId, locationRowId)
    : await getPrimaryLocation(userId, projectId);
  if (!location || location.project_id !== projectId) {
    throw httpError('No Business Profile location is attached to this project yet.', 404);
  }
  return location;
}
