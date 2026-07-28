<?php
/**
 * Conexión segura a la Base de Datos utilizando PDO con soporte completo para UTF-8 (tildes y caracteres especiales)
 * Incluye Auto-Inicialización de la Base de Datos y Tablas en caso de faltar (Prevención SQLSTATE[42S02])
 * Palacio de Festivales
 */

$host   = getenv('DB_HOST') ?: 'sql10.freesqldatabase.com';
$port   = getenv('DB_PORT') ?: '3306';
$db     = getenv('DB_DATABASE') ?: 'sql10834032';
$user   = getenv('DB_USER') ?: 'sql10834032';
$pass   = getenv('DB_PASSWORD') ?: 'jnVbJklYth';
$charset = $engine === 'pgsql' ? 'utf8' : 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::ATTR_TIMEOUT            => 5,
];

if ($engine === 'mysql') {
    $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci";
    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
} else {
    $dsn = "pgsql:host=$host;port=$port;dbname=$db";
}

try {
    // 1. Intentar conectar directamente a la base de datos
    $pdo = new PDO($dsn, $user, $pass, $options);
    if ($engine === 'mysql') {
        $pdo->exec("SET NAMES utf8mb4");
    }

} catch (\PDOException $e) {
    if ($engine === 'mysql' && ($e->getCode() == 1049 || strpos($e->getMessage(), 'Unknown database') !== false)) {
        try {
            $pdoRoot = new PDO("mysql:host=$host;port=$port;charset=$charset", $user, $pass, $options);
            $pdoRoot->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=$charset", $user, $pass, $options);
            $pdo->exec("SET NAMES utf8mb4");
        } catch (\PDOException $ex) {
            die("Error crítico al intentar crear la base de datos: " . htmlspecialchars($ex->getMessage(), ENT_QUOTES, 'UTF-8'));
        }
    } else {
        die("Error crítico de conexión a la base de datos: " . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8'));
    }
}

// 2. Auto-verificación de tablas existentes y auto-ejecución del script SQL si falta la tabla 'venta' u otras
try {
    $checkStmt = $pdo->query("SHOW TABLES LIKE 'venta'");
    $tablaVentaExiste = $checkStmt->fetch();

    if (!$tablaVentaExiste) {
        // Cargar e inicializar base de datos desde init_db/database.sql
        $sqlPath = __DIR__ . '/../init_db/database.sql';
        if (file_exists($sqlPath)) {
            $sqlContent = file_get_contents($sqlPath);
            // Ejecutar consultas SQL divididas
            $pdo->exec($sqlContent);
        }
    }

    // Verificar si la tabla actuacion tiene la columna 'asientos_ofrecidos'
    $colCheck = $pdo->query("SHOW COLUMNS FROM `actuacion` LIKE 'asientos_ofrecidos'");
    if (!$colCheck->fetch()) {
        $pdo->exec("ALTER TABLE `actuacion` ADD COLUMN `asientos_ofrecidos` INT NOT NULL DEFAULT 100 AFTER `precio_base`");
    }

} catch (\Exception $e) {
    // Si falla la verificación, continuar para permitir depuración
}

