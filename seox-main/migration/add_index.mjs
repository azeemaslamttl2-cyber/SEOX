import mysql from 'mysql2/promise';

async function addIndex() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'code-step-mysql',
    });

    console.log('Connected to MySQL database.');

    // Check if index already exists
    const [indexes] = await connection.query(
      "SHOW INDEX FROM user_projects WHERE Key_name = 'idx_user_created'"
    );

    if (indexes.length > 0) {
      console.log("Index 'idx_user_created' already exists.");
    } else {
      console.log('Creating index...');
      await connection.query(
        'ALTER TABLE user_projects ADD INDEX idx_user_created (user_id, created_at DESC)'
      );
      console.log("Index 'idx_user_created' created successfully.");
    }

    // Verify
    const [verify] = await connection.query(
      "SHOW INDEX FROM user_projects WHERE Key_name = 'idx_user_created'"
    );

    if (verify.length > 0) {
      console.log('Verification: Index is present.');
      verify.forEach((row) => {
        console.log(
          `  Column: ${row.Column_name}, Seq: ${row.Seq_in_index}`
        );
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

addIndex();
