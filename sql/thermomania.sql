-- 1. Crear la base de datos y usarla
CREATE DATABASE IF NOT EXISTS thermomania;
USE thermomania;

-- ========================================================
-- SISTEMA DE USUARIOS Y AUTENTICACIÓN
-- ========================================================

-- 2. Tabla principal de usuarios (Ya incluye el mfa_enabled del bug de ayer)
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'usuario',
    mfa_enabled TINYINT(1) DEFAULT 0,
    login_attempts INT DEFAULT 0,
    locked_until DATETIME DEFAULT NULL,
    activo TINYINT(1) DEFAULT 1,
    preferencias JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de control de sesiones activas (Multidispositivo)
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY, -- Usamos VARCHAR(36) porque en tu Node usas randomUUID()
    user_id INT NOT NULL,
    ip VARCHAR(45),
    user_agent TEXT,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 4. Tabla de rotación de Refresh Tokens
CREATE TABLE refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    revocado TINYINT(1) DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 5. Tabla para los códigos de Autenticación de 2 Pasos (MFA)
CREATE TABLE mfa_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    usado TINYINT(1) DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- 6. Tabla para la recuperación de contraseñas por correo
CREATE TABLE password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    usado TINYINT(1) DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ========================================================
-- CATÁLOGO Y PASARELA DE PAGOS (STRIPE)
-- ========================================================

-- 7. Tabla del inventario / catálogo de termos
CREATE TABLE productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    categoria VARCHAR(100),
    stock INT DEFAULT 1,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla principal de pedidos (Tickets de compra)
CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    estado_pago VARCHAR(50) DEFAULT 'pendiente',
    stripe_session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
);

-- 9. Detalles del pedido (Los termos específicos que compró en ese pedido)
CREATE TABLE detalles_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    nombre_producto VARCHAR(255) NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    url_diseno_personalizado VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- ========================================================
-- DATOS INICIALES DE PRUEBA (Opcional)
-- ========================================================
-- Insertamos un par de productos para que tu catálogo no esté vacío:
INSERT INTO productos (nombre, precio, categoria) VALUES 
('Termo Stanley Clásico 1L', 899.00, 'stanley'),
('Vaso Yeti Rambler 20oz', 750.00, 'yeti'),
('Termo Personalizado Negro', 499.00, 'personalizado');
