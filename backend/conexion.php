<?php
/**
 * Conexión segura a la Base de Datos utilizando PDO con soporte completo para UTF-8 (tildes y caracteres especiales)
 * Incluye Auto-Inicialización de la Base de Datos y Tablas en caso de faltar (Prevención SQLSTATE[42S02])
 * Palacio de Festivales
 */

$host    = '127.0.0.1';
$db      = 'palacio_festivales';
$user    = 'root';
$pass    = '';
$charset = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::ATTR_TIMEOUT            => 5,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
];

try {
    // 1. Intentar conectar directamente a la base de datos
    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    $pdo = new PDO($dsn, $user, $pass, $options);
    $pdo->exec("SET NAMES utf8mb4");

} catch (\PDOException $e) {
    // Si la base de datos no existe (error 1049), intentar crearla
    if ($e->getCode() == 1049 || strpos($e->getMessage(), 'Unknown database') !== false) {
        try {
            $pdoRoot = new PDO("mysql:host=$host;charset=$charset", $user, $pass, $options);
            $pdoRoot->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
            $pdo = new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass, $options);
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

