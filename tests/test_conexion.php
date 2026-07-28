<?php
/**
 * Test de Conexión PDO y verificación de la base de datos
 */
require_once __DIR__ . '/../backend/conexion.php';

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Test de Conexión - Palacio de Festivales</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; }
        .card { background: #1e293b; padding: 25px; border-radius: 12px; max-width: 600px; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h2 { margin-top: 0; color: #38bdf8; }
        .success { background: #064e3b; color: #6ee7b7; padding: 12px 16px; border-radius: 6px; border-left: 5px solid #10b981; }
        .error { background: #7f1d1d; color: #fca5a5; padding: 12px 16px; border-radius: 6px; border-left: 5px solid #ef4444; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 10px; border-bottom: 1px solid #334155; text-align: left; }
        th { color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Prueba de Conexión PDO</h2>
        <?php
        try {
            $stmt = $pdo->query("SELECT DATABASE()");
            $dbName = $stmt->fetchColumn();
            echo "<div class='success'><strong>Conexión Exitosa:</strong> Conectado a la base de datos <em>" . htmlspecialchars($dbName) . "</em> en MySQL (XAMPP).</div>";

            // Obtener conteo de tablas
            $tables = ['sala', 'zona', 'butaca', 'espectaculo', 'actuacion', 'entrada'];
            echo "<h3>Estado de Tablas</h3>";
            echo "<table><thead><tr><th>Tabla</th><th>Registros</th></tr></thead><tbody>";
            foreach ($tables as $table) {
                $count = $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
                echo "<tr><td>" . htmlspecialchars($table) . "</td><td><strong>$count</strong></td></tr>";
            }
            echo "</tbody></table>";
        } catch (Exception $e) {
            echo "<div class='error'><strong>Error de Conexión:</strong> " . htmlspecialchars($e->getMessage()) . "</div>";
        }
        ?>
    </div>
</body>
</html>