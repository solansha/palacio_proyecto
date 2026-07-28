FROM php:8.1-apache

RUN apt-get update && apt-get install -y libpq-dev

RUN docker-php-ext-install pgsql pdo pdo_pgsql pdo_mysql

RUN a2enmod rewrite

WORKDIR /var/www/html

COPY . /var/www/html/

EXPOSE 80

CMD ["apache2-foreground"]