<?php
// Simple PHP script to add the index to user_projects table

$host = '127.0.0.1';
$user = 'root';
$password = '';
$database = 'code-step-mysql';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$database", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected to MySQL database.\n";
    
    // Check if index already exists
    $checkIndex = $pdo->query("SHOW INDEX FROM user_projects WHERE Key_name = 'idx_user_created'")->fetchAll();
    
    if (count($checkIndex) > 0) {
        echo "Index 'idx_user_created' already exists.\n";
    } else {
        echo "Creating index...\n";
        $pdo->exec("ALTER TABLE user_projects ADD INDEX idx_user_created (user_id, created_at DESC)");
        echo "Index 'idx_user_created' created successfully.\n";
    }
    
    // Verify
    $verify = $pdo->query("SHOW INDEX FROM user_projects WHERE Key_name = 'idx_user_created'")->fetchAll();
    if (count($verify) > 0) {
        echo "Verification: Index is present.\n";
        foreach ($verify as $row) {
            echo "  Column: " . $row['Column_name'] . ", Seq: " . $row['Seq_in_index'] . "\n";
        }
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
