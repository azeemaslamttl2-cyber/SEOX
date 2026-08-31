// server/api/save-project.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      project_id,
      project_name,
      domain,
      full_url,
      protocol,
      scope,
      folder,
      schedule,
      user_agent,
      url_limit,
      render_js,
      respect_robots,
      notify_email,
      owner,
      owner_email,
      owner_uid,
      project_data
    } = req.body;

    // Get user_id from auth or session
    const user_id = req.user?.id || 1; // Replace with actual user ID from auth

    // Check if project already exists
    const [existing] = await pool.query(
      'SELECT id FROM user_projects WHERE user_id = ? AND project_id = ?',
      [user_id, project_id]
    );

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let result;
    if (existing.length > 0) {
      // Update existing project
      [result] = await pool.query(
        `UPDATE user_projects SET
          project_name = ?,
          domain = ?,
          full_url = ?,
          protocol = ?,
          scope = ?,
          folder = ?,
          schedule = ?,
          user_agent = ?,
          url_limit = ?,
          render_js = ?,
          respect_robots = ?,
          notify_email = ?,
          owner = ?,
          owner_email = ?,
          owner_uid = ?,
          project_data = ?,
          updated_at = ?
        WHERE user_id = ? AND project_id = ?`,
        [
          project_name,
          domain,
          full_url,
          protocol,
          scope,
          folder,
          schedule,
          user_agent,
          url_limit,
          render_js ? 1 : 0,
          respect_robots ? 1 : 0,
          notify_email ? 1 : 0,
          owner,
          owner_email,
          owner_uid,
          JSON.stringify(project_data || {}),
          now,
          user_id,
          project_id
        ]
      );
    } else {
      // Insert new project
      [result] = await pool.query(
        `INSERT INTO user_projects (
          user_id,
          project_id,
          project_name,
          domain,
          full_url,
          protocol,
          scope,
          folder,
          schedule,
          user_agent,
          url_limit,
          render_js,
          respect_robots,
          notify_email,
          owner,
          owner_email,
          owner_uid,
          project_data,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          project_id,
          project_name,
          domain,
          full_url,
          protocol,
          scope,
          folder,
          schedule,
          user_agent,
          url_limit,
          render_js ? 1 : 0,
          respect_robots ? 1 : 0,
          notify_email ? 1 : 0,
          owner,
          owner_email,
          owner_uid,
          JSON.stringify(project_data || {}),
          now,
          now
        ]
      );
    }

    res.status(200).json({
      success: true,
      message: existing.length > 0 ? 'Project updated successfully' : 'Project created successfully',
      project_id: project_id
    });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      error: 'Failed to save project',
      message: error.message
    });
  }
}