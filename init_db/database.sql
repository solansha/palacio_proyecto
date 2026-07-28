-- Script de Inicializacion de la Base de Datos: Palacio de Festivales (POS & Facturacion)
CREATE DATABASE IF NOT EXISTS palacio_festivales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE palacio_festivales;

-- 0. Tabla Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) DEFAULT 'admin',
    estado TINYINT(1) DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1. Tabla Sala
CREATE TABLE IF NOT EXISTS sala (
    id_sala INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    capacidad INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla Zona
CREATE TABLE IF NOT EXISTS zona (
    id_zona INT AUTO_INCREMENT PRIMARY KEY,
    id_sala INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    multiplicador_precio DECIMAL(4,2) DEFAULT 1.00,
    FOREIGN KEY (id_sala) REFERENCES sala(id_sala) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla Butaca
CREATE TABLE IF NOT EXISTS butaca (
    id_butaca INT AUTO_INCREMENT PRIMARY KEY,
    id_zona INT NOT NULL,
    fila INT NOT NULL,
    numero INT NOT NULL,
    FOREIGN KEY (id_zona) REFERENCES zona(id_zona) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla Espectaculo
CREATE TABLE IF NOT EXISTS espectaculo (
    id_espectaculo INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    duracion_minutos INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla Actuacion
CREATE TABLE IF NOT EXISTS actuacion (
    id_actuacion INT AUTO_INCREMENT PRIMARY KEY,
    id_espectaculo INT NOT NULL,
    id_sala INT NOT NULL,
    fecha_hora DATETIME NOT NULL,
    precio_base DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_espectaculo) REFERENCES espectaculo(id_espectaculo) ON DELETE CASCADE,
    FOREIGN KEY (id_sala) REFERENCES sala(id_sala) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabla Entrada
CREATE TABLE IF NOT EXISTS entrada (
    id_entrada INT AUTO_INCREMENT PRIMARY KEY,
    id_actuacion INT NOT NULL,
    id_butaca INT NOT NULL,
    nombre_comprador VARCHAR(100) NOT NULL,
    email_comprador VARCHAR(100) NOT NULL,
    precio_final DECIMAL(10,2) NOT NULL,
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_actuacion) REFERENCES actuacion(id_actuacion) ON DELETE CASCADE,
    FOREIGN KEY (id_butaca) REFERENCES butaca(id_butaca) ON DELETE CASCADE,
    CONSTRAINT unique_actuacion_butaca UNIQUE (id_actuacion, id_butaca)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabla Producto (POS)
CREATE TABLE IF NOT EXISTS producto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    precio DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabla Venta / Factura (POS)
CREATE TABLE IF NOT EXISTS venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_factura VARCHAR(20) NOT NULL UNIQUE,
    cliente VARCHAR(150) NOT NULL DEFAULT 'Consumidor Final',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    iva DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    monto_pagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    vuelto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    estado ENUM('Completada', 'Anulada') DEFAULT 'Completada',
    id_usuario INT NULL,
    fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabla Detalle Venta (POS)
CREATE TABLE IF NOT EXISTS detalle_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal_linea DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES venta(id) ON DELETE CASCADE,
    FOREIGN KEY (id_producto) REFERENCES producto(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- LIMPIEZA Y REINICIALIZACION DE DATOS DE PRUEBA
DELETE FROM detalle_venta;
DELETE FROM venta;
DELETE FROM producto;
DELETE FROM entrada;
DELETE FROM actuacion;
DELETE FROM espectaculo;
DELETE FROM butaca;
DELETE FROM zona;
DELETE FROM sala;
DELETE FROM usuarios;

ALTER TABLE sala AUTO_INCREMENT = 1;
ALTER TABLE zona AUTO_INCREMENT = 1;
ALTER TABLE butaca AUTO_INCREMENT = 1;
ALTER TABLE espectaculo AUTO_INCREMENT = 1;
ALTER TABLE actuacion AUTO_INCREMENT = 1;
ALTER TABLE entrada AUTO_INCREMENT = 1;
ALTER TABLE usuarios AUTO_INCREMENT = 1;
ALTER TABLE producto AUTO_INCREMENT = 1;
ALTER TABLE venta AUTO_INCREMENT = 1;
ALTER TABLE detalle_venta AUTO_INCREMENT = 1;

-- Usuario de prueba inicial (password: admin123)
INSERT INTO usuarios (id, usuario, password_hash, nombre, rol, estado) VALUES 
(1, 'admin', '$2y$10$vO8k9gWjM9L4Gq7K.kX7U.zP8T1N0Q5Z2M6W9V8U7T6S5R4Q3P2O1', 'Administrador Principal', 'admin', 1);

-- Salas
INSERT INTO sala (nombre, capacidad) VALUES 
('Sala Pereda', 100), 
('Sala Argenta', 300);

-- Zonas
INSERT INTO zona (id_sala, nombre, multiplicador_precio) VALUES 
(1, 'Platea VIP', 1.30),
(1, 'Platea General', 1.10),
(1, 'Anfiteatro', 1.00),
(2, 'Patio de Butacas', 1.25),
(2, 'Palco Principal', 1.50);

-- Butacas
INSERT INTO butaca (id_zona, fila, numero) VALUES 
(1, 1, 1), (1, 1, 2), (1, 1, 3),
(2, 2, 1), (2, 2, 2), (2, 2, 3),
(3, 3, 1), (3, 3, 2),
(4, 1, 10), (4, 1, 11),
(5, 1, 1);

-- Espectaculos
INSERT INTO espectaculo (titulo, descripcion, duracion_minutos) VALUES 
('El Lago de los Cisnes', 'Representacion de danza clasica a cargo de la compania nacional.', 120),
('Sinfonia N 9 de Beethoven', 'Concierto de musica clasica interpretado por la Orquesta Filarmonica.', 90),
('La Vida es Sueno', 'Obra teatral del Siglo de Oro por Calderon de la Barca.', 105);

-- Actuaciones
INSERT INTO actuacion (id_espectaculo, id_sala, fecha_hora, precio_base) VALUES 
(1, 1, '2026-08-15 20:00:00', 30.00),
(2, 2, '2026-08-20 19:30:00', 45.00),
(3, 1, '2026-09-01 21:00:00', 25.00);

-- Entrada de prueba inicial
INSERT INTO entrada (id_actuacion, id_butaca, nombre_comprador, email_comprador, precio_final) VALUES
(1, 1, 'Jose Maria Gomez', 'jose.gomez@example.com', 39.00);

-- Productos POS de prueba (con codigos de barras)
INSERT INTO producto (codigo_barras, nombre, descripcion, precio, stock) VALUES
('77900010001', 'Programa de Mano Edicion Especial', 'Folleto impreso de coleccion con historia y fotos del festival', 5.00, 150),
('77900010002', 'Camiseta Oficial Palacio de Festivales', 'Camiseta 100% algodon con logo estampado talla M/L', 20.00, 80),
('77900010003', 'Taza Ceramica Souvenir', 'Taza de ceramica con ilustracion del Teatro Principal', 12.50, 45),
('77900010004', 'Agua Mineral Mineral 500ml', 'Botella de agua natural sin gas', 2.00, 200),
('77900010005', 'Vino Tinto Reserva Palacio (Copa)', 'Copa de vino tinto seleccion de la casa', 6.00, 60),
('77900010006', 'Snack Mix Frutos Secos 100g', 'Bolsa de frutos frutos secos tostados', 3.50, 90),
('77900010007', 'Llavero Conmemorativo Metal', 'Llavero de aleacion grabado a laser', 8.00, 110);

-- Facturas de prueba iniciales para KPIs
INSERT INTO venta (id, numero_factura, cliente, subtotal, iva, total, monto_pagado, vuelto, estado, id_usuario, fecha_venta) VALUES
(1, 'FAC-00001', 'Maria Fernandez', 25.00, 3.75, 28.75, 30.00, 1.25, 'Completada', 1, NOW() - INTERVAL 2 DAY),
(2, 'FAC-00002', 'Carlos Rodriguez', 40.00, 6.00, 46.00, 50.00, 4.00, 'Completada', 1, NOW() - INTERVAL 1 DAY),
(3, 'FAC-00003', 'Consumidor Final', 12.50, 1.88, 14.38, 20.00, 5.62, 'Completada', 1, NOW());

INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal_linea) VALUES
(1, 1, 1, 5.00, 5.00),
(1, 2, 1, 20.00, 20.00),
(2, 2, 2, 20.00, 40.00),
(3, 3, 1, 12.50, 12.50);