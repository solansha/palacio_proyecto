<?php
/**
 * Conexión segura a la Base de Datos con PDO
 * Palacio de Festivales
 */

$engine  = getenv('DB_ENGINE')   ?: 'mysql';
$host    = getenv('DB_HOST')     ?: 'sql10.freesqldatabase.com';
$port    = getenv('DB_PORT')     ?: '3306';
$db      = getenv('DB_DATABASE') ?: 'sql10834032';
$user    = getenv('DB_USER')     ?: 'sql10834032';
$pass    = getenv('DB_PASSWORD') ?: 'jnVbJklYth';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::ATTR_TIMEOUT            => 5,
];

try {
    if ($engine === 'mysql') {
        $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
        $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4";
    } else {
        $dsn = "pgsql:host=$host;port=$port;dbname=$db";
    }

    $pdo = new PDO($dsn, $user, $pass, $options);

} catch (\PDOException $e) {
    die("Error de conexión a la base de datos: " . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'));
}
?>