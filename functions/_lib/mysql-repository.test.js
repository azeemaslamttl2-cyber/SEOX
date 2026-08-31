import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStorageTarget, buildRowPayload } from './mysql-repository.js';

test('maps user project collections to the user_projects table', () => {
  const target = resolveStorageTarget('users/test-user/projects', 'project-1');
  assert.equal(target.table, 'user_projects');
  assert.equal(target.userId, 'test-user');
  assert.equal(target.projectId, 'project-1');
});

test('maps dynamic user project collections to the user_projects table', () => {
  const target = resolveStorageTarget('users/42/projects', 'proj_123');
  assert.equal(target.table, 'user_projects');
  assert.equal(target.userId, '42');
  assert.equal(target.projectId, 'proj_123');
});

test('maps tool result collections to the tool_results table', () => {
  const target = resolveStorageTarget('users/42/projects/proj_123/toolResults', 'semantic');
  assert.equal(target.table, 'tool_results');
  assert.equal(target.userId, '42');
  assert.equal(target.projectId, 'proj_123');
  assert.equal(target.toolKey, 'semantic');
});

test('maps admin settings to the admin_settings table', () => {
  const target = resolveStorageTarget('adminSettings', 'apis');
  assert.equal(target.table, 'admin_settings');
  assert.equal(target.settingKey, 'apis');
});

test('builds a row payload for tool result writes', () => {
  const payload = buildRowPayload(
    'users/42/projects/proj_123/toolResults',
    'semantic',
    {
      projectId: 'proj_123',
      toolKey: 'semantic',
      result: { ok: true },
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
  );

  assert.equal(payload.user_id, '42');
  assert.equal(payload.project_id, 'proj_123');
  assert.equal(payload.tool_key, 'semantic');
  assert.equal(payload.result.ok, true);
});

test('builds a row payload for user project writes', () => {
  const payload = buildRowPayload(
    'users/42/projects',
    'proj_123',
    {
      id: 'proj_123',
      name: 'My Project',
      domain: 'example.com',
      fullUrl: 'https://example.com',
      protocol: 'https-http',
      scope: 'subdomains',
      folder: 'none',
      schedule: 'weekly',
      userAgent: 'seox-desktop',
      renderJs: 0,
      respectRobots: 1,
      notifyEmail: 1,
      owner: 'user@example.com',
    }
  );

  assert.equal(payload.user_id, '42');
  assert.equal(payload.project_id, 'proj_123');
  assert.equal(payload.project_name, 'My Project');
  assert.equal(payload.domain, 'example.com');
  assert.equal(payload.full_url, 'https://example.com');
});
