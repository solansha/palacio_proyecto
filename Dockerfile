FROM php:8.1-apache
RUN apt-get update && apt-get install -y libpq-dev && docker-php-ext-install pgsql pdo pdo_pgsql pdo_mysql
RUN a2enmod rewrite
RUN echo 'DirectoryIndex index.php' >> /etc/apache2/apache2.conf
RUN sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/|' /etc/apache2/sites-available/000-default.conf
WORKDIR /var/www/html/
COPY . /var/www/html
EXPOSE 80
CMD ["apache2-foreground"]
