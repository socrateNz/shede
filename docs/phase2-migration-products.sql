-- Ajout de la colonne 'destination' pour séparer les commandes Cuisine et Bar
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS destination VARCHAR(50) DEFAULT 'CUISINE';

-- Vous pouvez définir les valeurs 'CUISINE' ou 'BAR' ou 'NONE'
