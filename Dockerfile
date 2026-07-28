FROM php:8.1-apache

# 1. Instalar las extensiones necesarias para PDO MySQL
RUN docker-php-ext-install pdo pdo_mysql

# 2. Habilitar mod_rewrite para Apache
RUN a2enmod rewrite

# 3. Copiar todo el código del proyecto directamente a la raíz web de Apache
COPY . /var/www/html/

# 4. Ajustar permisos para que Apache pueda leer los archivos correctamente
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80

CMD ["apache2-foreground"]